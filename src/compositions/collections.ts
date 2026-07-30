import { reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { PATHS, ROOTS } from "./shared.ts";
import { PublicationCard } from "./views.ts";

const { Cataloging, Configuring, Filing, Matching, Phasing, Routing } = concepts;

const COLLECTIONS_PATH = ["collections"];

/** Configured catalogs whose admitted path selector matches a routed content page. */
export const MatchingCatalogOfPage = view(
  "matching catalog of page (page)",
  ({ page }, { catalog, path }, { root, configuration, collections, name, rule, text, pattern }) =>
    where(
      Routing._address({ owner: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._at({ node: configuration, path: COLLECTIONS_PATH }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ key: name, child: rule }),
      Cataloging._named({ name }).is({ catalog }),
      Configuring._at({ node: rule, path: PATHS.collectionMatch }).is({ value: text }),
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
