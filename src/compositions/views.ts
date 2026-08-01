import { each, form, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
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
} = conceptRefs;

/** Authored content files supported by the document pipeline. */
export const ContentDocumentFile = view(
  "content document file",
  (_inputs, { file, text }, { root, path, pattern }) => [
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

export const MarkdownSettings = view(
  "active markdown settings",
  (_inputs, { extensions, raw, separator }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
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
  "active verbatim settings",
  (_inputs, { separator }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._scalar({ node: root, path: PATHS.markdownExcerptSeparator, otherwise: "" }).is({
        value: separator,
      }),
    ),
).one();

export const DefaultPatternSetting = view(
  "active default pattern setting",
  (_inputs, { text }, { root, defaults, rule }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._at({ node: root, path: PATHS.defaults }).is({ found: defaults }),
      Configuring._items({ node: defaults }).is({ item: rule }),
      Configuring._at({ node: rule, path: PATHS.defaultMatch }).is({ value: text }),
    ),
).many();

export const CollectionSetting = view(
  "active collection setting",
  (_inputs, { name, rule, text, direction, sort }, { root, collections }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ key: name, child: rule }),
      Configuring._at({ node: rule, path: PATHS.collectionMatch }).is({ value: text }),
      Configuring._scalar({ node: rule, path: PATHS.collectionSortOrder, otherwise: "asc" }).is({
        value: direction,
      }),
      Configuring._scalar({ node: rule, path: PATHS.collectionSortBy, otherwise: null }).is({ value: sort }),
    ),
).many();

export const ActiveSiteBasePath = view(
  "active site base path",
  (_inputs, { base }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._scalar({ node: root, path: PATHS.siteBasePath, otherwise: DEFAULTS.basePath }).is({ value: base }),
    ),
).one();

export const DeclaredSiteOrigin = view(
  "declared site origin",
  (_inputs, { origin }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._at({ node: root, path: PATHS.siteOrigin }).is({ value: origin }),
    ),
).optional();

export const ActiveSiteSettings = view(
  "active site settings",
  (_inputs, { site }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._values({ node: root, path: PATHS.site, otherwise: {} }).is({ values: site }),
    ),
).one();

export const ImageRenditionSettings = view(
  "active image rendition settings",
  (_inputs, { widths, formats }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._values({ node: root, path: PATHS.imagesWidths, otherwise: [...DEFAULTS.imageWidths] }).is({ values: widths }),
      Configuring._values({ node: root, path: PATHS.imagesFormats, otherwise: [...DEFAULTS.imageFormats] }).is({ values: formats }),
    ),
).one();

export const ImageAssetPathSetting = view(
  "active image asset path setting",
  (_inputs, { assets }, { root }) =>
    where(
      Configuring._active({}).is({ root }),
      Configuring._scalar({ node: root, path: PATHS.pathsAssets, otherwise: DEFAULTS.assetsPath }).is({ value: assets }),
    ),
).one();

const SiteRenderFacts = former(
  "the site render facts",
  (_inputs, { site, collections }) =>
    where(
      ActiveSiteSettings({}).is({ site }),
      Cataloging._record({}).is({ catalogs: collections }),
    ).form({ collections, site }),
);

const PageRenderFacts = former(
  "the page render facts of rendering (rendering)",
  ({ rendering }, { page, data, address, path }) =>
    where(
      Rendering._active({ rendering }).is({ subject: page }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      Filing._file({ file: page }).is({ path }),
    ).form({ data, source: form({ path }), url: address }),
);

const OriginatedPageRenderFacts = former(
  "the originated page render facts of rendering (rendering)",
  ({ rendering }, { page, address, canonicalUrl }) =>
    where(
      Rendering._active({ rendering }).is({ subject: page }),
      Routing._address({ owner: page }).is({ address }),
      Routing._absolute({ address }).is({ url: canonicalUrl }),
    ).form({ canonicalUrl }),
);

const UnoriginatedPageRenderFacts = former(
  "the unoriginated page render facts of rendering (rendering)",
  ({ rendering }, { page, address }) =>
    where(
      Rendering._active({ rendering }).is({ subject: page }),
      Routing._address({ owner: page }).is({ address }),
      no(Routing._absolute({ address })),
    ).form({}),
);

const CompletedBodyRenderFacts = former(
  "the completed body render facts of rendering (rendering)",
  ({ rendering }, { content }) =>
    where(Referencing._finished({ subject: rendering, part: PARTS.body }).is({ text: content })).form({ content }),
);

export const PageRenderContext = former("the originated render context of page (page)", ({ rendering }) =>
  form({
    page: form({}).splicing(PageRenderFacts({ rendering })).splicing(OriginatedPageRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
);

export const UnoriginatedPageRenderContext = former("the unoriginated render context of page (page)", ({ rendering }) =>
  form({
    page: form({}).splicing(PageRenderFacts({ rendering })).splicing(UnoriginatedPageRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
);

export const CompletedPageRenderContext = former("the originated completed render context of page (page)", ({ rendering }) =>
  form({
    page: form({})
      .splicing(PageRenderFacts({ rendering }))
      .splicing(OriginatedPageRenderFacts({ rendering }))
      .splicing(CompletedBodyRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
);

export const CompletedUnoriginatedPageRenderContext = former("the unoriginated completed render context of page (page)", ({ rendering }) =>
  form({
    page: form({})
      .splicing(PageRenderFacts({ rendering }))
      .splicing(UnoriginatedPageRenderFacts({ rendering }))
      .splicing(CompletedBodyRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
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
      historicalRendering,
      historicalPath,
      historicalProfile,
      historicalTemplate,
      historicalStage,
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
    // each(...) retains the queried concept order for stable inspection output.
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
      renderings: each(Rendering._all({}).is({
        rendering: historicalRendering,
        subject: owner,
        path: historicalPath,
        profile: historicalProfile,
        template: historicalTemplate,
        stage: historicalStage,
      })).form({
        attempt: historicalRendering,
        path: historicalPath,
        profile: historicalProfile,
        template: historicalTemplate,
        stage: historicalStage,
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
