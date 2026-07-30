import { each, form, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { DEFAULTS, PAGE_PATTERNS, PARTS, PATHS, ROOTS } from "./shared.ts";

const {
  Cataloging,
  Configuring,
  Converting,
  Depending,
  Diagnosing,
  Emitting,
  Filing,
  Layering,
  Matching,
  Referencing,
  Rendering,
  Routing,
} = concepts;

/** Authored content files supported by the document pipeline. */
export const ContentDocumentFile = view(
  "content document file",
  (_inputs, { root, file, path, text }, { pattern }) => [
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Matching._compiled({ text: PAGE_PATTERNS.markdown }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      Filing._text({ file }).is({ text }),
    ),
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Matching._compiled({ text: PAGE_PATTERNS.html }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      Filing._text({ file }).is({ text }),
    ),
  ],
).many();

/** The explicit or extension-derived conversion profile selected for a page. */
export const EffectiveConversionProfile = view(
  "effective conversion profile of page (page)",
  ({ page }, { profile }, { name }) =>
    where(
      Rendering._latest({ subject: page }).is({ profile: name }),
      Converting._profile({ name }).is({ profile }),
    ),
).optional();

export const MarkdownSettings = view(
  "markdown settings of configuration (root)",
  ({ root }, { extensions, raw, separator }, _bindings) =>
    where(
      Configuring._values({
        node: root,
        path: PATHS.markdownExtensions,
        otherwise: [...DEFAULTS.markdownExtensions],
      }).is({ values: extensions }),
      Configuring._scalar({ node: root, path: PATHS.markdownRaw, otherwise: DEFAULTS.markdownRaw }).is({
        value: raw,
      }),
      Configuring._scalar({ node: root, path: PATHS.markdownExcerptSeparator, otherwise: "" }).is({
        value: separator,
      }),
    ),
).one();

export const VerbatimSettings = view(
  "verbatim settings of configuration (root)",
  ({ root }, { separator }, _bindings) =>
    where(
      Configuring._scalar({ node: root, path: PATHS.markdownExcerptSeparator, otherwise: "" }).is({
        value: separator,
      }),
    ),
).one();

export const DefaultPatternSetting = view(
  "default pattern setting of configuration (root)",
  ({ root }, { rule, text }, { defaults }) =>
    where(
      Configuring._at({ node: root, path: PATHS.defaults }).is({ found: defaults }),
      Configuring._items({ node: defaults }).is({ item: rule }),
      Configuring._at({ node: rule, path: PATHS.defaultMatch }).is({ value: text }),
    ),
).many();

export const CollectionPatternSetting = view(
  "collection pattern setting of configuration (root)",
  ({ root }, { rule, text }, { collections }) =>
    where(
      Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ child: rule }),
      Configuring._at({ node: rule, path: PATHS.collectionMatch }).is({ value: text }),
    ),
).many();

export const CollectionDeclarationSetting = view(
  "collection declaration setting of configuration (root)",
  ({ root }, { name, rule, direction, sort }, { collections }) =>
    where(
      Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ key: name, child: rule }),
      Configuring._scalar({ node: rule, path: PATHS.collectionSortOrder, otherwise: "asc" }).is({
        value: direction,
      }),
      Configuring._scalar({ node: rule, path: PATHS.collectionSortBy, otherwise: null }).is({ value: sort }),
    ),
).many();

export const PageRenderContext = former(
  "the originated render context of page (page)",
  ({ rendering }, { page, configuration, site, collections, data, address, canonicalUrl, path }) =>
    where(
      Rendering._attempt({ rendering }).is({ subject: page }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
      Cataloging._record({}).is({ catalogs: collections }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }).is({ url: canonicalUrl }),
      Filing._file({ file: page }).is({ path }),
    ).form({
      collections,
      page: form({ canonicalUrl, data, source: form({ path }), url: address }),
      site,
    }),
);

