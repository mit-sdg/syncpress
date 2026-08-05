import { isAbsolute, relative, resolve, sep } from "node:path";
import { createSyncpressRuntime, type Gateway } from "./application.ts";

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
type Summary = { pages: number; files: number; diagnostics: FormedDiagnostic[] };

/**
 * A build or inspection is a batch operation whose answer waits for the work
 * rather than for a clock, so it uses the largest wait the boundary accepts.
 */
const BATCH_TIMEOUT_MS = 2_147_483_647;

/** Whether one host path is at or below another. */
export function containsPath(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
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

function reason(error: { kind: "domain"; value: unknown } | { kind: "framework"; code: string; detail?: string }): string {
  if (error.kind !== "domain") return error.detail ?? error.code;
  return typeof error.value === "string" ? error.value : JSON.stringify(error.value);
}

async function readSummary(gateway: Gateway): Promise<Summary> {
  const summary = await gateway.invoke("/site/summary", {});
  if (!summary.ok) throw new Error(`Could not read the site build summary: ${reason(summary.error)}`);
  return summary.value.summary as unknown as Summary;
}

/** The failure to raise: the answer the application gave, and every diagnostic that explains it. */
async function refusal(gateway: Gateway, context: string, detail: string): Promise<Error> {
  await gateway.whenIdle();
  const { diagnostics } = await readSummary(gateway);
  return new Error(`${context}: ${detail}\n\nDiagnostics:\n${formatDiagnostics(normalizeDiagnostics(diagnostics))}`);
}

/** Build the project rooted at one host directory into one reconciled output tree. */
export async function buildSite(projectDirectory = ".", destination?: string) {
  const { gateway } = createSyncpressRuntime();
  const directory = resolve(projectDirectory);
  const built = await gateway.invoke(
    "/site/build",
    destination === undefined ? { directory } : { directory, destination },
    { timeoutMs: BATCH_TIMEOUT_MS },
  );
  if (!built.ok) throw await refusal(gateway, "Could not build the site", reason(built.error));

  const { summary, ...counts } = built.value;
  if (summary.destination === null) {
    throw await refusal(gateway, "Could not build the site", "the published output directory is unknown");
  }
  return {
    pages: summary.pages,
    inputFiles: summary.files,
    policy: summary.policy,
    outputDirectory: summary.destination,
    ...counts,
    diagnostics: normalizeDiagnostics(summary.diagnostics as FormedDiagnostic[]),
  };
}

/** Report the current provenance of one page or route without publishing anything. */
export async function inspectSite(projectDirectory: string, target: string) {
  const { gateway } = createSyncpressRuntime();
  const inspected = await gateway.invoke(
    "/site/inspect",
    { directory: resolve(projectDirectory), target },
    { timeoutMs: BATCH_TIMEOUT_MS },
  );
  if (!inspected.ok) {
    const detail = reason(inspected.error);
    throw detail === "INSPECTION_TARGET_NOT_FOUND"
      ? await refusal(gateway, "No routed page or content source matches", JSON.stringify(target))
      : await refusal(gateway, "Could not inspect the site model", detail);
  }

  const { owner, inspection } = inspected.value;
  const source = inspection.source.path === null ? undefined : inspection.source;
  const template = inspection.template.name === null || inspection.template.digest === null
    ? undefined
    : inspection.template;
  const diagnostics = inspection.diagnostics.map(({ related, source: origin, line, column, ...diagnostic }) => ({
    ...diagnostic,
    source: origin ?? undefined,
    line: line ?? undefined,
    column: column ?? undefined,
    related: related.map(({ line: relatedLine, column: relatedColumn, ...relation }) => ({
      ...relation,
      line: relatedLine ?? undefined,
      column: relatedColumn ?? undefined,
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
