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
  Depending,
  Diagnosing,
  Documenting,
  Emitting,
  Filing,
  Layering,
  Phasing,
  Referencing,
  Rendering,
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
      Rendering._all({}).is({ rendering, subject: page, stage: "failed", emissionAttempt }),
      Rendering._latest({ subject: page }).is({ rendering }),
      Emitting._open({ producer: page }).is({ attempt: emissionAttempt }),
    ),
    where(
      Rendering._all({}).is({ rendering, subject: page, stage: "failed", dependencyAttempt }),
      Rendering._latest({ subject: page }).is({ rendering }),
      Depending._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
      Depending._state({ subject: page }).is({ state: "building" }),
    ),
  ],
).many();

/** A newly routed page receives exact owner attempts before later phases inspect it. */
export const ClaimedRoutesBeginPageDependencies = reaction(({ page }) =>
  when(Routing.claim({ owner: page }).responds({}))
    .where(earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }))
    .then(Depending.begin({ subject: page })),
);

export const PageDependenciesOpenEmission = reaction(({ page }) =>
  when(Depending.begin({ subject: page }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
      Filing._file({ file: page }),
    )
    .then(Emitting.begin({ producer: page })),
);

export const PageEmissionsBeginRendering = reaction(
  ({ page, emissionAttempt, dependencyAttempt, path, data, profile, template }) =>
    when(Emitting.begin({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(Depending.begin, { subject: page }, { attempt: dependencyAttempt }),
        earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Depending._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        computations.pageRenderingSelectionHasValidity({ path, data, valid: true }),
        compute(computations.pageRenderingProfile, { path, data }, profile),
        compute(computations.pageRenderingTemplate, { path, data }, template),
      )
      .then(Rendering.begin({ subject: page, path, profile, template, dependencyAttempt, emissionAttempt })),
);

export const InvalidPageRenderingSelectionsDiagnose = reaction(
  ({ page, emissionAttempt, path, data, error, detail }) =>
    when(Emitting.begin({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(Depending.begin, { subject: page }, {}),
        earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        InvalidPageRenderingSelection({ path, data }).is({ error, detail }),
      )
      .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const InvalidPageRenderingSelectionsAbortOutput = reaction(
  ({ page, emissionAttempt, path, data }) =>
    when(Emitting.begin({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(Depending.begin, { subject: page }, {}),
        earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        InvalidPageRenderingSelection({ path, data }),
      )
      .then(Emitting.abort({ producer: page, attempt: emissionAttempt })),
);

export const InvalidPageRenderingSelectionsAbandonDependencies = reaction(
  ({ page, emissionAttempt, dependencyAttempt, path, data }) =>
    when(Emitting.begin({ producer: page }).responds({ attempt: emissionAttempt }))
      .where(
        earlier(Depending.begin, { subject: page }, { attempt: dependencyAttempt }),
        earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
        Filing._file({ file: page }).is({ path }),
        Layering._resolved({ subject: page }).is({ values: data }),
        InvalidPageRenderingSelection({ path, data }),
      )
      .then(Depending.abandon({ subject: page, attempt: dependencyAttempt })),
);

/** Clear diagnostics for this source before its replacement render proceeds. */
export const RenderingAttemptsRetractDiagnostics = reaction(({ page, path }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "render", transitioned: true }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Rendering._latest({ subject: page }).is({ stage: "started" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.rendering, source: path })),
);

/** The exact source is retained before its body can be filled. */
export const RetractedRenderingAttemptsTrackSource = reaction(({ page, path, dependencyAttempt }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.rendering, source: path }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Routing._claims({}).is({ owner: page }),
      Rendering._latest({ subject: page }).is({ stage: "started", dependencyAttempt }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Depending.use({ subject: page, attempt: dependencyAttempt, input: page })),
);

/** Source provenance causally begins body rendering with one complete context. */
export const TrackedRenderingSourcesFillBodies = reaction(
  ({ page, rendering, dependencyAttempt, body, bodyLine, root, path, address }) =>
  when(Depending.use({ subject: page, attempt: dependencyAttempt, input: page }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._latest({ subject: page }).is({ rendering, stage: "started", dependencyAttempt }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
      Documenting._document({ subject: page }).is({ body, bodyLine }),
      Routing._address({ owner: page }).is({ address }),
    )
    .then(
      where(AbsoluteSiteUrl({ address }))
        .then(Templating.fill({
          subject: rendering,
          source: body,
          context: OriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
          trusted: [TRUSTED_COLLECTION_EXCERPTS],
          sourceName: path,
          sourceLine: bodyLine,
        }))
        .named("originated"),
      where(no(AbsoluteSiteUrl({ address })))
        .then(Templating.fill({
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
  when(Templating.fill({ subject: rendering }).responds({}))
    .where(
      Rendering._active({ rendering }).is({ subject: page, profile: name }),
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
  when(Templating.fill({ subject: rendering }).responds({ output }))
    .where(
      Rendering._active({ rendering }).is({ profile: name }),
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
  when(Templating.fill({ subject: rendering }).responds({ filling }))
    .where(
      Rendering._active({ rendering }).is({ subject: page, dependencyAttempt }),
      Templating._tree({ owner: filling }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, attempt: dependencyAttempt, input: template })),
);

/** Both immediate and answered body scans converge on one observable settlement transition. */
export const EmptyBodyScansSettleRendering = reaction(({ rendering }) =>
  when(Referencing.scan({ subject: rendering, part: PARTS.body }).responds({ completed: true }))
    .where(earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }))
    .then(Rendering.settleBody({ rendering })),
);

export const FinishedBodyAnswersSettleRendering = reaction(({ rendering }) =>
  when(Referencing.answer({}).responds({ subject: rendering, part: PARTS.body, completed: true }))
    .where(earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }))
    .then(Rendering.settleBody({ rendering })),
);

/** A newly settled body chooses exactly one originated layout or diagnostic case. */
export const SettledBodiesRenderOriginatedPages = reaction(({ rendering, page, address, name, template }) =>
  when(Rendering.settleBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Routing._address({ owner: page }).is({ address }),
      AbsoluteSiteUrl({ address }),
      Rendering._active({ rendering }).is({ template: name }),
      Templating._template({ name }).is({ template }),
    )
    .then(Templating.render({
      template,
      subject: rendering,
      context: CompletedOriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    })),
);

/** A newly settled body preserves canonical-key omission for unoriginated pages. */
export const SettledBodiesRenderUnoriginatedPages = reaction(({ rendering, page, address, name, template }) =>
  when(Rendering.settleBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Routing._address({ owner: page }).is({ address }),
      no(AbsoluteSiteUrl({ address })),
      Rendering._active({ rendering }).is({ template: name }),
      Templating._template({ name }).is({ template }),
    )
    .then(Templating.render({
      template,
      subject: rendering,
      context: CompletedUnoriginatedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    })),
);

export const MissingRenderingTemplatesDiagnose = reaction(({ rendering, page, name, path }) =>
  when(Rendering.settleBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Rendering._active({ rendering }).is({ template: name }),
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
  when(Templating.render({ subject: attempt }).responds({ rendering }))
    .where(
      Rendering._active({ rendering: attempt }).is({ subject: page, dependencyAttempt: attemptDependency }),
      Templating._tree({ owner: rendering }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, attempt: attemptDependency, input: template })),
);

/** The layout output gets a second reference pass so site-base rebasing is final. */
export const RenderedLayoutsScan = reaction(({ rendering, output }) =>
  when(Templating.render({ subject: rendering }).responds({ output }))
    .where(Rendering._active({ rendering }))
    .then(Referencing.scan({ subject: rendering, part: PARTS.layout, text: output })),
);

/** Both immediate and answered layout scans converge on one observable settlement transition. */
export const EmptyLayoutScansSettleRendering = reaction(({ rendering }) =>
  when(Referencing.scan({ subject: rendering, part: PARTS.layout }).responds({ completed: true }))
    .where(Rendering._active({ rendering }))
    .then(Rendering.settleLayout({ rendering })),
);

export const FinishedLayoutAnswersSettleRendering = reaction(({ rendering }) =>
  when(
    Referencing.answer({}).responds({
      subject: rendering,
      part: PARTS.layout,
      completed: true,
    }),
  )
    .where(Rendering._active({ rendering }))
    .then(Rendering.settleLayout({ rendering })),
);

/** Commit a completed page attempt only while it remains the latest rendering. */
export const SettledLayoutsStagePageOutput = reaction(
  ({ rendering, page, text, address, path, emissionAttempt }) =>
  when(Rendering.settleLayout({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Rendering._latest({ subject: page }).is({ rendering, stage: "completed", emissionAttempt }),
      Referencing._finished({ subject: rendering, part: PARTS.layout }).is({ text }),
      Routing._address({ owner: page }).is({ address }),
      AddressOutputPath({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer: page, attempt: emissionAttempt, path, content: text, medium: "text/html" })),
);

export const IntendedPageOutputsCommit = reaction(({ page, rendering, emissionAttempt }) =>
  when(Emitting.intend({ producer: page, attempt: emissionAttempt }).responds({}))
    .where(
      earlier(Rendering.settleLayout, { rendering }, { subject: page, transitioned: true }),
      Rendering._latest({ subject: page }).is({ rendering, stage: "completed", emissionAttempt }),
    )
    .then(Emitting.commit({ producer: page, attempt: emissionAttempt })),
);

export const CommittedPageOutputsSettleDependencies = reaction(
  ({ page, rendering, emissionAttempt, dependencyAttempt }) =>
  when(Emitting.commit({ producer: page, attempt: emissionAttempt }).responds({}))
    .where(
      earlier(Rendering.settleLayout, { rendering }, { subject: page, transitioned: true }),
      Rendering._latest({ subject: page }).is({ rendering, stage: "completed", emissionAttempt, dependencyAttempt }),
    )
    .then(Depending.settle({ subject: page, attempt: dependencyAttempt })),
);

export const RenderingBeginningsDiagnose = reaction(({ page, error, detail, path, dependencyAttempt, emissionAttempt }) =>
  when(Rendering.begin({ subject: page, dependencyAttempt, emissionAttempt }).refuses({ error, detail }))
    .where(
      Depending._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
      Emitting._open({ producer: page }).is({ attempt: emissionAttempt }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const RenderingBeginningsAbortEmission = reaction(({ page, emissionAttempt }) =>
  when(Rendering.begin({ subject: page, emissionAttempt }).refuses({}))
    .where(
      earlier(Emitting.begin, { producer: page }, { attempt: emissionAttempt }),
      Emitting._open({ producer: page }).is({ attempt: emissionAttempt }),
    )
    .then(Emitting.abort({ producer: page, attempt: emissionAttempt })),
);

export const RenderingBeginningsAbandonDependencies = reaction(({ page, dependencyAttempt, error }) =>
  when(Rendering.begin({ subject: page, dependencyAttempt }).refuses({ error }))
    .where(
      earlier(Depending.begin, { subject: page }, { attempt: dependencyAttempt }),
      Depending._attempt({ subject: page }).is({ attempt: dependencyAttempt }),
    )
    .then(Depending.abandon({ subject: page, attempt: dependencyAttempt })),
);

/** A reported page error terminates every owner-local attempt for that page. */
export const RenderingDiagnosticsFailActiveAttempts = reaction(
  ({ path, code, root, page, rendering }) =>
    when(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code, source: path }).responds({}))
      .where(
        Filing._named({ name: ROOTS.content }).is({ root }),
        Filing._under({ root, prefix: "" }).is({ file: page, path }),
        Rendering._latest({ subject: page }).is({ rendering }),
        Rendering._active({ rendering }),
      )
      .then(Rendering.fail({ rendering, reason: code })),
);

/** Failure closes staged output without changing current output. */
export const FailedRenderingsAbortOutput = reaction(
  ({ rendering, page, emissionAttempt }) =>
    when(Rendering.fail({ rendering }).responds({ subject: page, transitioned: true }))
      .afterFlowSettles()
      .where(
        Rendering._latest({ subject: page }).is({ rendering, stage: "failed", emissionAttempt }),
      )
      .then(Emitting.abort({ producer: page, attempt: emissionAttempt })),
);

/** Failure also discards provisional dependency inputs while retaining the last settled graph. */
export const FailedRenderingsAbandonDependencies = reaction(
  ({ rendering, page, dependencyAttempt }) =>
    when(Rendering.fail({ rendering }).responds({ subject: page, transitioned: true }))
      .afterFlowSettles()
      .where(
        Rendering._latest({ subject: page }).is({ rendering, stage: "failed", dependencyAttempt }),
      )
      .then(Depending.abandon({ subject: page, attempt: dependencyAttempt })),
);

/** Convert expected template and conversion failures into page diagnostics. */
export const BodyTemplateFailuresDiagnose = reaction(({ page, rendering, error, detail, path, source, line, column }) =>
  when(Templating.fill({ subject: rendering }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: rendering, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source, line, column })),
);

export const BodyTemplateFailuresFailRendering = reaction(({ rendering, error }) =>
  when(Templating.fill({ subject: rendering }).refuses({ error }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._active({ rendering }),
    )
    .then(Rendering.fail({ rendering, reason: error })),
);

export const BodyConversionFailuresDiagnose = reaction(({ page, rendering, error, detail, path }) =>
  when(Converting.convert({ subject: rendering, part: PARTS.body }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const LayoutTemplateFailuresDiagnose = reaction(({ page, rendering, error, detail, path, source, line, column }) =>
  when(Templating.render({ subject: rendering }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: rendering, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source, line, column })),
);

export const LayoutTemplateFailuresFailRendering = reaction(({ rendering, error }) =>
  when(Templating.render({ subject: rendering }).refuses({ error }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._active({ rendering }),
    )
    .then(Rendering.fail({ rendering, reason: error })),
);

/** Output collisions and other staging failures must block reconciliation. */
export const PageAssetEmissionFailuresDiagnose = reaction(({ page, pageRendering, emissionAttempt, error, detail, path }) =>
  when(Emitting.intend({ producer: page, attempt: emissionAttempt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._latest({ subject: page }).is({ rendering: pageRendering, emissionAttempt }),
      Rendering._active({ rendering: pageRendering }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const PageEmissionFailuresDiagnose = reaction(({ page, emissionAttempt, error, detail, path }) =>
  when(Emitting.intend({ producer: page, attempt: emissionAttempt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "render", transitioned: true }),
      Rendering._latest({ subject: page }).is({ stage: "completed", emissionAttempt }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);
