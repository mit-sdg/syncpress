import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concept-set.ts";
import { TRUSTED_COLLECTION_EXCERPTS } from "../../concepts/templating/templating.ts";
import {
  CONTEXT_PATHS,
  DEFAULTS,
  PAGE_PATTERNS,
  PARTS,
  PATHS,
  PROFILES,
} from "./shared.ts";

const {
  Collecting,
  Composing,
  Configuring,
  Converting,
  Depending,
  Diagnosing,
  Documenting,
  Emitting,
  Filing,
  Layering,
  Matching,
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
  when(Depending.begin({ subject: page }).responds({})).then(Emitting.begin({ producer: page })),
);

/** Clear diagnostics for this source before its replacement render proceeds. */
export const RenderingAttemptsRetractDiagnostics = reaction(({ page, path }) =>
  when(Emitting.begin({ producer: page }).responds({}))
    .where(Filing._file({ file: page }).is({ path }))
    .then(Diagnosing.retract({ source: path })),
);

/** The source file is always an input of its page result. */
export const RenderingAttemptsTrackSource = reaction(({ page }) =>
  when(Emitting.begin({ producer: page }).responds({})).then(
    Depending.use({ subject: page, input: page }),
  ),
);

/** Context assembly starts only after the page's diagnostic retraction settles. */
export const RenderingAttemptsClearContext = reaction(({ page, path }) =>
  when(Diagnosing.retract({ source: path }).responds({}))
    .where(
      earlier(Emitting.begin, { producer: page }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Composing.clear({ subject: page, part: PARTS.context })),
);

export const ClearedContextsSetSite = reaction(({ page, configuration, site }) =>
  when(Composing.clear({ subject: page, part: PARTS.context }).responds({}))
    .where(
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
    )
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.site,
        value: site,
      }),
    ),
);

export const SiteContextsSetCollections = reaction(({ page, collections }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.site,
    }).responds({}),
  )
    .where(Collecting._catalog({}).is({ collections }))
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.collections,
        value: collections,
      }),
    ),
);

export const CollectionContextsSetPageData = reaction(({ page, data }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.collections,
    }).responds({}),
  )
    .where(Layering._resolved({ subject: page }).is({ values: data }))
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageData,
        value: data,
      }),
    ),
);

/** Context URLs remain unbased until the final HTML reference pass. */
export const PageDataContextsSetUrl = reaction(({ page, address }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageData,
    }).responds({}),
  )
    .where(Routing._address({ owner: page }).is({ address }))
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageUrl,
        value: address,
      }),
    ),
);

/** Canonical URLs are available to layouts only when the site opted into an origin. */
export const PageUrlContextsSetCanonicalUrl = reaction(({ page, address, url }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageUrl,
    }).responds({}),
  )
    .where(
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }).is({ url }),
    )
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageCanonicalUrl,
        value: url,
      }),
    ),
);

export const CanonicalContextsSetSourcePath = reaction(({ page, path }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageCanonicalUrl,
    }).responds({}),
  )
    .where(Filing._file({ file: page }).is({ path }))
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageSourcePath,
        value: path,
      }),
    ),
);

export const UnoriginatedPageUrlsSetSourcePath = reaction(({ page, address, path }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageUrl,
    }).responds({}),
  )
    .where(
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageSourcePath,
        value: path,
      }),
    ),
);

/** Treat the authored document body as untrusted Liquid input. */
export const AuthoredBodiesFill = reaction(({ page, body, bodyLine, context, path }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageSourcePath,
    }).responds({}),
  )
    .where(
      Documenting._document({ subject: page }).is({ body, bodyLine }),
      Composing._record({ subject: page, part: PARTS.context }).is({ values: context }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Templating.fill({
      subject: page,
      source: body,
      context,
      trusted: [TRUSTED_COLLECTION_EXCERPTS],
      sourceName: path,
      sourceLine: bodyLine,
    })),
);

/** Honor an explicit page conversion profile. */
export const ConfiguredBodiesConvert = reaction(({ page, output, markup, profile }) =>
  when(Templating.fill({ subject: page }).responds({ output }))
    .where(
      Layering._value({ subject: page, path: PATHS.buildMarkup }).is({ value: markup }),
      Converting._profile({ name: markup }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.body, profile, source: output })),
);

