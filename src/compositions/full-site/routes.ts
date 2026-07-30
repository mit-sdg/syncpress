import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concept-set.ts";
import { PAGE_PATTERNS, PARTS, PATHS, PROFILES, ROOTS } from "./shared.ts";

const { Converting, Diagnosing, Documenting, Filing, Layering, Matching, Phasing, Routing } = concepts;

export const ExplicitRoutesClaim = reaction(({ page, root, address }) =>
  when(Phasing.advance({}).responds({ phase: "route" }))
    .where(
      Documenting._all({}).is({ subject: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root }),
      Layering._flag({ subject: page, path: PATHS.buildPublish, otherwise: true }).is({ value: true }),
      Layering._value({ subject: page, path: PATHS.buildRoute }).is({ value: address }),
    )
    .then(Routing.claim({ owner: page, address })),
);

export const DerivedRoutesClaim = reaction(({ page, root, path, address }) =>
  when(Phasing.advance({}).responds({ phase: "route" }))
    .where(
      Documenting._all({}).is({ subject: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
      Layering._flag({ subject: page, path: PATHS.buildPublish, otherwise: true }).is({ value: true }),
      no(Layering._value({ subject: page, path: PATHS.buildRoute })),
      Routing._derive({ path }).is({ address }),
    )
    .then(Routing.claim({ owner: page, address })),
);

export const UnpublishedRoutesRelease = reaction(({ page, root }) =>
  when(Phasing.advance({}).responds({ phase: "route" }))
    .where(
      Documenting._all({}).is({ subject: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root }),
      Layering._flag({ subject: page, path: PATHS.buildPublish, otherwise: true }).is({ value: false }),
      Routing._address({ owner: page }),
    )
    .then(Routing.release({ owner: page })),
);

export const RouteCollisionsReport = reaction(({ page, root, path }) =>
  when(Routing.claim({ owner: page }).refuses({ error: "ADDRESS_TAKEN" }))
    .where(
      earlier(Phasing.advance, {}, { phase: "route" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "ROUTE_COLLISION",
        message: "Two pages claim one address.",
        source: path,
      }),
    ),
);

export const InvalidRouteClaimsDiagnose = reaction(({ page, root, path, detail }) =>
  when(Routing.claim({ owner: page }).refuses({ error: "INVALID_ADDRESS", detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "route" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_ADDRESS",
        message: detail,
        source: path,
      }),
    ),
);

export const ExplicitMarkupExcerptsConvert = reaction(({ page, body, name, profile }) =>
  when(Phasing.advance({}).responds({ phase: "excerpt" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Documenting._document({ subject: page }).is({ body }),
      Layering._value({ subject: page, path: PATHS.buildMarkup }).is({ value: name }),
      Converting._profile({ name }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.excerpt, profile, source: body })),
);

export const MarkdownExcerptsConvert = reaction(({ page, body, path, pattern, profile }) =>
  when(Phasing.advance({}).responds({ phase: "excerpt" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Documenting._document({ subject: page }).is({ body }),
      no(Layering._value({ subject: page, path: PATHS.buildMarkup })),
      Filing._file({ file: page }).is({ path }),
      Matching._compiled({ text: PAGE_PATTERNS.markdown }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      Converting._profile({ name: PROFILES.markdown }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.excerpt, profile, source: body })),
);

export const HtmlExcerptsConvert = reaction(({ page, body, path, pattern, profile }) =>
  when(Phasing.advance({}).responds({ phase: "excerpt" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Documenting._document({ subject: page }).is({ body }),
      no(Layering._value({ subject: page, path: PATHS.buildMarkup })),
      Filing._file({ file: page }).is({ path }),
      Matching._compiled({ text: PAGE_PATTERNS.html }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
      Converting._profile({ name: PROFILES.verbatim }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.excerpt, profile, source: body })),
);

export const ExcerptConversionFailuresDiagnose = reaction(({ page, root, path, error, detail }) =>
  when(Converting.convert({ subject: page, part: PARTS.excerpt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "excerpt" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);
