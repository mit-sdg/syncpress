import { compute, earlier, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { AbsoluteSiteUrl, AddressOutputPath } from "./calculations.ts";
import { DIAGNOSTIC_SCOPES, PAGE_CONTENT_PATH, PARTS, PHASE_SEQUENCE, ROOTS, TRUSTED_COLLECTION_EXCERPTS } from "./shared.ts";
import {
  CompletedOriginatedPageRenderContext,
  CompletedUnoriginatedPageRenderContext,
  OriginatedPageRenderContext,
  UnoriginatedPageRenderContext,
} from "./views.ts";

const {
  Converting,
  DependencyTracking,
  Diagnosing,
  DocumentParsing,
  Emitting,
  Filing,
  Layering,
  Phasing,
  Referencing,
  RenderTracking,
  Routing,
  Templating,
} = conceptRefs;


const InvalidPageRenderingSelection = view(
  "the invalid rendering selection for path (path) and data (data)",
  ({ path, data }, { error, detail }) =>
    where(
      computations.pageRenderingSelectionHasValidity({ path, data, valid: false }),
      compute(computations.pageRenderingError, { path, data }, error),
      compute(computations.pageRenderingErrorDetail, { path, data }, detail),
    ),
).optional();

/** Failed latest renderings whose owner-local attempts still need cleanup. */
export const PendingFailedRenderingCleanup = view(
  "pending failed rendering cleanup",
  (_inputs, { page, rendering }, { dependencyAttempt, emissionAttempt }) => [
    where(
      RenderTracking._all({}).is({ rendering, subject: page, stage: "failed", emissionAttempt }),
      RenderTracking._latest({ subject: page }).is({ rendering }),
      Emitting._open({ producer: page }).is({ attempt: emissionAttempt }),
    ),
    where(
      RenderTracking._all({}).is({ rendering, subject: page, stage: "failed", dependencyAttempt }),
      RenderTracking._latest({ subject: page }).is({ rendering }),
      DependencyTracking._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
      DependencyTracking._state({ subject: page }).is({ state: "building" }),
    ),
  ],
).many();

/** A newly routed page receives exact owner attempts before later phases inspect it. */
export const ClaimedRoutesBeginPageDependencies = reaction(({ page }) =>
  when(Routing.claim({ owner: page }).responds({}))
    .where(earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }))
    .then(DependencyTracking.beginAttempt({ subject: page })),
);

export const PageDependenciesOpenEmission = reaction(({ page }) =>
  when(DependencyTracking.beginAttempt({ subject: page }).responds({}))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
      Filing._file({ file: page }),
    )
    .then(Emitting.beginAttempt({ producer: page })),
);

