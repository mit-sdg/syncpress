import { earlier, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { TRUSTED_COLLECTION_EXCERPTS } from "../concepts/templating/templating.ts";
import { DEFAULTS, PAGE_CONTENT_PATH, PARTS, PATHS } from "./shared.ts";
import {
  CompletedPageRenderContext,
  CompletedUnoriginatedPageRenderContext,
  EffectiveConversionProfile,
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
  Layering,
  Phasing,
  Referencing,
  Routing,
  Templating,
} = concepts;

/** Begin fresh page and output attempts for every routed document in the render phase. */
export const RoutedDocumentsBeginRendering = reaction(({ page }) =>
  when(Phasing.advance({}).responds({ phase: "render" }))
    .where(Routing._claims({}).is({ owner: page }))
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
export const RenderingAttemptsFillAuthoredBodies = reaction(({ page, body, bodyLine, path, address }) =>
  when(Diagnosing.retract({ source: path }).responds({}))
    .where(
      earlier(Emitting.begin, { producer: page }),
      Documenting._document({ subject: page }).is({ body, bodyLine }),
      Filing._file({ file: page }).is({ path }),
      Routing._address({ owner: page }).is({ address }),
    )
    .then(
      where(Routing._absolute({ address }))
        .then(Templating.fill({
          subject: page,
          source: body,
          context: PageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [TRUSTED_COLLECTION_EXCERPTS],
          sourceName: path,
          sourceLine: bodyLine,
        }))
        .named("originated"),
      where(no(Routing._absolute({ address })))
        .then(Templating.fill({
          subject: page,
          source: body,
          context: UnoriginatedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [TRUSTED_COLLECTION_EXCERPTS],
          sourceName: path,
          sourceLine: bodyLine,
        }))
        .named("unoriginated"),
    ),
);

/** Honor an explicit page conversion profile. */
export const FilledBodiesConvert = reaction(({ page, output, profile }) =>
  when(Templating.fill({ subject: page }).responds({ output }))
    .where(EffectiveConversionProfile({ page }).is({ profile }))
    .then(Converting.convert({ subject: page, part: PARTS.body, profile, source: output })),
);

/** Every converted body gets its own reference-resolution pass. */
export const ConvertedBodiesScan = reaction(({ page, output }) =>
  when(Converting.convert({ subject: page, part: PARTS.body }).responds({ output })).then(
    Referencing.scan({ subject: page, part: PARTS.body, text: output }),
  ),
);

/** Retain the exact body template tree as page inputs. */
export const FilledBodiesTrackTemplates = reaction(({ page, filling, used, template }) =>
  when(Templating.fill({ subject: page }).responds({ filling }))
    .where(
      Templating._tree({ owner: filling }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, input: template })),
);

/** An empty body scan chooses exactly one originated layout or diagnostic case. */
export const EmptyBodyScansRenderOriginatedPages = reaction(({ page, address, name, template, path }) =>
  when(Referencing.scan({ subject: page, part: PARTS.body }).responds({ completed: true }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }),
    )
    .then(
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        Templating._template({ name }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        Templating._template({ name: DEFAULTS.template }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("default"),
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        no(Templating._template({ name })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The selected page template is not defined.",
          source: path,
        }))
        .named("missing-configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        no(Templating._template({ name: DEFAULTS.template })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The default page template is not defined.",
          source: path,
        }))
        .named("missing-default"),
    ),
);

/** An empty body scan preserves canonical-key omission for unoriginated pages. */
export const EmptyBodyScansRenderUnoriginatedPages = reaction(({ page, address, name, template, path }) =>
  when(Referencing.scan({ subject: page, part: PARTS.body }).responds({ completed: true }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
    )
    .then(
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        Templating._template({ name }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedUnoriginatedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        Templating._template({ name: DEFAULTS.template }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedUnoriginatedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("default"),
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        no(Templating._template({ name })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The selected page template is not defined.",
          source: path,
        }))
        .named("missing-configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        no(Templating._template({ name: DEFAULTS.template })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The default page template is not defined.",
          source: path,
        }))
        .named("missing-default"),
    ),
);

/** The final body-reference answer chooses one originated layout or diagnostic case. */
export const FinishedBodyAnswersRenderOriginatedPages = reaction(({ page, address, name, template, path }) =>
  when(Referencing.answer({}).responds({ subject: page, part: PARTS.body, completed: true }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }),
    )
    .then(
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        Templating._template({ name }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        Templating._template({ name: DEFAULTS.template }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("default"),
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        no(Templating._template({ name })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The selected page template is not defined.",
          source: path,
        }))
        .named("missing-configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        no(Templating._template({ name: DEFAULTS.template })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The default page template is not defined.",
          source: path,
        }))
        .named("missing-default"),
    ),
);

