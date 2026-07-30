import type { InvocationResult } from "@mit-sdg/sync-engine/boundary";
import { lstat, mkdtemp, readdir, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SyncpressWire } from "../../generated/wire.ts";
import {
  CONFIGURATION_PATH,
  DEFAULTS,
  PATHS,
  ROOTS,
} from "../compositions/shared.ts";
import { PageOperationalInspection } from "../compositions/views.ts";
import type { SitePolicy } from "../concepts/governing/governing.ts";
import { buildSyncpress, type Application } from "./application.ts";

type Configuring = Application["concepts"]["Configuring"];
type SourceFile = { path: string; source: string };
type Diagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  source: string | undefined;
  line: number | undefined;
  column: number | undefined;
};
type ActionFailure = { readonly error: string; readonly detail?: unknown };
type ActionValue<T> = T extends { readonly error: string } ? never : T;
type OperationalInspection = {
  memberships: Array<{ collection: string; name: string; index: number }>;
  dependencies: {
    state: string;
    reason: string | null;
    inputs: Array<{ input: string }>;
  };
  outputs: Array<{ path: string; digest: string; medium: string }>;
  claims: Array<{ owner: string; address: string }>;
  diagnostics: Array<{
    diagnostic: string;
    severity: "error" | "warning";
    code: string;
    message: string;
    source: string | null;
    line: number | null;
    column: number | null;
    related: Array<{
      source: string;
      line: number | null;
      column: number | null;
      note: string;
    }>;
  }>;
};

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

