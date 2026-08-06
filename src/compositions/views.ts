import { each, form, former, no, view, where, whether } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { PAGE_PATTERNS, PARTS, PLACES, ROOTS } from "./shared.ts";
import { AbsoluteSiteUrl } from "./calculations.ts";

const {
  Cataloging,
  Converting,
  Diagnosing,
  Filing,
  Governing,
  Layering,
  Locating,
  Referencing,
  RenderTracking,
  Routing,
} = conceptRefs;


/** Wherever this run publishes: an explicit destination, or the configured output. */
export const PublicationPlace = view("the publication place", (_inputs, { place, destination }) => [
  where(
    Locating._named({ name: PLACES.destination }).is({ place }),
    Locating._place({ place }).is({ real: destination }),
  ),
  where(
    no(Locating._named({ name: PLACES.destination })),
    Locating._named({ name: PLACES.output }).is({ place }),
    Locating._place({ place }).is({ real: destination }),
  ),
]).optional();

/** Every standing diagnostic, written the way Diagnosing writes them. */
const DiagnosedText = former("the diagnosed text", (_inputs, { text }) =>
  where(Diagnosing._rendered({}).is({ text })).form({ text }));

export const SiteBuildSummary = former(
  "the site build summary",
  (_inputs, { owner, file, policy, destination, severity, code, message, source, line, column }) =>
    where(
      whether(Governing._policy({}).is({ policy })),
      whether(PublicationPlace({}).is({ destination })),
    ).form({
      diagnosis: DiagnosedText({}),
      pages: each(Routing._claims({}).is({ owner })).count(),
      files: each(Filing._files({}).is({ file })).count(),
      policy,
      destination,
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
  (_inputs, { file, text }, { root, path }) => [
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      computations.patternHasResult({ pattern: PAGE_PATTERNS.markdown, path, matched: true }),
      Filing._text({ file }).is({ text }),
    ),
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      computations.patternHasResult({ pattern: PAGE_PATTERNS.html, path, matched: true }),
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
      RenderTracking._active({ rendering }).is({ subject: page }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ address }),
      Filing._file({ file: page }).is({ path }),
    ).form({ data, source: form({ path }), url: address }),
);

const OriginatedPageRenderFacts = former(
  "the originated page render facts of rendering (rendering)",
  ({ rendering }, { page, address, canonicalUrl }) =>
    where(
      RenderTracking._active({ rendering }).is({ subject: page }),
      Routing._address({ owner: page }).is({ address }),
      AbsoluteSiteUrl({ address }).is({ url: canonicalUrl }),
    ).form({ canonicalUrl }),
);

const UnoriginatedPageRenderFacts = former(
  "the unoriginated page render facts of rendering (rendering)",
  ({ rendering }, { page, address }) =>
    where(
      RenderTracking._active({ rendering }).is({ subject: page }),
      Routing._address({ owner: page }).is({ address }),
      no(AbsoluteSiteUrl({ address })),
    ).form({}),
);

const CompletedBodyRenderFacts = former(
  "the completed body render facts of rendering (rendering)",
  ({ rendering }, { content }) =>
    where(Referencing._finished({ subject: rendering, part: PARTS.body }).is({ text: content })).form({ content }),
);

export const OriginatedPageRenderContext = former("the originated render context of rendering (rendering)", ({ rendering }) =>
  form({
    page: form({}).splicing(PageRenderFacts({ rendering })).splicing(OriginatedPageRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
);

export const UnoriginatedPageRenderContext = former("the unoriginated render context of rendering (rendering)", ({ rendering }) =>
  form({
    page: form({}).splicing(PageRenderFacts({ rendering })).splicing(UnoriginatedPageRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
);

export const CompletedOriginatedPageRenderContext = former("the originated completed render context of rendering (rendering)", ({ rendering }) =>
  form({
    page: form({})
      .splicing(PageRenderFacts({ rendering }))
      .splicing(OriginatedPageRenderFacts({ rendering }))
      .splicing(CompletedBodyRenderFacts({ rendering })),
  }).splicing(SiteRenderFacts({})),
);

export const CompletedUnoriginatedPageRenderContext = former("the unoriginated completed render context of rendering (rendering)", ({ rendering }) =>
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