export const PageEmissionsBeginRendering = reaction(
  ({ page, emissionAttempt, dependencyAttempt, path, data, profile, template }) =>
    when(Emitting.beginAttempt({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(DependencyTracking.beginAttempt, { subject: page }, { attempt: dependencyAttempt }),
        earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        DependencyTracking._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        computations.pageRenderingSelectionHasValidity({ path, data, valid: true }),
        compute(computations.pageRenderingProfile, { path, data }, profile),
        compute(computations.pageRenderingTemplate, { path, data }, template),
      )
      .then(RenderTracking.begin({ subject: page, path, profile, template, dependencyAttempt, emissionAttempt })),
);

export const InvalidPageRenderingSelectionsDiagnose = reaction(
  ({ page, emissionAttempt, path, data, error, detail }) =>
    when(Emitting.beginAttempt({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(DependencyTracking.beginAttempt, { subject: page }, {}),
        earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        InvalidPageRenderingSelection({ path, data }).is({ error, detail }),
      )
      .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const InvalidPageRenderingSelectionsAbortOutput = reaction(
  ({ page, emissionAttempt, path, data }) =>
    when(Emitting.beginAttempt({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(DependencyTracking.beginAttempt, { subject: page }, {}),
        earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        InvalidPageRenderingSelection({ path, data }),
      )
      .then(Emitting.abortAttempt({ producer: page, attempt: emissionAttempt })),
);

export const InvalidPageRenderingSelectionsAbandonDependencies = reaction(
  ({ page, emissionAttempt, dependencyAttempt, path, data }) =>
    when(Emitting.beginAttempt({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(DependencyTracking.beginAttempt, { subject: page }, { attempt: dependencyAttempt }),
        earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        InvalidPageRenderingSelection({ path, data }),
      )
      .then(DependencyTracking.abandonAttempt({ subject: page, attempt: dependencyAttempt })),
);

/** Clear diagnostics for this source before its replacement render proceeds. */
export const RenderingAttemptsRetractDiagnostics = reaction(({ page, path }) =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "render", transitioned: true }))
    .where(
      Routing._claims({}).is({ owner: page }),
      RenderTracking._latest({ subject: page }).is({ stage: "started" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.rendering, source: path })),
);

/** The exact source is retained before its body can be filled. */
export const RetractedRenderingAttemptsTrackSource = reaction(({ page, path, dependencyAttempt }) =>
  when(Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.rendering, source: path }).responds({}))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Routing._claims({}).is({ owner: page }),
      RenderTracking._latest({ subject: page }).is({ stage: "started", dependencyAttempt }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(DependencyTracking.recordDependency({ subject: page, attempt: dependencyAttempt, input: page })),
);

/** Source provenance causally begins body rendering with one complete context. */
export const TrackedRenderingSourcesFillBodies = reaction(
  ({ page, rendering, dependencyAttempt, body, bodyLine, root, path, address }) =>
   when(DependencyTracking.recordDependency({ subject: page, attempt: dependencyAttempt, input: page }).responds({}))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._latest({ subject: page }).is({ rendering, stage: "started", dependencyAttempt }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
      DocumentParsing._document({ subject: page }).is({ body, bodyLine }),
      Routing._address({ owner: page }).is({ address }),
    )
    .then(
      where(AbsoluteSiteUrl({ address }))
        .then(Templating.renderSource({
          subject: rendering,
          source: body,
          context: OriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
          trusted: [TRUSTED_COLLECTION_EXCERPTS],
          sourceName: path,
          sourceLine: bodyLine,
        }))
        .named("originated"),
      where(no(AbsoluteSiteUrl({ address })))
        .then(Templating.renderSource({
          subject: rendering,
          source: body,
          context: UnoriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
          trusted: [TRUSTED_COLLECTION_EXCERPTS],
          sourceName: path,
          sourceLine: bodyLine,
        }))
        .named("unoriginated"),
    ),
);

/** Diagnose a selected profile only after this render has cleared prior source diagnostics. */
export const MissingRenderingProfilesDiagnose = reaction(({ rendering, page, name, path }) =>
  when(Templating.renderSource({ subject: rendering }).responds({}))
    .where(
      RenderTracking._active({ rendering }).is({ subject: page, profile: name }),
      no(Converting._profile({ name })),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({
      scope: DIAGNOSTIC_SCOPES.rendering,
      severity: "error",
      code: "PROFILE_NOT_FOUND",
      message: "The selected body conversion profile is not defined.",
      source: path,
    })),
);

/** Honor an explicit page conversion profile. */
export const FilledBodiesConvert = reaction(({ rendering, output, profile, name }) =>
  when(Templating.renderSource({ subject: rendering }).responds({ output }))
    .where(
      RenderTracking._active({ rendering }).is({ profile: name }),
      Converting._profile({ name }).is({ profile }),
    )
    .then(Converting.convert({ subject: rendering, part: PARTS.body, profile, source: output })),
);

/** Every converted body gets its own reference-resolution pass. */
export const ConvertedBodiesScan = reaction(({ rendering, output }) =>
  when(Converting.convert({ subject: rendering, part: PARTS.body }).responds({ output })).then(
    Referencing.scan({ subject: rendering, part: PARTS.body, text: output }),
  ),
);

/** Retain the exact body template tree as page inputs. */
export const FilledBodiesTrackTemplates = reaction(({ page, rendering, filling, used, template, dependencyAttempt }) =>
  when(Templating.renderSource({ subject: rendering }).responds({ filling }))
    .where(
      RenderTracking._active({ rendering }).is({ subject: page, dependencyAttempt }),
      Templating._tree({ owner: filling }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(DependencyTracking.recordDependency({ subject: page, attempt: dependencyAttempt, input: template })),
);

/** Both immediate and answered body scans converge on one observable settlement transition. */
export const EmptyBodyScansSettleRendering = reaction(({ rendering }) =>
  when(Referencing.scan({ subject: rendering, part: PARTS.body }).responds({ completed: true }))
    .where(earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }))
    .then(RenderTracking.completeBody({ rendering })),
);

export const FinishedBodyAnswersSettleRendering = reaction(({ rendering }) =>
  when(Referencing.resolve({}).responds({ subject: rendering, part: PARTS.body, completed: true }))
    .where(earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }))
    .then(RenderTracking.completeBody({ rendering })),
);

/** A newly settled body chooses exactly one originated layout or diagnostic case. */
export const SettledBodiesRenderOriginatedPages = reaction(({ rendering, page, address, name, template }) =>
  when(RenderTracking.completeBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Routing._address({ owner: page }).is({ address }),
      AbsoluteSiteUrl({ address }),
      RenderTracking._active({ rendering }).is({ template: name }),
      Templating._template({ name }).is({ template }),
    )
    .then(Templating.renderTemplate({
      template,
      subject: rendering,
      context: CompletedOriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    })),
);

/** A newly settled body preserves canonical-key omission for unoriginated pages. */
export const SettledBodiesRenderUnoriginatedPages = reaction(({ rendering, page, address, name, template }) =>
  when(RenderTracking.completeBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Routing._address({ owner: page }).is({ address }),
      no(AbsoluteSiteUrl({ address })),
      RenderTracking._active({ rendering }).is({ template: name }),
      Templating._template({ name }).is({ template }),
    )
    .then(Templating.renderTemplate({
      template,
      subject: rendering,
      context: CompletedUnoriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    })),
);

export const MissingRenderingTemplatesDiagnose = reaction(({ rendering, page, name, path }) =>
  when(RenderTracking.completeBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      RenderTracking._active({ rendering }).is({ template: name }),
      no(Templating._template({ name })),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        scope: DIAGNOSTIC_SCOPES.rendering,
        severity: "error",
        code: "TEMPLATE_NOT_FOUND",
        message: "The selected page template is not defined.",
        source: path,
      }),
    ),
);

/** Retain the exact layout template tree as page inputs. */
export const RenderedLayoutsTrackTemplates = reaction(({ page, attempt, rendering, used, template, attemptDependency }) =>
  when(Templating.renderTemplate({ subject: attempt }).responds({ rendering }))
    .where(
      RenderTracking._active({ rendering: attempt }).is({ subject: page, dependencyAttempt: attemptDependency }),
      Templating._tree({ owner: rendering }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(DependencyTracking.recordDependency({ subject: page, attempt: attemptDependency, input: template })),
);

/** The layout output gets a second reference pass so site-base rebasing is final. */
export const RenderedLayoutsScan = reaction(({ rendering, output }) =>
  when(Templating.renderTemplate({ subject: rendering }).responds({ output }))
    .where(RenderTracking._active({ rendering }))
    .then(Referencing.scan({ subject: rendering, part: PARTS.layout, text: output })),
);

/** Both immediate and answered layout scans converge on one observable settlement transition. */
export const EmptyLayoutScansSettleRendering = reaction(({ rendering }) =>
  when(Referencing.scan({ subject: rendering, part: PARTS.layout }).responds({ completed: true }))
    .where(RenderTracking._active({ rendering }))
    .then(RenderTracking.completeLayout({ rendering })),
);

export const FinishedLayoutAnswersSettleRendering = reaction(({ rendering }) =>
  when(
    Referencing.resolve({}).responds({
      subject: rendering,
      part: PARTS.layout,
      completed: true,
    }),
  )
    .where(RenderTracking._active({ rendering }))
    .then(RenderTracking.completeLayout({ rendering })),
);

/** Commit a completed page attempt only while it remains the latest rendering. */
export const SettledLayoutsStagePageOutput = reaction(
  ({ rendering, page, text, address, path, emissionAttempt }) =>
  when(RenderTracking.completeLayout({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      RenderTracking._latest({ subject: page }).is({ rendering, stage: "completed", emissionAttempt }),
      Referencing._finished({ subject: rendering, part: PARTS.layout }).is({ text }),
      Routing._address({ owner: page }).is({ address }),
      AddressOutputPath({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer: page, attempt: emissionAttempt, path, content: text, medium: "text/html" })),
);

export const IntendedPageOutputsCommit = reaction(({ page, rendering, emissionAttempt }) =>
  when(Emitting.intend({ producer: page, attempt: emissionAttempt }).responds({}))
    .where(
      earlier(RenderTracking.completeLayout, { rendering }, { subject: page, transitioned: true }),
      RenderTracking._latest({ subject: page }).is({ rendering, stage: "completed", emissionAttempt }),
    )
    .then(Emitting.commitAttempt({ producer: page, attempt: emissionAttempt })),
);

export const CommittedPageOutputsSettleDependencies = reaction(
  ({ page, rendering, emissionAttempt, dependencyAttempt }) =>
  when(Emitting.commitAttempt({ producer: page, attempt: emissionAttempt }).responds({}))
    .where(
      earlier(RenderTracking.completeLayout, { rendering }, { subject: page, transitioned: true }),
      RenderTracking._latest({ subject: page }).is({ rendering, stage: "completed", emissionAttempt, dependencyAttempt }),
    )
    .then(DependencyTracking.settleAttempt({ subject: page, attempt: dependencyAttempt })),
);

export const RenderingBeginningsDiagnose = reaction(({ page, error, detail, path, dependencyAttempt, emissionAttempt }) =>
  when(RenderTracking.begin({ subject: page, dependencyAttempt, emissionAttempt }).refuses({ error, detail }))
    .where(
      DependencyTracking._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
      Emitting._open({ producer: page }).is({ attempt: emissionAttempt }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const RenderingBeginningsAbortEmission = reaction(({ page, emissionAttempt }) =>
  when(RenderTracking.begin({ subject: page, emissionAttempt }).refuses({}))
    .where(
      earlier(Emitting.beginAttempt, { producer: page }, { attempt: emissionAttempt }),
      Emitting._open({ producer: page }).is({ attempt: emissionAttempt }),
    )
    .then(Emitting.abortAttempt({ producer: page, attempt: emissionAttempt })),
);

export const RenderingBeginningsAbandonDependencies = reaction(({ page, dependencyAttempt, error }) =>
  when(RenderTracking.begin({ subject: page, dependencyAttempt }).refuses({ error }))
    .where(
      earlier(DependencyTracking.beginAttempt, { subject: page }, { attempt: dependencyAttempt }),
      DependencyTracking._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
    )
    .then(DependencyTracking.abandonAttempt({ subject: page, attempt: dependencyAttempt })),
);

/** A reported page error terminates every owner-local attempt for that page. */
export const RenderingDiagnosticsFailActiveAttempts = reaction(
  ({ path, code, root, page, rendering }) =>
    when(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code, source: path }).responds({}))
      .where(
        Filing._named({ name: ROOTS.content }).is({ root }),
        Filing._under({ root, prefix: "" }).is({ file: page, path }),
        RenderTracking._latest({ subject: page }).is({ rendering }),
        RenderTracking._active({ rendering }),
      )
      .then(RenderTracking.fail({ rendering, reason: code })),
);

/** Failure closes staged output without changing current output. */
export const FailedRenderingsAbortOutput = reaction(
  ({ rendering, page, emissionAttempt }) =>
    when(RenderTracking.fail({ rendering }).responds({ subject: page, transitioned: true }))
      .afterFlowSettles()
      .where(
        RenderTracking._latest({ subject: page }).is({ rendering, stage: "failed", emissionAttempt }),
      )
      .then(Emitting.abortAttempt({ producer: page, attempt: emissionAttempt })),
);

/** Failure also discards provisional dependency inputs while retaining the last settled graph. */
export const FailedRenderingsAbandonDependencies = reaction(
  ({ rendering, page, dependencyAttempt }) =>
    when(RenderTracking.fail({ rendering }).responds({ subject: page, transitioned: true }))
      .afterFlowSettles()
      .where(
        RenderTracking._latest({ subject: page }).is({ rendering, stage: "failed", dependencyAttempt }),
      )
      .then(DependencyTracking.abandonAttempt({ subject: page, attempt: dependencyAttempt })),
);

/** Convert expected template and conversion failures into page diagnostics. */
export const BodyTemplateFailuresDiagnose = reaction(({ page, rendering, error, detail, path, source, line, column }) =>
  when(Templating.renderSource({ subject: rendering }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: rendering, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source, line, column })),
);

export const BodyTemplateFailuresFailRendering = reaction(({ rendering, error }) =>
  when(Templating.renderSource({ subject: rendering }).refuses({ error }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._active({ rendering }),
    )
    .then(RenderTracking.fail({ rendering, reason: error })),
);

export const BodyConversionFailuresDiagnose = reaction(({ page, rendering, error, detail, path }) =>
  when(Converting.convert({ subject: rendering, part: PARTS.body }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const LayoutTemplateFailuresDiagnose = reaction(({ page, rendering, error, detail, path, source, line, column }) =>
  when(Templating.renderTemplate({ subject: rendering }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: rendering, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source, line, column })),
);

export const LayoutTemplateFailuresFailRendering = reaction(({ rendering, error }) =>
  when(Templating.renderTemplate({ subject: rendering }).refuses({ error }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._active({ rendering }),
    )
    .then(RenderTracking.fail({ rendering, reason: error })),
);

/** Output collisions and other staging failures must block reconciliation. */
export const PageAssetEmissionFailuresDiagnose = reaction(({ page, pageRendering, emissionAttempt, error, detail, path }) =>
  when(Emitting.intend({ producer: page, attempt: emissionAttempt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._latest({ subject: page }).is({ rendering: pageRendering, emissionAttempt }),
      RenderTracking._active({ rendering: pageRendering }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const PageEmissionFailuresDiagnose = reaction(({ page, emissionAttempt, error, detail, path }) =>
  when(Emitting.intend({ producer: page, attempt: emissionAttempt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      RenderTracking._latest({ subject: page }).is({ stage: "completed", emissionAttempt }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);
