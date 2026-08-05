import type { InvocationResult } from "@mit-sdg/sync-engine/boundary";
import { Buffer } from "node:buffer";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SyncpressWire } from "../../generated/wire.ts";
import { CONFIGURATION_PATH, ROOTS } from "@syncpress/compositions/shared";
import { createSyncpressRuntime, type Gateway } from "./application.ts";

type SourceFile = { path: string; source: string };
type Diagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  source: string | undefined;
  line: number | undefined;
  column: number | undefined;
};
type FormedDiagnostic = Omit<Diagnostic, "source" | "line" | "column"> & {
  source: string | null;
  line: number | null;
  column: number | null;
};

const destinationTails = new Map<string, Promise<void>>();

async function acquireDestination(destination: string): Promise<() => void> {
  const previous = destinationTails.get(destination) ?? Promise.resolve();
  let unlock!: () => void;
  const held = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const tail = previous.then(() => held);
  destinationTails.set(destination, tail);
  await previous;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    unlock();
    void tail.finally(() => {
      if (destinationTails.get(destination) === tail) destinationTails.delete(destination);
    });
  };
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function gatewayError(error: { kind: "domain"; value: unknown } | { kind: "framework"; code: string; detail?: string }): string {
  return error.kind === "domain" ? describe(error.value) : error.detail ?? error.code;
}

function gatewayValue<T>(result: InvocationResult<T, unknown>, context: string): T {
  if (!result.ok) throw new Error(`${context}: ${gatewayError(result.error)}`);
  return result.value;
}

async function readSiteSummary(gateway: Gateway) {
  return gatewayValue<SyncpressWire["/site/summary"]["output"]>(
    await gateway.invoke("/site/summary", {}),
    "Could not read the site build summary",
  ).summary;
}

export function containsPath(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function pathsOverlap(left: string, right: string): boolean {
  return containsPath(left, right) || containsPath(right, left);
}

export async function canonicalPath(path: string, name: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    const code = errorCode(error);
    if (code !== "ENOENT" && code !== "ENOTDIR") {
      throw new Error(`Could not resolve ${name} ${path}: ${errorMessage(error)}`);
    }
  }

  const parent = dirname(path);
  return parent === path ? path : join(await canonicalPath(parent, name), basename(path));
}

async function requireDirectory(directory: string, name: string): Promise<void> {
  let status: Awaited<ReturnType<typeof lstat>>;
  try {
    status = await lstat(directory);
  } catch (error) {
    if (errorCode(error) === "ENOENT") throw new Error(`Required ${name} directory is missing: ${directory}`);
    if (errorCode(error) === "ENOTDIR") throw new Error(`Required ${name} directory is not a directory: ${directory}`);
    throw new Error(`Could not inspect required ${name} directory ${directory}: ${errorMessage(error)}`);
  }

  if (status.isSymbolicLink()) throw new Error(`Required ${name} directory must not be a symbolic link: ${directory}`);
  if (!status.isDirectory()) throw new Error(`Required ${name} directory is not a directory: ${directory}`);
}

async function readRequiredFile(file: string, name: string): Promise<Uint8Array> {
  let status: Awaited<ReturnType<typeof lstat>>;
  try {
    status = await lstat(file);
  } catch (error) {
    if (errorCode(error) === "ENOENT") throw new Error(`Required ${name} is missing: ${file}`);
    throw new Error(`Could not inspect required ${name} ${file}: ${errorMessage(error)}`);
  }

  if (status.isSymbolicLink()) throw new Error(`Required ${name} must not be a symbolic link: ${file}`);
  if (!status.isFile()) throw new Error(`Required ${name} is not a regular file: ${file}`);

  try {
    return new Uint8Array(await readFile(file));
  } catch (error) {
    throw new Error(`Could not read required ${name} ${file}: ${errorMessage(error)}`);
  }
}

async function sourceFiles(directory: string, name: string): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  async function visit(current: string, prefix: string): Promise<void> {
    let entries: { name: string }[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Could not read ${name} directory ${current}: ${errorMessage(error)}`);
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    for (const entry of entries) {
      const source = join(current, entry.name);
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      let status: Awaited<ReturnType<typeof lstat>>;
      try {
        status = await lstat(source);
      } catch (error) {
        throw new Error(`Could not inspect ${name} entry ${source}: ${errorMessage(error)}`);
      }

      if (status.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in ${name}: ${source}`);
      if (status.isDirectory()) {
        await visit(source, path);
      } else if (status.isFile()) {
        files.push({ path, source });
      } else {
        throw new Error(`Non-regular entry is not allowed in ${name}: ${source}`);
      }
    }
  }

  await visit(directory, "");
  return files;
}

function sourceDirectory(siteDirectory: string, configured: string, name: string): string {
  const directory = resolve(siteDirectory, configured);
  if (!containsPath(siteDirectory, directory)) {
    throw new Error(`Configured ${name} must stay inside the site directory.`);
  }
  return directory;
}