function isActionFailure(value: unknown): value is ActionFailure {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

function actionValue<T>(result: T, context: string): ActionValue<T> {
  if (isActionFailure(result)) {
    throw new Error(`${context}: ${typeof result.detail === "string" ? result.detail : result.error}`);
  }
  return result as ActionValue<T>;
}

function gatewayError(error: { kind: "domain"; value: unknown } | { kind: "framework"; code: string; detail?: string }): string {
  return error.kind === "domain" ? describe(error.value) : error.detail ?? error.code;
}

function gatewayValue<T>(result: InvocationResult<T, unknown>, context: string): T {
  if (!result.ok) throw new Error(`${context}: ${gatewayError(result.error)}`);
  return result.value;
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
  await requireDirectory(directory, name);
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

async function configuredPath(
  configuring: Configuring,
  root: string,
  path: readonly string[],
  otherwise: string,
  name: string,
): Promise<string> {
  const value = (await configuring._scalar({ node: root, path, otherwise }))[0]?.value;
  if (typeof value !== "string") throw new Error(`Configured ${name} must be a string.`);
  return value;
}

function sourceDirectory(siteDirectory: string, configured: string, name: string): string {
  if (
    configured === "" ||
    isAbsolute(configured) ||
    configured.includes("\\") ||
    configured.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Configured ${name} must be a project-relative portable directory path.`);
  }

  const directory = resolve(siteDirectory, configured);
  if (!containsPath(siteDirectory, directory)) {
    throw new Error(`Configured ${name} must stay inside the site directory.`);
  }
  return directory;
}

function outputPrefix(configured: string, name: string): void {
  if (
    configured === "" ||
    isAbsolute(configured) ||
    /^[a-z]:\//i.test(configured) ||
    configured.includes("\\") ||
    configured.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Configured ${name} must be a portable relative output prefix.`);
  }
}

const INCLUDES_PREFIX = `${ROOTS.includes}/`;

function logicalTemplateName(path: string): string {
  return path.startsWith(INCLUDES_PREFIX) ? path.slice(INCLUDES_PREFIX.length) : path;
}

function requireUniqueTemplateNames(files: readonly SourceFile[]): void {
  const names = new Map<string, string>();
  for (const file of files) {
    const name = logicalTemplateName(file.path);
    const existing = names.get(name);
    if (existing !== undefined) {
      throw new Error(`Duplicate logical Liquid template name "${name}": "${existing}" and "${file.path}".`);
    }
    names.set(name, file.path);
  }
}

async function placeFile(application: Application, root: string, path: string, source: string): Promise<void> {
  let content: Uint8Array;
  try {
    content = new Uint8Array(await readFile(source));
  } catch (error) {
    throw new Error(`Could not read source file ${source}: ${errorMessage(error)}`);
  }
  actionValue(
    await application.concepts.Filing.place({ root, path, content }),
    `Could not stage source file ${source}`,
  );
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

async function runPhases(application: Application, sequence: string): Promise<string> {
  const started = actionValue(
    await application.concepts.Phasing.start({ sequence, mode: "once" }),
    "Could not start the site build",
  );
  await application.whenIdle();

  let phase: string | null = started.phase;
  while (phase !== null) {
    const advanced = actionValue(
      await application.concepts.Phasing.advance({ job: started.job }),
      "Could not advance the site build",
    );
    await application.whenIdle();
    phase = advanced.phase;
  }
  return started.job;
}

async function validateProjectPolicy(application: Application, configuration: Uint8Array): Promise<SitePolicy> {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(configuration);
  } catch {
    throw new Error(`${CONFIGURATION_PATH} must be valid UTF-8 text.`);
  }

  actionValue(
    await application.concepts.Configuring.load({ source, notation: "yaml" }),
    `Could not parse ${CONFIGURATION_PATH}`,
  );
  const assessed = actionValue(
    await application.concepts.Governing.assess({ source }),
    `Could not assess ${CONFIGURATION_PATH}`,
  );
  const problems = await application.concepts.Governing._problems();
  for (const diagnostic of problems) {
    actionValue(
      await application.concepts.Diagnosing.report({
        severity: "error",
        code: diagnostic.code,
        message: diagnostic.message,
        source: CONFIGURATION_PATH,
        line: diagnostic.line,
        column: diagnostic.column,
      }),
      `Could not record a ${CONFIGURATION_PATH} diagnostic`,
    );
  }
  if (!assessed.valid) {
    throw new Error(`Invalid ${CONFIGURATION_PATH}:\n\n${formatDiagnostics(await application.concepts.Diagnosing._all())}`);
  }
  return assessed.policy;
}

async function prepareSite(projectDirectory = ".", destination?: string) {
  const siteDirectory = resolve(projectDirectory);
  await requireDirectory(siteDirectory, "site");
  const canonicalSiteDirectory = await canonicalPath(siteDirectory, "site directory");

  const configurationFile = join(siteDirectory, CONFIGURATION_PATH);
  const configuration = await readRequiredFile(configurationFile, CONFIGURATION_PATH);
  const { application, gateway } = buildSyncpress();
  const policy = await validateProjectPolicy(application, configuration);
  const outputDirectory = destination === undefined
    ? sourceDirectory(siteDirectory, policy.outputPath, "paths.output")
    : resolve(siteDirectory, destination);

  const project = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.project }),
    "Could not open the project Filing root",
  );
  actionValue(
    await application.concepts.Filing.place({ root: project.root, path: CONFIGURATION_PATH, content: configuration }),
    `Could not stage ${CONFIGURATION_PATH}`,
  );

  const configured = gatewayValue<SyncpressWire["/site/configure"]["output"]>(
    await gateway.invoke("/site/configure", { destination: outputDirectory }),
    "Could not configure the site build",
  );
  const active = await application.concepts.Configuring._active();
  if (active.length !== 1) throw new Error("Site configuration did not produce one active configuration.");

  const configurationRoot = active[0]!.root;
  const contentPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsContent,
    DEFAULTS.contentPath,
    "paths.content",
  );
  const templatesPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsTemplates,
    DEFAULTS.templatesPath,
    "paths.templates",
  );
  const publicPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsPublic,
    DEFAULTS.publicPath,
    "paths.public",
  );
  const assetsPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsAssets,
    DEFAULTS.assetsPath,
    "paths.assets",
  );
  outputPrefix(assetsPath, "paths.assets");

  const contentDirectory = sourceDirectory(
    siteDirectory,
    contentPath,
    "paths.content",
  );
  const templatesDirectory = sourceDirectory(
    siteDirectory,
    templatesPath,
    "paths.templates",
  );
  const publicDirectory = sourceDirectory(
    siteDirectory,
    publicPath,
    "paths.public",
  );

  const sourceRoots = [
    { name: ROOTS.content, directory: contentDirectory },
    { name: ROOTS.templates, directory: templatesDirectory },
    { name: ROOTS.public, directory: publicDirectory },
  ];
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
  const comparableOutputDirectory = await canonicalPath(outputDirectory, "output directory");
  if (destination === undefined && !containsPath(canonicalSiteDirectory, comparableOutputDirectory)) {
    throw new Error(
      `Configured paths.output must stay inside the site directory after resolving symbolic links: ${outputDirectory}`,
    );
  }
  for (const source of canonicalSourceRoots) {
    if (pathsOverlap(source.canonicalDirectory, comparableOutputDirectory)) {
      throw new Error(
        `Output directory overlaps configured ${source.name} directory: ${outputDirectory} and ${source.directory}`,
      );
    }
  }
  if (containsPath(comparableOutputDirectory, await canonicalPath(configurationFile, CONFIGURATION_PATH))) {
    throw new Error(`Output directory overlaps ${CONFIGURATION_PATH}: ${outputDirectory} and ${configurationFile}`);
  }

  const contentFiles = await sourceFiles(contentDirectory, ROOTS.content);
  const templateFiles = await sourceFiles(templatesDirectory, ROOTS.templates);
  const publicFiles = await sourceFiles(publicDirectory, ROOTS.public);
  requireUniqueTemplateNames(templateFiles);
  const inputFiles = 1 + contentFiles.length + templateFiles.length + publicFiles.length;

  const content = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.content }),
    "Could not open the content Filing root",
  );
  const templates = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.templates }),
    "Could not open the templates Filing root",
  );
  const includes = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.includes }),
    "Could not open the includes Filing root",
  );
  const publicFilesRoot = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.public }),
    "Could not open the public Filing root",
  );

  for (const file of contentFiles) await placeFile(application, content.root, file.path, file.source);
  for (const file of templateFiles) {
    const isInclude = file.path.startsWith(INCLUDES_PREFIX);
    await placeFile(
      application,
      isInclude ? includes.root : templates.root,
      logicalTemplateName(file.path),
      file.source,
    );
  }
  for (const file of publicFiles) await placeFile(application, publicFilesRoot.root, file.path, file.source);

  const job = await runPhases(application, configured.sequence);
  return { application, gateway, job, inputFiles, policy };
}