/** The final body-reference answer preserves omission for unoriginated pages. */
export const FinishedBodyAnswersRenderUnoriginatedPages = reaction(({ page, address, name, template, path }) =>
  when(Referencing.answer({}).responds({ subject: page, part: PARTS.body, completed: true }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
    )
    .then(
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        Templating._template({ name }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedUnoriginatedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        Templating._template({ name: DEFAULTS.template }).is({ template }),
      )
        .then(Templating.render({
          template,
          subject: page,
          context: CompletedUnoriginatedPageRenderContext({ page }) as unknown as Record<string, unknown>,
          trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
        }))
        .named("default"),
      where(
        Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
        no(Templating._template({ name })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The selected page template is not defined.",
          source: path,
        }))
        .named("missing-configured"),
      where(
        no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
        no(Templating._template({ name: DEFAULTS.template })),
        Filing._file({ file: page }).is({ path }),
      )
        .then(Diagnosing.report({
          severity: "error",
          code: "TEMPLATE_NOT_FOUND",
          message: "The default page template is not defined.",
          source: path,
        }))
        .named("missing-default"),
    ),
);

/** Retain the exact layout template tree as page inputs. */
export const RenderedLayoutsTrackTemplates = reaction(({ page, rendering, used, template }) =>
  when(Templating.render({ subject: page }).responds({ rendering }))
    .where(
      Templating._tree({ owner: rendering }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, input: template })),
);

/** The layout output gets a second reference pass so site-base rebasing is final. */
export const RenderedLayoutsScan = reaction(({ page, output }) =>
  when(Templating.render({ subject: page }).responds({ output }))
    .where(Filing._file({ file: page }))
    .then(Referencing.scan({ subject: page, part: PARTS.layout, text: output })),
);

/** A layout with no references can be committed as soon as it is scanned. */
export const EmptyLayoutScansEmit = reaction(({ page, text, address, path }) =>
  when(Referencing.scan({ subject: page, part: PARTS.layout }).responds({ completed: true }))
    .where(
      Referencing._finished({ subject: page, part: PARTS.layout }).is({ text }),
      Routing._address({ owner: page }).is({ address }),
      Routing._file({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer: page, path, content: text, medium: "text/html" }).responds({}))
    .then(Emitting.commit({ producer: page }).responds({}))
    .then(Depending.settle({ subject: page })),
);

/** The final layout-reference answer commits the complete page attempt. */
export const FinishedLayoutAnswersEmit = reaction(({ page, text, address, path }) =>
  when(
    Referencing.answer({}).responds({
      subject: page,
      part: PARTS.layout,
      completed: true,
    }),
  )
    .where(
      Referencing._finished({ subject: page, part: PARTS.layout }).is({ text }),
      Routing._address({ owner: page }).is({ address }),
      Routing._file({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer: page, path, content: text, medium: "text/html" }).responds({}))
    .then(Emitting.commit({ producer: page }).responds({}))
    .then(Depending.settle({ subject: page })),
);

/** Convert expected template and conversion failures into page diagnostics. */
export const BodyTemplateFailuresDiagnose = reaction(({ page, error, detail, path, source, line, column }) =>
  when(Templating.fill({ subject: page }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: page, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source, line, column })),
);

export const BodyConversionFailuresDiagnose = reaction(({ page, error, detail, path }) =>
  when(Converting.convert({ subject: page, part: PARTS.body }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const LayoutTemplateFailuresDiagnose = reaction(({ page, error, detail, path, source, line, column }) =>
  when(Templating.render({ subject: page }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Filing._file({ file: page }).is({ path }),
      Templating._failureLocation({ subject: page, fallbackSource: path }).is({ source, line, column }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source, line, column })),
);

/** An explicit conversion-profile name must resolve before a page can publish. */
export const MissingConfiguredProfilesDiagnose = reaction(({ page, markup, path }) =>
  when(Templating.fill({ subject: page }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Layering._value({ subject: page, path: PATHS.buildMarkup }).is({ value: markup }),
      no(Converting._profile({ name: markup })),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "PROFILE_NOT_FOUND",
        message: "The selected body conversion profile is not defined.",
        source: path,
      }),
    ),
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
