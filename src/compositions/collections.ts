import { reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { ROOTS } from "./shared.ts";
import { CollectionSetting, PublicationCard } from "./views.ts";

const { Cataloging, Filing, Matching, Phasing, Routing } = conceptRefs;

/** Configured catalogs whose admitted path selector matches a routed content page. */
export const MatchingCatalogOfPage = view(
  "matching catalog of page (page)",
  ({ page }, { catalog, path }, { root, name, text, pattern }) =>
    where(
      Routing._address({ owner: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
      CollectionSetting({}).is({ name, text }),
      Cataloging._named({ name }).is({ catalog }),
      Matching._compiled({ text }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
    ),
).many();

/** Every path-matching page enters each catalog under that catalog's own policy. */
export const MatchingPagesEnterCatalogs = reaction(({ page, catalog, path }) =>
  when(Phasing.advance({}).responds({ phase: "collect" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      MatchingCatalogOfPage({ page }).is({ catalog, path }),
    )
    .then(Cataloging.index({ catalog, item: page, tiebreak: path, card: PublicationCard({ page }) })),
);