/** Markdown is the default body profile for Markdown source files. */
export const MarkdownBodiesConvert = reaction(({ page, output, path, pattern, profile }) =>
  when(Templating.fill({ subject: page }).responds({ output }))
    .where(
      no(Layering._value({ subject: page, path: PATHS.buildMarkup })),
      Filing._file({ file: page }).is({ path }),
      Matching._compiled({ text: PAGE_PATTERNS.markdown }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      Converting._profile({ name: PROFILES.markdown }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.body, profile, source: output })),
);

/** HTML source files use the verbatim default profile. */
export const HtmlBodiesConvert = reaction(({ page, output, path, pattern, profile }) =>
  when(Templating.fill({ subject: page }).responds({ output }))
    .where(
      no(Layering._value({ subject: page, path: PATHS.buildMarkup })),
      Filing._file({ file: page }).is({ path }),
      Matching._compiled({ text: PAGE_PATTERNS.html }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      Converting._profile({ name: PROFILES.verbatim }).is({ profile }),
    )
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

/** A scan with no references finishes the body immediately. */
export const EmptyBodyScansSetContent = reaction(({ page, text }) =>
  when(Referencing.scan({ subject: page, part: PARTS.body }).responds({ completed: true }))
    .where(Referencing._finished({ subject: page, part: PARTS.body }).is({ text }))
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageContent,
        value: text,
      }),
    ),
);

/** The last body-reference answer supplies trusted page content. */
export const FinishedBodyAnswersSetContent = reaction(({ page, text }) =>
  when(
    Referencing.answer({}).responds({
      subject: page,
      part: PARTS.body,
      completed: true,
    }),
  )
    .where(Referencing._finished({ subject: page, part: PARTS.body }).is({ text }))
    .then(
      Composing.set({
        subject: page,
        part: PARTS.context,
        path: CONTEXT_PATHS.pageContent,
        value: text,
      }),
    ),
);

/** Render a configured layout and trust only the completed body HTML path. */
export const ConfiguredLayoutsRender = reaction(({ page, name, template, context }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageContent,
    }).responds({}),
  )
    .where(
      Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
      Templating._template({ name }).is({ template }),
      Composing._record({ subject: page, part: PARTS.context }).is({ values: context }),
    )
    .then(
      Templating.render({
        template,
        subject: page,
        context,
        trusted: [CONTEXT_PATHS.pageContent, TRUSTED_COLLECTION_EXCERPTS],
      }),
    ),
);

/** Use the site default layout when the page has no configured override. */
export const DefaultLayoutsRender = reaction(({ page, template, context }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageContent,
    }).responds({}),
  )
    .where(
      no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
      Templating._template({ name: DEFAULTS.template }).is({ template }),
      Composing._record({ subject: page, part: PARTS.context }).is({ values: context }),
    )
    .then(
      Templating.render({
        template,
        subject: page,
        context,
        trusted: [CONTEXT_PATHS.pageContent, TRUSTED_COLLECTION_EXCERPTS],
      }),
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
  when(Templating.render({ subject: page }).responds({ output })).then(
    Referencing.scan({ subject: page, part: PARTS.layout, text: output }),
  ),
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

/** A selected template that was never defined is an authored build error. */
export const MissingConfiguredLayoutsDiagnose = reaction(({ page, name, path }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageContent,
    }).responds({}),
  )
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      Layering._value({ subject: page, path: PATHS.buildTemplate }).is({ value: name }),
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

export const MissingDefaultLayoutsDiagnose = reaction(({ page, path }) =>
  when(
    Composing.set({
      subject: page,
      part: PARTS.context,
      path: CONTEXT_PATHS.pageContent,
    }).responds({}),
  )
    .where(
      earlier(Phasing.advance, {}, { phase: "render" }),
      no(Layering._value({ subject: page, path: PATHS.buildTemplate })),
      no(Templating._template({ name: DEFAULTS.template })),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "TEMPLATE_NOT_FOUND",
        message: "The default page template is not defined.",
        source: path,
      }),
    ),
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
