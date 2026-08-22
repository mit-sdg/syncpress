import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { SyncpressWire } from "@generated/wire.ts";
import { assembleSyncpress } from "../assembly.ts";

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
type Summary = {
  pages: number;
  files: number;
  diagnosis: { text: string };
  diagnostics: FormedDiagnostic[];
};
type GatewayError =
  | { kind: "domain"; value: unknown }
  | { kind: "framework"; code: string; detail?: string };
type Answer<T> = { ok: true; value: T } | { ok: false; error: GatewayError };

export function createSyncpressRuntime() {
  const application = assembleSyncpress();
  return { application, gateway: createGateway<SyncpressWire>({ application }) };
}

export type Gateway = ReturnType<typeof createSyncpressRuntime>["gateway"];
export const BATCH_TIMEOUT_MS = 2_147_483_647;

export function reason(error: GatewayError): string {
  if (error.kind !== "domain") return error.detail ?? error.code;
  return typeof error.value === "string" ? error.value : JSON.stringify(error.value);
}

export function answer<T>(result: Answer<T>, context: string): T {
  if (!result.ok) throw new Error(`${context}: ${reason(result.error)}`);
  return result.value;
}

const absent = <T>(value: T | null): T | undefined => value ?? undefined;

function normalizeDiagnostics(diagnostics: readonly FormedDiagnostic[]): Diagnostic[] {
  return diagnostics.map(({ source, line, column, ...diagnostic }) => ({
    ...diagnostic,
    source: absent(source),
    line: absent(line),
    column: absent(column),
  }));
}

async function readSummary(gateway: Gateway): Promise<Summary> {
  const read = answer(await gateway.invoke("/site/summary", {}), "Could not read the site build summary");
  return read.summary as unknown as Summary;
}

async function refusal(gateway: Gateway, context: string, detail: string): Promise<Error> {
  await gateway.whenIdle();
  const { diagnosis } = await readSummary(gateway);
  return new Error(`${context}: ${detail}\n\nDiagnostics:\n${diagnosis.text}`);
}

export async function buildSite(projectDirectory = ".", destination?: string) {
  const { gateway } = createSyncpressRuntime();
  const built = await gateway.invoke(
    "/site/build",
    destination === undefined ? { directory: projectDirectory } : { directory: projectDirectory, destination },
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

export async function inspectSite(projectDirectory: string, target: string) {
  const { gateway } = createSyncpressRuntime();
  const inspected = await gateway.invoke(
    "/site/inspect",
    { directory: projectDirectory, target },
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
    source: absent(origin),
    line: absent(line),
    column: absent(column),
    related: related.map(({ line: relatedLine, column: relatedColumn, ...relation }) => ({
      ...relation,
      line: absent(relatedLine),
      column: absent(relatedColumn),
    })),
  }));

  return {
    target,
    owner,
    route: absent(inspection.route.address),
    source: source === undefined ? undefined : { path: source.path!, digest: source.digest! },
    template: template === undefined ? undefined : { name: template.name!, digest: template.digest!, tree: template.tree },
    layers: inspection.layers,
    origins: inspection.origins,
    rendering: inspection.rendering.attempt === null
      ? undefined
      : {
          ...inspection.rendering,
          body: absent(inspection.rendering.body),
          layout: absent(inspection.rendering.layout),
        },
    renderings: inspection.renderings,
    memberships: inspection.memberships,
    dependencies: {
      state: [{ state: inspection.dependencies.state }],
      reason: absent(inspection.dependencies.reason),
      inputs: inspection.dependencies.inputs,
    },
    outputs: inspection.outputs,
    claims: inspection.claims,
    diagnostics,
  };
}

export type BuildResult = Awaited<ReturnType<typeof buildSite>>;
