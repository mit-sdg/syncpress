import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { DerivedAddress } from "./calculations.ts";
import { PATHS, PHASE_SEQUENCE, ROOTS } from "./shared.ts";

const { Diagnosing, DocumentParsing, Filing, Layering, Phasing, Routing } = conceptRefs;

export const ExplicitRoutesClaim = reaction(({ page, root, address }) =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "route", transitioned: true }))
    .where(
      DocumentParsing._all({}).is({ subject: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root }),
      Layering._flag({ subject: page, path: PATHS.buildPublish, otherwise: true }).is({ value: true }),
      Layering._value({ subject: page, path: PATHS.buildRoute }).is({ value: address }),
    )
    .then(Routing.claim({ owner: page, address })),
);

export const DerivedRoutesClaim = reaction(({ page, root, path, address }) =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "route", transitioned: true }))
    .where(
      DocumentParsing._all({}).is({ subject: page }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
      Layering._flag({ subject: page, path: PATHS.buildPublish, otherwise: true }).is({ value: true }),
      no(Layering._value({ subject: page, path: PATHS.buildRoute })),
      DerivedAddress({ path }).is({ address }),
    )
    .then(Routing.claim({ owner: page, address })),
);

export const UnpublishedRoutesRelease = reaction(({ page, root }) =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "route", transitioned: true }))
    .where(
      DocumentParsing._all({}).is({ subject: page }),
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
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
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
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "route", transitioned: true }),
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
