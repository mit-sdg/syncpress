/**
 * Bringing a host project into the model. The locate phase grounds the site
 * directory and assesses its configuration; the stage phase admits every
 * configured location and atomically loads its complete logical tree. Expected
 * host problems are returned as data and become diagnostics, so they never
 * race the endpoint's one terminal answer.
 */
import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { CONFIGURATION_PATH, DIAGNOSTIC_SCOPES, PHASE_SEQUENCE, PLACES, ROOTS } from "./shared.ts";
import { PublicationTransactionPrefix } from "./calculations.ts";
import { PublicationPlace } from "./views.ts";

const { Delivering, Diagnosing, Emitting, Filing, Governing, Locating, Phasing } = conceptRefs;

const staged = {
  scope: DIAGNOSTIC_SCOPES.staging,
  severity: "error",
  source: CONFIGURATION_PATH,
} as const;

/* Locate: ground the recorded site directory and read its configuration. */

export const StartedSiteBuildsBeginAggregateDelivery = reaction(({ job }) =>
  when(Phasing.start({}).responds({ job, name: PHASE_SEQUENCE, phase: "locate" }))
    .then(Delivering.begin({ task: job })),
);

export const BegunSiteBuildDeliveriesRetractStagingDiagnostics = reaction(({ job }) =>
  when(Delivering.begin({ task: job }).responds({}))
    .where(earlier(Phasing.start, {}, { job, name: PHASE_SEQUENCE, phase: "locate" }))
    .then(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.staging, source: CONFIGURATION_PATH })),
);

export const LocateGroundsSiteDirectory = reaction(({ path }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.staging, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "locate" }),
      Locating._requested({ name: PLACES.base }).is({ path }),
    )
    .then(Locating.ground({ path })),
);

export const UngroundableSiteDirectoryDiagnoses = reaction(({ path, code, detail }) =>
  when(Locating.ground({ path }).responds({ status: "problem", code, detail }))
    .then(Diagnosing.report({ ...staged, code, message: detail })),
);

export const GroundedSiteAdmitsConfiguration = reaction(() =>
  when(Locating.ground({}).responds({ status: "grounded" }))
    .then(Locating.admit({ name: PLACES.settings, path: CONFIGURATION_PATH })),
);

export const AdmittedConfigurationIsLoaded = reaction(({ path }) =>
  when(Locating.admit({ name: PLACES.settings }).responds({ status: "admitted", path }))
    .then(Filing.loadFile({ name: ROOTS.project, source: path, path: CONFIGURATION_PATH })),
);

export const UnreadableConfigurationDiagnoses = reaction(({ code, detail }) =>
  when(Filing.loadFile({ name: ROOTS.project, path: CONFIGURATION_PATH }).responds({ status: "problem", code, detail }))
    .then(Diagnosing.report({ ...staged, code, message: detail })),
);

export const LoadedConfigurationIsAssessed = reaction(({ root, file, text }) =>
  when(Filing.loadFile({ name: ROOTS.project, path: CONFIGURATION_PATH }).responds({ status: "loaded", root, file }))
    .where(
      Filing._named({ name: ROOTS.project }).is({ root }),
      Filing._text({ file }).is({ text }),
    )
    .then(Governing.assess({ source: text })),
);

/** A configuration that is not UTF-8 text is answered here rather than by an unread policy. */
export const UndecodableConfigurationDiagnoses = reaction(({ root, file }) =>
  when(Filing.loadFile({ name: ROOTS.project, path: CONFIGURATION_PATH }).responds({ status: "loaded", root, file }))
    .where(
      Filing._named({ name: ROOTS.project }).is({ root }),
      no(Filing._text({ file })),
    )
    .then(
      Diagnosing.report({
        ...staged,
        code: "INVALID_TEXT",
        message: "The site configuration must be UTF-8 text.",
      }),
    ),
);

/* Stage: admit every configured location, then replace each complete input tree. */

export const StageAdmitsSourceRoots = reaction(({ root, directory }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "stage", transitioned: true }))
    .where(Governing._sources({}).is({ name: root, path: directory }))
    .then(Locating.admit({ name: root, path: directory })),
);

/** An explicitly requested destination replaces the configured output for this run. */
export const StageAdmitsRequestedDestination = reaction(({ directory }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "stage", transitioned: true }))
    .where(Locating._requested({ name: PLACES.destination }).is({ path: directory }))
    .then(Locating.admit({ name: PLACES.destination, path: directory })),
);

