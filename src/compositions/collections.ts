import { earlier, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { DIAGNOSTIC_SCOPES, PHASE_SEQUENCE, ROOTS } from "./shared.ts";
import { PublicationCard } from "./views.ts";

const { Cataloging, Diagnosing, Filing, Phasing, Routing } = conceptRefs;

/** Every path-matching page enters each catalog under that catalog's own policy. */
export const CollectPhaseIndexesPages = reaction(({ page, catalog, path, content }) =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "collect", transitioned: true }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Filing._named({ name: ROOTS.content }).is({ root: content }),
      Filing._file({ file: page }).is({ root: content, path }),
      Cataloging._catalogs({}).is({ catalog }),
    )
    .then(Cataloging.index({ catalog, item: page, path, tiebreak: path, card: PublicationCard({ page }) })),
);

/** A refused projection must remain visible and prevent publication. */
export const CatalogIndexFailuresDiagnose = reaction(({ page, path, error, detail }) =>
  when(Cataloging.index({ item: page, path }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "collect", transitioned: true }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({
      scope: DIAGNOSTIC_SCOPES.cataloging,
      severity: "error",
      code: error,
      message: detail,
      source: path,
    })),
);
