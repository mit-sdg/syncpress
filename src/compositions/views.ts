import { each, form, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { PAGE_PATTERNS, PARTS, ROOTS } from "./shared.ts";

const {
  Cataloging,
  Converting,
  Depending,
  Diagnosing,
  Emitting,
  Filing,
  Governing,
  Layering,
  Matching,
  Referencing,
  Rendering,
  Routing,
  Templating,
} = conceptRefs;

export const InspectionOwner = view(
  "the inspection owner of target (target)",
  ({ target }, { owner }, { root }) => [
    where(Routing._owner({ address: target }).is({ owner })),
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._at({ root, path: target }).is({ file: owner }),
    ),
  ],
).optional();

export const SiteBuildSummary = former(
  "the site build summary",
  (_inputs, { owner, severity, code, message, source, line, column }) =>
    form({
      pages: each(Routing._claims({}).is({ owner })).count(),
      diagnostics: each(Diagnosing._all({}).is({ severity, code, message, source, line, column })).form({
        severity,
        code,
        message,
        source,
        line,
        column,
      }),
    }),
);

/** Authored content files supported by the document pipeline. */
export const ContentDocumentFile = view(
  "content document file",
  (_inputs, { file, text }, { root, path, pattern }) => [
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Matching._compiled({ text: PAGE_PATTERNS.markdown }).is({ pattern }),
      computations.patternHasResult({ pattern, path, matched: true }),
      Filing._text({ file }).is({ text }),
    ),
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Matching._compiled({ text: PAGE_PATTERNS.html }).is({ pattern }),
      computations.patternHasResult({ pattern, path, matched: true }),
      Filing._text({ file }).is({ text }),
    ),
  ],
).many();

const SiteRenderFacts = former(
  "the site render facts",
  (_inputs, { site, collections }) =>
    where(
      Governing._site({}).is({ site }),
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
      claims: each(Routing._claims({}).is({ owner, address })).form({ owner, address }),
      // Diagnostics are build-wide until reporting records an explicit subject relation.
      diagnostics: each(Diagnosing._all({}).is({ diagnostic, severity, code, message, source, line, column })).form({
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

/** Complete inspection data, joined declaratively from concept-owned state. */
export const SiteInspection = former(
  "the site inspection of owner (owner)",
  (
    { owner },
    {
      route,
      sourcePath,
      sourceDigest,
      templateName,
      templateOwner,
      templateDigest,
      used,
      layer,
      rank,
      values,
      originPath,
      originRank,
      originLayer,
    },
  ) =>
    form({
      route: where(whether(Routing._address({ owner }).is({ address: route }))).form({ address: route }),
      source: where(whether(Filing._file({ file: owner }).is({ path: sourcePath, digest: sourceDigest }))).form({
        path: sourcePath,
        digest: sourceDigest,
      }),
      template: where(
        whether(Rendering._latest({ subject: owner }).is({ template: templateName })),
        whether(Templating._template({ name: templateName }).is({ template: templateOwner, digest: templateDigest })),
      ).form({
        name: templateName,
        digest: templateDigest,
        tree: each(Templating._tree({ owner: templateOwner }).is({ used })).form({ used }),
      }),
      layers: each(Layering._layers({ subject: owner }).is({ layer, rank, values })).form({ layer, rank, values }),
      origins: each(Layering._leafOrigins({ subject: owner }).is({ path: originPath, rank: originRank, layer: originLayer })).form({
        path: originPath,
        rank: originRank,
        layer: originLayer,
      }),
    }).splicing(PageOperationalInspection({ owner })),
);
