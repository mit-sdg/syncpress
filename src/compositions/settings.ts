import { earlier, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import {
  CONFIGURATION_PATH,
  DIAGNOSTIC_SCOPES,
  PAGE_PATTERNS,
  PHASE_SEQUENCE,
  PROFILES,
} from "./shared.ts";

const { Cataloging, Converting, Diagnosing, Governing, Matching, Phasing, Routing } = conceptRefs;

/** Each assessment replaces only diagnostics owned by configuration policy. */
export const ConfigurationAssessmentRetractsDiagnostics = reaction(() =>
  when(Governing.assess({})).then(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.configuration, source: CONFIGURATION_PATH })),
);

/** Publish every product-policy problem through the application's diagnostic owner. */
export const AssessedConfigurationProblemsDiagnose = reaction(({ code, message, line, column }) =>
  when(Governing.assess({}).refuses({ error: "INVALID_CONFIGURATION" }))
    .where(Governing._problems({}).is({ code, message, line, column }))
    .then(Diagnosing.report({
      scope: DIAGNOSTIC_SCOPES.configuration,
      severity: "error",
      code,
      message,
      source: CONFIGURATION_PATH,
      line,
      column,
    })),
);

/** Make the built-in source selectors available even when configuration has no rules. */
export const SettingsPhasesRetractDiagnostics = reaction(() =>
  when(Phasing.start({}).responds({ name: PHASE_SEQUENCE, phase: "settings" })).then(
    Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }),
  ),
);

export const FixedPatternsCompile = reaction(() =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }))
    .then(
      Matching.compile({ text: PAGE_PATTERNS.markdown }).named("markdown"),
      Matching.compile({ text: PAGE_PATTERNS.html }).named("html"),
      Matching.compile({ text: PAGE_PATTERNS.raster }).named("raster"),
    ),
);

export const SettingsRebaseRouting = reaction(({ base }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._site({}).is({ base }),
    )
    .then(Routing.rebase({ base })),
);

export const SettingsRebaseFailuresDiagnose = reaction(({ base, detail }) =>
  when(Routing.rebase({ base }).refuses({ error: "INVALID_BASE", detail }))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._site({}).is({ base }),
    )
    .then(
      Diagnosing.report({
        scope: DIAGNOSTIC_SCOPES.settings,
        severity: "error",
        code: "INVALID_BASE",
        message: detail,
        source: CONFIGURATION_PATH,
      }),
    ),
);

/** Configure canonical URL projection only when the site declares an origin. */
export const SettingsReoriginRouting = reaction(({ origin }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._origin({}).is({ origin }),
    )
    .then(Routing.reorigin({ origin })),
);

/** An omitted origin deliberately clears any origin retained by a long-lived application. */
export const SettingsClearRoutingOrigin = reaction(() =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._policy({}),
      no(Governing._origin({})),
    )
    .then(Routing.reorigin({})),
);

export const SettingsReoriginFailuresDiagnose = reaction(({ origin, detail }) =>
  when(Routing.reorigin({ origin }).refuses({ error: "INVALID_ORIGIN", detail }))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._origin({}).is({ origin }),
    )
    .then(
      Diagnosing.report({
        scope: DIAGNOSTIC_SCOPES.settings,
        severity: "error",
        code: "INVALID_ORIGIN",
        message: detail,
        source: CONFIGURATION_PATH,
      }),
    ),
);

export const SettingsDeclareMarkdownProfile = reaction(({ extensions, raw, separator }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._markdown({}).is({ extensions, raw, separator }),
    )
    .then(
      Converting.declare({
        name: PROFILES.markdown,
        kind: "markdown",
        extensions,
        raw,
        separator,
      }),
    ),
);

export const SettingsMarkdownProfileFailuresDiagnose = reaction(({ extensions, raw, separator, error, detail }) =>
  when(
    Converting.declare({
      name: PROFILES.markdown,
      kind: "markdown",
      extensions,
      raw,
      separator,
    }).refuses({ error, detail }),
  )
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._markdown({}).is({ extensions, raw, separator }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsDeclareVerbatimProfile = reaction(({ separator }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._markdown({}).is({ separator }),
    )
    .then(
      Converting.declare({
        name: PROFILES.verbatim,
        kind: "verbatim",
        extensions: [],
        raw: true,
        separator,
      }),
    ),
);

export const SettingsVerbatimProfileFailuresDiagnose = reaction(({ separator, error, detail }) =>
  when(
    Converting.declare({
      name: PROFILES.verbatim,
      kind: "verbatim",
      extensions: [],
      raw: true,
      separator,
    }).refuses({ error, detail }),
  )
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._markdown({}).is({ separator }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsCompileDefaultPatterns = reaction(({ text }) =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._defaults({}).is({ text }),
    )
    .then(Matching.compile({ text })),
);

export const SettingsDefaultPatternFailuresDiagnose = reaction(({ text, error, detail }) =>
  when(Matching.compile({ text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._defaults({}).is({ text }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsResetCatalogs = reaction(() =>
  when(Diagnosing.retract({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }))
    .then(Cataloging.reset({})),
);

export const SettingsDeclareCatalogs = reaction(({ name, match, direction, sort, condition }) =>
  when(Cataloging.reset({}).responds({}))
    .where(
      earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      Governing._collections({}).is({ name, match, direction, sort, condition }),
    )
    .then(Cataloging.declare({ name, selector: match, direction, sort, condition })),
);

export const SettingsCollectionDeclarationFailuresDiagnose = reaction(
  ({ error, detail }) =>
    when(Cataloging.declare({}).refuses({ error, detail }))
      .where(
        earlier(Phasing.start, {}, { name: PHASE_SEQUENCE, phase: "settings" }),
      )
      .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