export const UnoriginatedPageRenderContext = former(
  "the unoriginated render context of page (page)",
  ({ rendering }, { page, configuration, site, collections, data, address, path }) =>
    where(
      Rendering._attempt({ rendering }).is({ subject: page }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
      Cataloging._record({}).is({ catalogs: collections }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
      Filing._file({ file: page }).is({ path }),
    ).form({
      collections,
      page: form({ data, source: form({ path }), url: address }),
      site,
    }),
);

export const CompletedPageRenderContext = former(
  "the originated completed render context of page (page)",
  ({ rendering }, { page, configuration, site, collections, data, address, canonicalUrl, path, content }) =>
    where(
      Rendering._attempt({ rendering }).is({ subject: page }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
      Cataloging._record({}).is({ catalogs: collections }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }).is({ url: canonicalUrl }),
      Filing._file({ file: page }).is({ path }),
      Referencing._finished({ subject: rendering, part: PARTS.body }).is({ text: content }),
    ).form({
      collections,
      page: form({ canonicalUrl, content, data, source: form({ path }), url: address }),
      site,
    }),
);

export const CompletedUnoriginatedPageRenderContext = former(
  "the unoriginated completed render context of page (page)",
  ({ rendering }, { page, configuration, site, collections, data, address, path, content }) =>
    where(
      Rendering._attempt({ rendering }).is({ subject: page }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
      Cataloging._record({}).is({ catalogs: collections }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
      Filing._file({ file: page }).is({ path }),
      Referencing._finished({ subject: rendering, part: PARTS.body }).is({ text: content }),
    ).form({
      collections,
      page: form({ content, data, source: form({ path }), url: address }),
      site,
    }),
);

export const PublicationCard = former(
  "the publication card of page (page)",
  ({ page }, { data, address, excerpt, root, path }) =>
    where(
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      whether(Converting._excerpt({ subject: page, part: PARTS.excerpt }).is({ excerpt })),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    ).form({
      data,
      excerpt,
      source: form({ path }),
      url: address,
    }),
);

/** Current operational evidence used by page inspection. */
export const PageOperationalInspection = former(
  "the operational inspection of page (owner)",
  (
    { owner },
    {
       catalog,
      name,
      index,
      rendering,
      renderingPath,
       renderingProfile,
       renderingTemplate,
       renderingStage,
       bodySource,
       layoutSource,
       state,
      reason,
      input,
      outputPath,
      digest,
      medium,
      claimOwner,
      address,
      diagnostic,
      severity,
      code,
      message,
      source,
      line,
      column,
      relatedSource,
      relatedLine,
      relatedColumn,
      note,
    },
  ) =>
    form({
      rendering: where(
        whether(
          Rendering._latest({ subject: owner }).is({
            rendering,
            path: renderingPath,
            profile: renderingProfile,
            template: renderingTemplate,
            stage: renderingStage,
          }),
        ),
      ).form({
        attempt: rendering,
        path: renderingPath,
        profile: renderingProfile,
        template: renderingTemplate,
        stage: renderingStage,
        body: where(
          whether(Referencing._finished({ subject: rendering, part: PARTS.body }).is({ source: bodySource })),
        ).form({ source: bodySource }),
        layout: where(
          whether(Referencing._finished({ subject: rendering, part: PARTS.layout }).is({ source: layoutSource })),
        ).form({ source: layoutSource }),
      }),
      memberships: each(Cataloging._membership({ item: owner }).is({ catalog, name }))
        .where(Cataloging._position({ catalog, item: owner }).is({ index }))
        .form({ collection: catalog, name, index }),
      dependencies: where(
        Depending._state({ subject: owner }).is({ state }),
        whether(Depending._reason({ subject: owner }).is({ reason })),
      ).form({
        state,
        reason,
        inputs: each(Depending._uses({ subject: owner }).is({ input })).form({ input }),
      }),
      outputs: each(Emitting._byProducer({ producer: owner }).is({ path: outputPath, digest, medium })).form({
        path: outputPath,
        digest,
        medium,
      }),
      claims: each(Routing._claims({}).is({ owner: claimOwner, address })).form({ owner: claimOwner, address }),
      diagnostics: each(
        Diagnosing._all({}).is({ diagnostic, severity, code, message, source, line, column }),
      ).form({
        diagnostic,
        severity,
        code,
        message,
        source,
        line,
        column,
        related: each(
          Diagnosing._related({ diagnostic }).is({
            source: relatedSource,
            line: relatedLine,
            column: relatedColumn,
            note,
          }),
        ).form({ source: relatedSource, line: relatedLine, column: relatedColumn, note }),
      }),
    }),
);
