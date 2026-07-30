import { earlier, no, reaction, when, where } from "@mit-sdg/sync-engine/language";
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

const { Cataloging, Configuring, Converting, Diagnosing, Matching, Phasing, Routing } = concepts;

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

export const SettingsResetCatalogs = reaction(() =>
  when(Phasing.start({}).responds({ phase: "settings" })).then(Cataloging.reset({})),
);

export const SettingsDeclareCatalogs = reaction(({ root, name, rule, direction, sort, field, value }) =>
  when(Cataloging.reset({}).responds({}))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._active({}).is({ root }),
      CollectionDeclarationSetting({ root }).is({ name, rule, direction, sort }),
    )
    .then(
      where(no(Configuring._at({ node: rule, path: ["where"] })))
        .then(Cataloging.declare({ name, direction, sort, condition: null }))
        .named("unconditional"),
      where(
        Configuring._at({ node: rule, path: ["where", "field"] }).is({ value: field }),
        Configuring._at({ node: rule, path: PATHS.collectionWhereEquals }).is({ value }),
      )
        .then(Cataloging.declare({ name, direction, sort, condition: { test: "equals", field, value } }))
        .named("equals"),
      where(
        Configuring._at({ node: rule, path: ["where", "field"] }).is({ value: field }),
        Configuring._at({ node: rule, path: PATHS.collectionWhereContains }).is({ value }),
      )
        .then(Cataloging.declare({ name, direction, sort, condition: { test: "contains", field, value } }))
        .named("contains"),
      where(
        Configuring._at({ node: rule, path: ["where", "field"] }).is({ value: field }),
        Configuring._at({ node: rule, path: PATHS.collectionWhereExists }).is({ value: true }),
      )
        .then(Cataloging.declare({ name, direction, sort, condition: { test: "exists", field } }))
        .named("exists"),
    ),
);

export const SettingsCollectionDeclarationFailuresDiagnose = reaction(
  ({ error, detail }) =>
    when(Cataloging.declare({}).refuses({ error, detail }))
      .where(
        earlier(Phasing.start, {}, { phase: "settings" }),
      )
      .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