async function stageBytes(
  gateway: Gateway,
  name: string,
  filePath: string,
  content: Uint8Array,
  context: string,
): Promise<void> {
  gatewayValue<SyncpressWire["/site/stage"]["output"]>(
    await gateway.invoke("/site/stage", { name, filePath, encoded: Buffer.from(content).toString("base64") }),
    context,
  );
}

async function placeFile(gateway: Gateway, name: string, path: string, source: string): Promise<void> {
  let content: Uint8Array;
  try {
    content = new Uint8Array(await readFile(source));
  } catch (error) {
    throw new Error(`Could not read source file ${source}: ${errorMessage(error)}`);
  }
  await stageBytes(gateway, name, path, content, `Could not stage source file ${source}`);
}

function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return "No diagnostics were reported.";
  return diagnostics
    .map(({ severity, code, message, source, line, column }) => {
      const location =
        source === undefined ? "" : ` ${source}${line === undefined ? "" : `:${line}${column === undefined ? "" : `:${column}`}`}`;
      return `${severity.toUpperCase()} ${code}${location}: ${message}`;
    })
    .join("\n");
}

function normalizeDiagnostics(diagnostics: readonly FormedDiagnostic[]): Diagnostic[] {
  return diagnostics.map(({ source, line, column, ...diagnostic }) => ({
    ...diagnostic,
    source: source ?? undefined,
    line: line ?? undefined,
    column: column ?? undefined,
  }));
}

async function runPhases(gateway: Gateway, sequence: string): Promise<string> {
  const started = gatewayValue<SyncpressWire["/site/start"]["output"]>(
    await gateway.invoke("/site/start", { sequence }),
    "Could not start the site build",
  );
  await gateway.whenIdle();

  let attempt: string | null = started.attempt;
  while (attempt !== null) {
    const advanced: SyncpressWire["/site/advance"]["output"] = gatewayValue<SyncpressWire["/site/advance"]["output"]>(
      await gateway.invoke("/site/advance", { job: started.job, attempt }),
      "Could not advance the site build",
    );
    await gateway.whenIdle();
    attempt = advanced.attempt;
  }
  return started.job;
}

/** Stage the configuration and engine-authored source plan into a fresh model. */
async function stageSite(projectDirectory = ".") {
  const siteDirectory = resolve(projectDirectory);
  await requireDirectory(siteDirectory, "site");
  const canonicalSiteDirectory = await canonicalPath(siteDirectory, "site directory");

  const configurationFile = join(siteDirectory, CONFIGURATION_PATH);
  const configuration = await readRequiredFile(configurationFile, CONFIGURATION_PATH);
  const { gateway } = createSyncpressRuntime();
  await stageBytes(gateway, ROOTS.project, CONFIGURATION_PATH, configuration, `Could not stage ${CONFIGURATION_PATH}`);

  const assessed = await gateway.invoke("/site/assess", {});
  if (!assessed.ok) {
    await gateway.whenIdle();
    const summary = await readSiteSummary(gateway) as { pages: number; diagnostics: FormedDiagnostic[] };
    throw new Error(
      `Invalid ${CONFIGURATION_PATH}: ${gatewayError(assessed.error)}\n\n${formatDiagnostics(normalizeDiagnostics(summary.diagnostics))}`,
    );
  }
  const policy = assessed.value.policy;
  const sourceRoots = assessed.value.sources.map(({ name, path }) => ({
    name,
    directory: sourceDirectory(siteDirectory, path, `paths.${name}`),
  }));
  for (const source of sourceRoots) await requireDirectory(source.directory, source.name);
  const canonicalSourceRoots = await Promise.all(
    sourceRoots.map(async (source) => ({
      ...source,
      canonicalDirectory: await canonicalPath(source.directory, `${source.name} directory`),
    })),
  );
  for (const source of canonicalSourceRoots) {
    if (!containsPath(canonicalSiteDirectory, source.canonicalDirectory)) {
      throw new Error(
        `Configured paths.${source.name} must stay inside the site directory after resolving symbolic links: ${source.directory}`,
      );
    }
  }

  let inputFiles = 1;
  for (const source of canonicalSourceRoots) {
    const files = await sourceFiles(source.directory, source.name);
    inputFiles += files.length;
    for (const file of files) await placeFile(gateway, source.name, file.path, file.source);
  }

  return {
    gateway,
    inputFiles,
    policy,
    siteDirectory,
    canonicalSiteDirectory,
    configurationFile,
    sourceRoots: canonicalSourceRoots,
  };
}