export async function buildSite(projectDirectory = ".", destination?: string) {
  const { application, gateway, job, inputFiles, policy } = await prepareSite(projectDirectory, destination);
  const reconciled = await gateway.invoke("/site/reconcile", { job });
  const diagnostics = await application.concepts.Diagnosing._all();
  if (!reconciled.ok) {
    throw new Error(
      `Could not reconcile the site build: ${gatewayError(reconciled.error)}\n\nDiagnostics:\n${formatDiagnostics(diagnostics)}`,
    );
  }

  const pages = (await application.concepts.Routing._claims()).length;
  return { pages, inputFiles, policy, ...reconciled.value, diagnostics };
}

function leafPaths(value: unknown, prefix: string[] = []): string[][] {
  if (Array.isArray(value)) return value.flatMap((item, index) => leafPaths(item, [...prefix, String(index)]));
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length === 0 ? [prefix] : entries.flatMap(([key, item]) => leafPaths(item, [...prefix, key]));
  }
  return [prefix];
}

/** Build an isolated application model and report the current provenance for one page or route. */
export async function inspectSite(projectDirectory: string, target: string) {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-inspect-"));
  try {
    const { application } = await prepareSite(projectDirectory, join(temporary, "output"));
    let owner: string | undefined;
    if (target.startsWith("/")) owner = (await application.concepts.Routing._owner({ address: target }))[0]?.owner;
    else {
      const content = (await application.concepts.Filing._named({ name: ROOTS.content }))[0];
      if (content !== undefined) owner = (await application.concepts.Filing._at({ root: content.root, path: target }))[0]?.file;
    }
    if (owner === undefined) {
      const diagnostics = await application.concepts.Diagnosing._all();
      throw new Error(`No routed page or content source matches ${JSON.stringify(target)}.\n\nDiagnostics:\n${formatDiagnostics(diagnostics)}`);
    }

    const source = (await application.concepts.Filing._file({ file: owner }))[0];
    const address = (await application.concepts.Routing._address({ owner }))[0]?.address;
    const selected = source === undefined
      ? undefined
      : (await application.concepts.Layering._value({ subject: owner, path: PATHS.buildTemplate }))[0]?.value;
    const generated = source === undefined
      ? (await application.concepts.Deploying._forOwner({ owner }))[0]
      : undefined;
    const templateName = source === undefined
      ? generated?.kind === "pagination-page" ? generated.templateName : undefined
      : typeof selected === "string" ? selected : DEFAULTS.template;
    const template = templateName === undefined
      ? undefined
      : (await application.concepts.Templating._template({ name: templateName }))[0];
    const resolved = source === undefined ? undefined : await application.concepts.Layering._resolved({ subject: owner });
    const layers = source === undefined ? [] : await application.concepts.Layering._layers({ subject: owner });
    const origins = source === undefined || resolved === undefined
      ? []
      : (await Promise.all(
          leafPaths(resolved.values).filter((path) => path.length > 0).map(async (path) => ({
            path,
            ...(await application.concepts.Layering._origin({ subject: owner!, path }))[0],
          })),
        )).filter((origin) => origin.layer !== undefined);
    const operational = await application.form(PageOperationalInspection({ owner })) as OperationalInspection;
    const diagnostics = operational.diagnostics.map(({ related, source, line, column, ...diagnostic }) => ({
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
      route: address,
      source: source === undefined ? undefined : { path: source.path, digest: source.digest },
      template: template === undefined || templateName === undefined
        ? undefined
        : { name: templateName, digest: template.digest, tree: await application.concepts.Templating._tree({ owner: template.template }) },
      layers,
      origins,
      memberships: operational.memberships,
      dependencies: {
        state: [{ state: operational.dependencies.state }],
        reason: operational.dependencies.reason ?? undefined,
        inputs: operational.dependencies.inputs,
      },
      outputs: operational.outputs,
      claims: operational.claims,
      diagnostics,
    };
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

export type BuildResult = Awaited<ReturnType<typeof buildSite>>;
