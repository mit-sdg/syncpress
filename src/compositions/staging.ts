/**
 * Bringing a host project into the model. The locate phase grounds the site
 * directory and assesses its configuration; the stage phase admits every
 * configured location, surveys it, and files what it holds. Every host refusal
 * becomes a diagnostic, so an unusable project fails the build rather than the
 * request.
 */
import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { CONFIGURATION_PATH, DIAGNOSTIC_SCOPES, PHASE_SEQUENCE, PLACES, ROOTS } from "./shared.ts";
import { PublicationPlace } from "./views.ts";

const { Diagnosing, Emitting, Filing, Governing, Locating, Phasing, Scanning } = conceptRefs;

const staged = {
  scope: DIAGNOSTIC_SCOPES.staging,
  severity: "error",
  source: CONFIGURATION_PATH,
} as const;

/* Locate: ground the recorded site directory and read its configuration. */

export const LocateRetractsStagingDiagnostics = reaction(() =>
  when(Phasing.start({}).responds({ name: PHASE_SEQUENCE, phase: "locate" }))
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

export const UngroundableSiteDirectoryDiagnoses = reaction(({ path, error, detail }) =>
  when(Locating.ground({ path }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail })),
);

export const GroundedSiteAdmitsConfiguration = reaction(() =>
  when(Locating.ground({}).responds({}))
    .then(Locating.admit({ name: PLACES.settings, path: CONFIGURATION_PATH })),
);

export const AdmittedConfigurationIsRead = reaction(({ path }) =>
  when(Locating.admit({ name: PLACES.settings }).responds({ path }))
    .then(Scanning.absorb({ path })),
);

export const UnreadableConfigurationDiagnoses = reaction(({ path, error, detail }) =>
  when(Scanning.absorb({ path }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail })),
);

export const ReadConfigurationOpensProject = reaction(() =>
  when(Scanning.absorb({}).responds({}))
    .then(Filing.open({ name: ROOTS.project })),
);

export const OpenedProjectFilesConfiguration = reaction(({ root, content }) =>
  when(Filing.open({ name: ROOTS.project }).responds({ root }))
    .where(earlier(Scanning.absorb, {}, { content }))
    .then(Filing.place({ root, path: CONFIGURATION_PATH, content })),
);

export const FiledConfigurationIsAssessed = reaction(({ root, file, text }) =>
  when(Filing.place({ root, path: CONFIGURATION_PATH }).responds({ file }))
    .where(
      Filing._named({ name: ROOTS.project }).is({ root }),
      Filing._text({ file }).is({ text }),
    )
    .then(Governing.assess({ source: text })),
);

/** A configuration that is not UTF-8 text is answered here rather than by an unread policy. */
export const UndecodableConfigurationDiagnoses = reaction(({ root, file }) =>
  when(Filing.place({ root, path: CONFIGURATION_PATH }).responds({ file }))
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

/* Stage: admit every configured location, then survey and file what it holds. */

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

export const UnresolvableLocationDiagnoses = reaction(({ name, path, error, detail }) =>
  when(Locating.admit({ name, path }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail })),
);

export const AdmittedSourceRootsAreSurveyed = reaction(({ root, directory, real }) =>
  when(Locating.admit({ name: root, path: directory }).responds({ real, contained: true, resolved: true }))
    .where(Governing._sources({}).is({ name: root, path: directory }))
    .then(Scanning.survey({ label: root, directory: real })),
);

export const UnsurveyableSourceRootDiagnoses = reaction(({ root, directory, error, detail }) =>
  when(Scanning.survey({ label: root, directory }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail, source: root })),
);

export const SurveyedSourceRootOpensFiling = reaction(({ root }) =>
  when(Scanning.survey({ label: root }).responds({}))
    .then(Filing.open({ name: root })),
);

export const OpenedSourceRootReadsEntries = reaction(({ root, survey, path }) =>
  when(Filing.open({ name: root }).responds({}))
    .where(
      Scanning._labelled({ label: root }).is({ survey }),
      Scanning._entry({ survey }).is({ path }),
    )
    .then(Scanning.read({ survey, path })),
);

export const ReadEntriesAreFiled = reaction(({ survey, path, content, label, root }) =>
  when(Scanning.read({ survey, path }).responds({ content }))
    .where(
      Scanning._survey({ survey }).is({ label }),
      Filing._named({ name: label }).is({ root }),
    )
    .then(Filing.place({ root, path, content })),
);

export const UnreadableEntryDiagnoses = reaction(({ survey, path, error, detail }) =>
  when(Scanning.read({ survey, path }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail, source: path })),
);

/* Publication: direct output at whichever location this run publishes to. */

export const ConfiguredOutputDirectsPublication = reaction(({ directory, real }) =>
  when(Locating.admit({ name: PLACES.output, path: directory }).responds({ real, contained: true, resolved: true }))
    .then(Emitting.direct({ destination: real })),
);

export const DestinationDirectsPublication = reaction(({ directory, real }) =>
  when(Locating.admit({ name: PLACES.destination, path: directory }).responds({ real }))
    .then(Emitting.direct({ destination: real })),
);

export const UndirectablePublicationDiagnoses = reaction(({ destination, error, detail }) =>
  when(Emitting.direct({ destination }).refuses({ error, detail }))
    .then(Diagnosing.report({ ...staged, code: error, message: detail })),
);

/* Escaping and overlapping locations are configuration errors, not host failures. */

export const EscapingContentRootDiagnoses = reaction(({ directory, place }) =>
  when(Locating.admit({ name: ROOTS.content, path: directory }).responds({ place }))
    .where(no(Locating._place({ place }).is({ contained: true, resolved: true })))
    .then(
      Diagnosing.report({
        ...staged,
        code: "SOURCE_OUTSIDE_SITE",
        message: "Configured paths.content must stay inside the site directory after resolving symbolic links.",
      }),
    ),
);

export const EscapingTemplateRootDiagnoses = reaction(({ directory, place }) =>
  when(Locating.admit({ name: ROOTS.templates, path: directory }).responds({ place }))
    .where(no(Locating._place({ place }).is({ contained: true, resolved: true })))
    .then(
      Diagnosing.report({
        ...staged,
        code: "SOURCE_OUTSIDE_SITE",
        message: "Configured paths.templates must stay inside the site directory after resolving symbolic links.",
      }),
    ),
);

export const EscapingPublicRootDiagnoses = reaction(({ directory, place }) =>
  when(Locating.admit({ name: ROOTS.public, path: directory }).responds({ place }))
    .where(no(Locating._place({ place }).is({ contained: true, resolved: true })))
    .then(
      Diagnosing.report({
        ...staged,
        code: "SOURCE_OUTSIDE_SITE",
        message: "Configured paths.public must stay inside the site directory after resolving symbolic links.",
      }),
    ),
);

export const EscapingConfiguredOutputDiagnoses = reaction(({ directory, place }) =>
  when(Locating.admit({ name: PLACES.output, path: directory }).responds({ place }))
    .where(no(Locating._place({ place }).is({ contained: true, resolved: true })))
    .then(
      Diagnosing.report({
        ...staged,
        code: "OUTPUT_OUTSIDE_SITE",
        message: "Configured paths.output must stay inside the site directory after resolving symbolic links.",
      }),
    ),
);

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
