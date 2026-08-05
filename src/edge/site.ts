import { answer, BATCH_TIMEOUT_MS, createSyncpressRuntime, reason, type Gateway } from "./application.ts";

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

function normalizeDiagnostics(diagnostics: readonly FormedDiagnostic[]): Diagnostic[] {
  return diagnostics.map(({ source, line, column, ...diagnostic }) => ({
    ...diagnostic,
    source: source ?? undefined,
    line: line ?? undefined,
    column: column ?? undefined,
  }));
}

async function readSummary(gateway: Gateway): Promise<Summary> {
  const read = answer(await gateway.invoke("/site/summary", {}), "Could not read the site build summary");
  return read.summary as unknown as Summary;
}

/** The failure to raise: the answer the application gave, and every diagnostic that explains it. */
async function refusal(gateway: Gateway, context: string, detail: string): Promise<Error> {
  await gateway.whenIdle();
  const { diagnosis } = await readSummary(gateway);
  return new Error(`${context}: ${detail}\n\nDiagnostics:\n${diagnosis.text}`);
}

/** Build the project rooted at one host directory into one reconciled output tree. */
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

/** Report the current provenance of one page or route without publishing anything. */
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
