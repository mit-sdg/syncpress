import { earlier, reaction, when, where } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concepts";
import {
  CONFIGURATION_PATH,
  DIAGNOSTIC_SCOPES,
  PHASE_SEQUENCE,
  PROFILES,
} from "./shared.ts";

const { Cataloging, Converting, Diagnosing, Governing, Phasing } = conceptRefs;

/** Each assessment replaces only diagnostics owned by configuration policy. */
export const ConfigurationAssessmentRetractsDiagnostics = reaction(() =>
  when(Governing.assess({})).then(Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.configuration, source: CONFIGURATION_PATH })),
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

/** Begin settings work after replacing diagnostics from the preceding assessment. */
export const SettingsPhaseRetractsDiagnostics = reaction(() =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "settings", transitioned: true })).then(
    Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }),
  ),
);

export const SettingsDeclareMarkdownProfile = reaction(({ extensions, raw, separator }) =>
  when(Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }),
      Governing._markdown({}).is({ extensions, raw, separator }),
    )
    .then(
      Converting.declareProfile({
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
    Converting.declareProfile({
      name: PROFILES.markdown,
      kind: "markdown",
      extensions,
      raw,
      separator,
    }).refuses({ error, detail }),
  )
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }),
      Governing._markdown({}).is({ extensions, raw, separator }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsDeclareVerbatimProfile = reaction(({ separator }) =>
  when(Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }),
      Governing._markdown({}).is({ separator }),
    )
    .then(
      Converting.declareProfile({
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
    Converting.declareProfile({
      name: PROFILES.verbatim,
      kind: "verbatim",
      extensions: [],
      raw: true,
      separator,
    }).refuses({ error, detail }),
  )
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }),
      Governing._markdown({}).is({ separator }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsResetCatalogs = reaction(() =>
  when(Diagnosing.retractGroup({ scope: DIAGNOSTIC_SCOPES.settings, source: CONFIGURATION_PATH }).responds({}))
    .where(earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }))
    .then(Cataloging.reset({})),
);

export const SettingsDeclareCatalogs = reaction(({ name, match, direction, sort, condition }) =>
  when(Cataloging.reset({}).responds({}))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }),
      Governing._collections({}).is({ name, match, direction, sort, condition }),
    )
    .then(Cataloging.declare({ name, selector: match, direction, sort, condition })),
);

export const SettingsCollectionDeclarationFailuresDiagnose = reaction(
  ({ error, detail }) =>
    when(Cataloging.declare({}).refuses({ error, detail }))
      .where(
        earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "settings", transitioned: true }),
      )
      .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.settings, severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
