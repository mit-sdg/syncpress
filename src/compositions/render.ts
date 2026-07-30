import { earlier, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { TRUSTED_COLLECTION_EXCERPTS } from "../concepts/templating/templating.ts";
import { PAGE_CONTENT_PATH, PARTS } from "./shared.ts";
import {
  CompletedPageRenderContext,
  CompletedUnoriginatedPageRenderContext,
  PageRenderContext,
  UnoriginatedPageRenderContext,
} from "./views.ts";

const {
  Converting,
  Depending,
  Diagnosing,
  Documenting,
  Emitting,
  Filing,
  Phasing,
  Referencing,
  Rendering,
  Routing,
  Templating,
} = concepts;

/** Begin fresh page and output attempts for every routed document in the render phase. */
export const RoutedDocumentsBeginRendering = reaction(({ page }) =>
  when(Phasing.advance({}).responds({ phase: "render" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Rendering._latest({ subject: page }).is({ stage: "started" }),
    )
    .then(Depending.begin({ subject: page })),
);

/** Open the page's complete replacement attempt before any output is staged. */
export const RenderingAttemptsOpenEmission = reaction(({ page }) =>
  when(Depending.begin({ subject: page }).responds({}))
    .where(Filing._file({ file: page }))
    .then(Emitting.begin({ producer: page })),
);

/** Clear diagnostics for this source before its replacement render proceeds. */
export const RenderingAttemptsRetractDiagnostics = reaction(({ page, path }) =>
  when(Emitting.begin({ producer: page }).responds({}))
    .where(Filing._file({ file: page }).is({ path }))
    .then(Diagnosing.retract({ source: path })),
);

/** The source file is always an input of its page result. */
export const RenderingAttemptsTrackSource = reaction(({ page }) =>
  when(Emitting.begin({ producer: page }).responds({}))
    .where(Filing._file({ file: page }))
    .then(Depending.use({ subject: page, input: page })),
);

/** Diagnostic retraction causally begins body rendering with one complete context. */
export const RenderingAttemptsFillAuthoredBodies = reaction(({ page, rendering, body, bodyLine, path, address }) =>
  when(Diagnosing.retract({ source: path }).responds({}))
    .where(
      earlier(Emitting.begin, { producer: page }),
      Rendering._latest({ subject: page }).is({ rendering }),
      Documenting._document({ subject: page }).is({ body, bodyLine }),
      Filing._file({ file: page }).is({ path }),
      Routing._address({ owner: page }).is({ address }),
    )
    .then(
      where(Routing._absolute({ address }))
        .then(Templating.fill({
          subject: rendering,
          source: body,
          context: PageRenderContext({ rendering }) as unknown as Record<string, unknown>,
          trusted: [TRUSTED_COLLECTION_EXCERPTS],
          sourceName: path,
          sourceLine: bodyLine,
        }))
        .named("originated"),
      where(no(Routing._absolute({ address })))
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
export const FilledBodiesTrackTemplates = reaction(({ page, rendering, filling, used, template }) =>
  when(Templating.fill({ subject: rendering }).responds({ filling }))
    .where(
      Rendering._active({ rendering }).is({ subject: page }),
      Templating._tree({ owner: filling }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, input: template })),
);

/** Both immediate and answered body scans converge on one observable settlement transition. */
export const EmptyBodyScansSettleRendering = reaction(({ rendering }) =>
  when(Referencing.scan({ subject: rendering, part: PARTS.body }).responds({ completed: true }))
    .where(earlier(Phasing.advance, {}, { phase: "render" }))
    .then(Rendering.settleBody({ rendering })),
);

export const FinishedBodyAnswersSettleRendering = reaction(({ rendering }) =>
  when(Referencing.answer({}).responds({ subject: rendering, part: PARTS.body, completed: true }))
    .where(earlier(Phasing.advance, {}, { phase: "render" }))
    .then(Rendering.settleBody({ rendering })),
);

/** A newly settled body chooses exactly one originated layout or diagnostic case. */
export const SettledBodiesRenderOriginatedPages = reaction(({ rendering, page, address, name, template }) =>
  when(Rendering.settleBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }),
      Rendering._active({ rendering }).is({ template: name }),
      Templating._template({ name }).is({ template }),
    )
    .then(Templating.render({
      template,
      subject: rendering,
      context: CompletedPageRenderContext({ rendering }) as unknown as Record<string, unknown>,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    })),
);

/** A newly settled body preserves canonical-key omission for unoriginated pages. */
export const SettledBodiesRenderUnoriginatedPages = reaction(({ rendering, page, address, name, template }) =>
  when(Rendering.settleBody({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
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
        severity: "error",
        code: "TEMPLATE_NOT_FOUND",
        message: "The selected page template is not defined.",
        source: path,
      }),
    ),
);

/** Retain the exact layout template tree as page inputs. */
export const RenderedLayoutsTrackTemplates = reaction(({ page, attempt, rendering, used, template }) =>
  when(Templating.render({ subject: attempt }).responds({ rendering }))
    .where(
      Rendering._active({ rendering: attempt }).is({ subject: page }),
      Templating._tree({ owner: rendering }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, input: template })),
);

/** The layout output gets a second reference pass so site-base rebasing is final. */
export const RenderedLayoutsScan = reaction(({ rendering, output }) =>
  when(Templating.render({ subject: rendering }).responds({ output }))
    .then(Referencing.scan({ subject: rendering, part: PARTS.layout, text: output })),
);

/** Both immediate and answered layout scans converge on one observable settlement transition. */
export const EmptyLayoutScansSettleRendering = reaction(({ rendering }) =>
  when(Referencing.scan({ subject: rendering, part: PARTS.layout }).responds({ completed: true }))
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
    .then(Rendering.settleLayout({ rendering })),
);

/** A newly settled layout commits the complete page attempt. */
export const SettledLayoutsEmit = reaction(({ rendering, page, text, address, path }) =>
  when(Rendering.settleLayout({ rendering }).responds({ subject: page, transitioned: true }))
    .where(
      Referencing._finished({ subject: rendering, part: PARTS.layout }).is({ text }),
      Routing._address({ owner: page }).is({ address }),
      Routing._file({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer: page, path, content: text, medium: "text/html" }).responds({}))
    .then(Emitting.commit({ producer: page }).responds({}))
    .then(Rendering.finish({ rendering }).responds({ transitioned: true }))
    .then(Depending.settle({ subject: page })),
);

/** Convert expected template and conversion failures into page diagnostics. */
export const BodyTemplateFailuresDiagnose = reaction(({ page, rendering, error, detail, path, source, line, column }) =>
  when(Templating.fill({ subject: rendering }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Rendering._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: rendering, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source, line, column })),
);

export const BodyConversionFailuresDiagnose = reaction(({ page, rendering, error, detail, path }) =>
  when(Converting.convert({ subject: rendering, part: PARTS.body }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Rendering._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const LayoutTemplateFailuresDiagnose = reaction(({ page, rendering, error, detail, path, source, line, column }) =>
  when(Templating.render({ subject: rendering }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Rendering._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: rendering, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source, line, column })),
);

/** Output collisions and other staging failures must block reconciliation. */
export const PageEmissionFailuresDiagnose = reaction(({ page, error, detail, path }) =>
  when(Emitting.intend({ producer: page }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);