export const StageAdmitsConfiguredOutput = reaction(({ directory }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "stage", transitioned: true }))
    .where(
      Governing._paths({}).is({ output: directory }),
      no(Locating._requested({ name: PLACES.destination })),
    )
    .then(Locating.admit({ name: PLACES.output, path: directory })),
);

export const UnresolvableLocationDiagnoses = reaction(({ name, path, code, detail }) =>
  when(Locating.admit({ name, path }).responds({ status: "problem", code, detail }))
    .then(Diagnosing.report({ ...staged, code, message: detail })),
);

export const AdmittedSourceRootsAreLoaded = reaction(({ root, directory, real }) =>
  when(Locating.admit({ name: root, path: directory }).responds({ status: "admitted", real, contained: true, resolved: true }))
    .where(Governing._sources({}).is({ name: root, path: directory }))
    .then(Filing.loadTree({ name: root, directory: real })),
);

export const UnloadableSourceRootDiagnoses = reaction(({ root, code, detail }) =>
  when(Filing.loadTree({ name: root }).responds({ status: "problem", code, detail }))
    .then(Diagnosing.report({ ...staged, code, message: detail, source: root })),
);

/* Publication: direct output at whichever location this run publishes to. */

export const ConfiguredOutputDirectsPublication = reaction(({ directory, real, prefix }) =>
  when(Locating.admit({ name: PLACES.output, path: directory }).responds({ status: "admitted", real, contained: true, resolved: true }))
    .where(PublicationTransactionPrefix({ destination: real }).is({ prefix }))
    .then(Emitting.direct({ destination: real, prefix })),
);

export const DestinationDirectsPublication = reaction(({ directory, real, prefix }) =>
  when(Locating.admit({ name: PLACES.destination, path: directory }).responds({ status: "admitted", real }))
    .where(PublicationTransactionPrefix({ destination: real }).is({ prefix }))
    .then(Emitting.direct({ destination: real, prefix })),
);

export const UndirectablePublicationDiagnoses = reaction(({ destination, error, detail }) =>
  when(Emitting.direct({ destination }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail })),
);

/* Escaping and overlapping locations are configuration errors, not host failures. */

/**
 * One rule, stated once for each configured location it governs: a location
 * that does not stay inside the site once symbolic links are resolved cannot be
 * read from or written to, whatever the operator meant by it.
 */
const escapesSite = (place: string, key: string, code: string) =>
  reaction(({ directory, admitted }) =>
    when(Locating.admit({ name: place, path: directory }).responds({ status: "admitted", place: admitted }))
      .where(no(Locating._place({ place: admitted }).is({ contained: true, resolved: true })))
      .then(
        Diagnosing.report({
          ...staged,
          code,
          message: `Configured paths.${key} must stay inside the site directory after resolving symbolic links.`,
        }),
      ),
  );

export const EscapingContentRootDiagnoses = escapesSite(ROOTS.content, "content", "SOURCE_OUTSIDE_SITE");
export const EscapingTemplateRootDiagnoses = escapesSite(ROOTS.templates, "templates", "SOURCE_OUTSIDE_SITE");
export const EscapingPublicRootDiagnoses = escapesSite(ROOTS.public, "public", "SOURCE_OUTSIDE_SITE");
export const EscapingConfiguredOutputDiagnoses = escapesSite(PLACES.output, "output", "OUTPUT_OUTSIDE_SITE");

export const OutputOverlappingSourceRootDiagnoses = reaction(({ publication, root, source }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "settings", transitioned: true }))
    .where(
      PublicationPlace({}).is({ place: publication }),
      Governing._sources({}).is({ name: root }),
      Locating._named({ name: root }).is({ place: source }),
      Locating._overlapping({ place: publication, other: source }).is({ overlapping: true }),
    )
    .then(
      Diagnosing.report({
        ...staged,
        code: "OUTPUT_OVERLAPS_SOURCE",
        message: "The output directory must not overlap a configured source directory.",
        source: root,
      }),
    ),
);

export const OutputOverlappingConfigurationDiagnoses = reaction(({ publication, settings }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "settings", transitioned: true }))
    .where(
      PublicationPlace({}).is({ place: publication }),
      Locating._named({ name: PLACES.settings }).is({ place: settings }),
      Locating._overlapping({ place: publication, other: settings }).is({ overlapping: true }),
    )
    .then(
      Diagnosing.report({
        ...staged,
        code: "OUTPUT_OVERLAPS_CONFIGURATION",
        message: "The output directory must not contain the site configuration.",
      }),
    ),
);
