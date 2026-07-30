import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import {
  CONFIGURATION_PATH,
  DEFAULTS,
  PAGE_PATTERNS,
  PATHS,
  PROFILES,
} from "./shared.ts";
import {
  CollectionDeclarationSetting,
  CollectionPatternSetting,
  DefaultPatternSetting,
  MarkdownSettings,
  VerbatimSettings,
} from "./views.ts";

const { Collecting, Configuring, Converting, Diagnosing, Matching, Phasing, Routing } = concepts;

/** Make the built-in source selectors available even when configuration has no rules. */
export const FixedPatternsCompile = reaction(() =>
  when(Phasing.start({}).responds({ phase: "settings" })).then(
    Matching.compile({ text: PAGE_PATTERNS.markdown }).named("markdown"),
    Matching.compile({ text: PAGE_PATTERNS.html }).named("html"),
    Matching.compile({ text: PAGE_PATTERNS.raster }).named("raster"),
  ),
);

export const SettingsRebaseRouting = reaction(({ root, base }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      Configuring._scalar({ node: root, path: PATHS.siteBasePath, otherwise: DEFAULTS.basePath }).is({
        value: base,
      }),
    )
    .then(Routing.rebase({ base })),
);

export const SettingsRebaseFailuresDiagnose = reaction(({ root, base, detail }) =>
  when(Routing.rebase({ base }).refuses({ error: "INVALID_BASE", detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      Configuring._scalar({
        node: root,
        path: PATHS.siteBasePath,
        otherwise: DEFAULTS.basePath,
      }).is({ value: base }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_BASE",
        message: detail,
        source: CONFIGURATION_PATH,
      }),
    ),
);

/** Configure canonical URL projection only when the site declares an origin. */
export const SettingsReoriginRouting = reaction(({ root, origin }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      Configuring._at({ node: root, path: PATHS.siteOrigin }).is({ value: origin }),
    )
    .then(Routing.reorigin({ origin })),
);

/** An omitted origin deliberately clears any origin retained by a long-lived application. */
export const SettingsClearRoutingOrigin = reaction(({ root }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      no(Configuring._at({ node: root, path: PATHS.siteOrigin })),
    )
    .then(Routing.reorigin({})),
);

export const SettingsReoriginFailuresDiagnose = reaction(({ root, origin, detail }) =>
  when(Routing.reorigin({ origin }).refuses({ error: "INVALID_ORIGIN", detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      Configuring._at({ node: root, path: PATHS.siteOrigin }).is({ value: origin }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_ORIGIN",
        message: detail,
        source: CONFIGURATION_PATH,
      }),
    ),
);

export const SettingsDeclareMarkdownProfile = reaction(({ root, extensions, raw, separator }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      MarkdownSettings({ root }).is({ extensions, raw, separator }),
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

export const SettingsMarkdownProfileFailuresDiagnose = reaction(({ root, extensions, raw, separator, error, detail }) =>
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
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      MarkdownSettings({ root }).is({ extensions, raw, separator }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsDeclareVerbatimProfile = reaction(({ root, separator }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      VerbatimSettings({ root }).is({ separator }),
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

export const SettingsVerbatimProfileFailuresDiagnose = reaction(({ root, separator, error, detail }) =>
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
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      VerbatimSettings({ root }).is({ separator }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsCompileDefaultPatterns = reaction(({ root, text }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      DefaultPatternSetting({ root }).is({ text }),
    )
    .then(Matching.compile({ text })),
);

export const SettingsDefaultPatternFailuresDiagnose = reaction(({ root, text, error, detail }) =>
  when(Matching.compile({ text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      DefaultPatternSetting({ root }).is({ text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsCompileCollectionPatterns = reaction(({ root, text }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Configuring._active({}).is({ root }),
      CollectionPatternSetting({ root }).is({ text }),
    )
    .then(Matching.compile({ text })),
);

export const SettingsCollectionPatternFailuresDiagnose = reaction(({ root, text, error, detail }) =>
  when(Matching.compile({ text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      CollectionPatternSetting({ root }).is({ text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsResetCollections = reaction(() =>
  when(Phasing.start({}).responds({ phase: "settings" })).then(Collecting.reset({})),
);

export const SettingsDeclareCollections = reaction(({ root, name, direction }) =>
  when(Collecting.reset({}).responds({}))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      CollectionDeclarationSetting({ root }).is({ name, direction }),
    )
    .then(Collecting.declare({ name, direction })),
);

export const SettingsCollectionDeclarationFailuresDiagnose = reaction(
  ({ root, name, direction, error, detail }) =>
    when(Collecting.declare({ name, direction }).refuses({ error, detail }))
      .where(
        earlier(Phasing.start, {}, { phase: "settings" }),
        Configuring._active({}).is({ root }),
        CollectionDeclarationSetting({ root }).is({ name, direction }),
      )
      .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