/** Run a staged model with publication directed at one validated destination. */
async function stageAndRunSiteBuild(projectDirectory = ".", destination?: string) {
  const staged = await stageSite(projectDirectory);
  const {
    gateway,
    policy,
    siteDirectory,
    canonicalSiteDirectory,
    configurationFile,
    sourceRoots,
  } = staged;
  const outputDirectory = destination === undefined
    ? sourceDirectory(siteDirectory, policy.paths.output, "paths.output")
    : resolve(siteDirectory, destination);
  const comparableOutputDirectory = await canonicalPath(outputDirectory, "output directory");
  if (destination === undefined && !containsPath(canonicalSiteDirectory, comparableOutputDirectory)) {
    throw new Error(
      `Configured paths.output must stay inside the site directory after resolving symbolic links: ${outputDirectory}`,
    );
  }
  for (const source of sourceRoots) {
    if (pathsOverlap(source.canonicalDirectory, comparableOutputDirectory)) {
      throw new Error(
        `Output directory overlaps configured ${source.name} directory: ${outputDirectory} and ${source.directory}`,
      );
    }
  }
  if (containsPath(comparableOutputDirectory, await canonicalPath(configurationFile, CONFIGURATION_PATH))) {
    throw new Error(`Output directory overlaps ${CONFIGURATION_PATH}: ${outputDirectory} and ${configurationFile}`);
  }

  const releaseDestination = await acquireDestination(comparableOutputDirectory);
  try {
    const configured = gatewayValue<SyncpressWire["/site/configure"]["output"]>(
      await gateway.invoke("/site/configure", { destination: outputDirectory }),
      "Could not configure the site build",
    );
    const job = await runPhases(gateway, configured.sequence);
    return {
      gateway,
      job,
      inputFiles: staged.inputFiles,
      policy,
      outputDirectory: comparableOutputDirectory,
      releaseDestination,
    };
  } catch (error) {
    releaseDestination();
    throw error;
  }
}

/** Internal watch entry that updates output exclusion before reconciliation writes. */
export async function buildSiteForWatch(
  projectDirectory = ".",
  destination?: string,
  beforeReconcile?: (outputDirectory: string) => Promise<void>,
) {
  const { gateway, job, inputFiles, policy, outputDirectory, releaseDestination } = await stageAndRunSiteBuild(
    projectDirectory,
    destination,
  );
  try {
    await beforeReconcile?.(outputDirectory);
    const reconciled = await gateway.invoke("/site/reconcile", { job });
    await gateway.whenIdle();
    const summary = await readSiteSummary(gateway) as { pages: number; diagnostics: FormedDiagnostic[] };
    const diagnostics = normalizeDiagnostics(summary.diagnostics);
    if (!reconciled.ok) {
      throw new Error(
        `Could not reconcile the site build: ${gatewayError(reconciled.error)}\n\nDiagnostics:\n${formatDiagnostics(diagnostics)}`,
      );
    }

    return {
      result: { pages: summary.pages, inputFiles, policy, ...reconciled.value, diagnostics },
      outputDirectory,
    };
  } finally {
    releaseDestination();
  }
}

export async function buildSite(projectDirectory = ".", destination?: string) {
  return (await buildSiteForWatch(projectDirectory, destination)).result;
}

/** Build an isolated application model and report the current provenance for one page or route. */
export async function inspectSite(projectDirectory: string, target: string) {
  const { gateway } = await stageSite(projectDirectory);
  const prepared = gatewayValue<SyncpressWire["/site/prepare"]["output"]>(
    await gateway.invoke("/site/prepare", {}),
    "Could not prepare the site model",
  );
  await runPhases(gateway, prepared.sequence);

  const inspected = await gateway.invoke("/site/inspect", { target });
  if (!inspected.ok) {
    if (inspected.error.kind !== "domain" || inspected.error.value !== "INSPECTION_TARGET_NOT_FOUND") {
      throw new Error(`Could not inspect the site model: ${gatewayError(inspected.error)}`);
    }
    const summary = await readSiteSummary(gateway) as { pages: number; diagnostics: FormedDiagnostic[] };
    throw new Error(`No routed page or content source matches ${JSON.stringify(target)}.\n\nDiagnostics:\n${formatDiagnostics(normalizeDiagnostics(summary.diagnostics))}`);
  }
  const { owner, inspection } = inspected.value;
  const source = inspection.source.path === null ? undefined : inspection.source;
  const template = inspection.template.name === null || inspection.template.digest === null
    ? undefined
    : inspection.template;
  const diagnostics = inspection.diagnostics.map(({ related, source, line, column, ...diagnostic }) => ({
    ...diagnostic,
    source: source ?? undefined,
    line: line ?? undefined,
    column: column ?? undefined,
    related: related.map(({ line, column, ...relation }) => ({
      ...relation,
      line: line ?? undefined,
      column: column ?? undefined,
    })),
  }));

  return {
    target,
    owner,
    route: inspection.route.address ?? undefined,
    source: source === undefined ? undefined : { path: source.path!, digest: source.digest! },
    template: template === undefined ? undefined : { name: template.name!, digest: template.digest!, tree: template.tree },
    layers: inspection.layers,
    origins: inspection.origins,
    rendering: inspection.rendering.attempt === null
      ? undefined
      : {
          ...inspection.rendering,
          body: inspection.rendering.body ?? undefined,
          layout: inspection.rendering.layout ?? undefined,
        },
    renderings: inspection.renderings,
    memberships: inspection.memberships,
    dependencies: {
      state: [{ state: inspection.dependencies.state }],
      reason: inspection.dependencies.reason ?? undefined,
      inputs: inspection.dependencies.inputs,
    },
    outputs: inspection.outputs,
    claims: inspection.claims,
    diagnostics,
  };
}

export type BuildResult = Awaited<ReturnType<typeof buildSite>>;
