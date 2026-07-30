import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import {
  CONFIGURATION_PATH,
  DEFAULTS,
  PAGE_PATTERNS,
  PATHS,
  PROFILES,
  ROOTS,
} from "./shared.ts";

const { Collecting, Configuring, Converting, Diagnosing, Filing, Matching, Phasing, Routing } = concepts;

/** Load the project configuration when the first build phase begins. */
export const SettingsLoad = reaction(({ project, file, text }) =>
  when(Phasing.start({}).responds({ phase: "settings" }))
    .where(
      Filing._named({ name: ROOTS.project }).is({ root: project }),
      Filing._at({ root: project, path: CONFIGURATION_PATH }).is({ file }),
      Filing._text({ file }).is({ text }),
    )
    .then(Configuring.load({ source: text, notation: "yaml" })),
);

export const SettingsLoadFailuresDiagnose = reaction(({ project, file, text, error, detail }) =>
  when(Configuring.load({ source: text, notation: "yaml" }).refuses({ error, detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Filing._named({ name: ROOTS.project }).is({ root: project }),
      Filing._at({ root: project, path: CONFIGURATION_PATH }).is({ file }),
      Filing._text({ file }).is({ text }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: error,
        message: detail,
        source: CONFIGURATION_PATH,
      }),
    ),
);

/** Make the built-in source selectors available even when configuration has no rules. */
export const FixedPatternsCompile = reaction(() =>
  when(Phasing.start({}).responds({ phase: "settings" })).then(
    Matching.compile({ text: PAGE_PATTERNS.markdown }).named("markdown"),
    Matching.compile({ text: PAGE_PATTERNS.html }).named("html"),
    Matching.compile({ text: PAGE_PATTERNS.raster }).named("raster"),
  ),
);

export const SettingsRebaseRouting = reaction(({ root, base }) =>
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
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
      earlier(Configuring.load, {}, { root }),
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
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._at({ node: root, path: PATHS.siteOrigin }).is({ value: origin }),
    )
    .then(Routing.reorigin({ origin })),
);

/** An omitted origin deliberately clears any origin retained by a long-lived application. */
export const SettingsClearRoutingOrigin = reaction(({ root }) =>
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      no(Configuring._at({ node: root, path: PATHS.siteOrigin })),
    )
    .then(Routing.reorigin({})),
);

export const SettingsReoriginFailuresDiagnose = reaction(({ root, origin, detail }) =>
  when(Routing.reorigin({ origin }).refuses({ error: "INVALID_ORIGIN", detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      earlier(Configuring.load, {}, { root }),
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
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._values({
        node: root,
        path: PATHS.markdownExtensions,
        otherwise: [...DEFAULTS.markdownExtensions],
      }).is({ values: extensions }),
      Configuring._scalar({
        node: root,
        path: PATHS.markdownRaw,
        otherwise: DEFAULTS.markdownRaw,
      }).is({ value: raw }),
      Configuring._scalar({
        node: root,
        path: PATHS.markdownExcerptSeparator,
        otherwise: "",
      }).is({ value: separator }),
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
      earlier(Configuring.load, {}, { root }),
      Configuring._values({
        node: root,
        path: PATHS.markdownExtensions,
        otherwise: [...DEFAULTS.markdownExtensions],
      }).is({ values: extensions }),
      Configuring._scalar({
        node: root,
        path: PATHS.markdownRaw,
        otherwise: DEFAULTS.markdownRaw,
      }).is({ value: raw }),
      Configuring._scalar({
        node: root,
        path: PATHS.markdownExcerptSeparator,
        otherwise: "",
      }).is({ value: separator }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsDeclareVerbatimProfile = reaction(({ root, separator }) =>
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._scalar({
        node: root,
        path: PATHS.markdownExcerptSeparator,
        otherwise: "",
      }).is({ value: separator }),
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
      earlier(Configuring.load, {}, { root }),
      Configuring._scalar({
        node: root,
        path: PATHS.markdownExcerptSeparator,
        otherwise: "",
      }).is({ value: separator }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsCompileDefaultPatterns = reaction(({ root, defaults, rule, text }) =>
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._at({ node: root, path: PATHS.defaults }).is({ found: defaults }),
      Configuring._items({ node: defaults }).is({ item: rule }),
      Configuring._at({ node: rule, path: PATHS.defaultMatch }).is({ value: text }),
    )
    .then(Matching.compile({ text })),
);

export const SettingsDefaultPatternFailuresDiagnose = reaction(({ root, defaults, rule, text, error, detail }) =>
  when(Matching.compile({ text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      earlier(Configuring.load, {}, { root }),
      Configuring._at({ node: root, path: PATHS.defaults }).is({ found: defaults }),
      Configuring._items({ node: defaults }).is({ item: rule }),
      Configuring._at({ node: rule, path: PATHS.defaultMatch }).is({ value: text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsCompileCollectionPatterns = reaction(({ root, collections, rule, text }) =>
  when(Configuring.load({}).responds({ root }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ child: rule }),
      Configuring._at({ node: rule, path: PATHS.collectionMatch }).is({ value: text }),
    )
    .then(Matching.compile({ text })),
);

export const SettingsCollectionPatternFailuresDiagnose = reaction(({ root, collections, rule, text, error, detail }) =>
  when(Matching.compile({ text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      earlier(Configuring.load, {}, { root }),
      Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ child: rule }),
      Configuring._at({ node: rule, path: PATHS.collectionMatch }).is({ value: text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const SettingsResetCollections = reaction(() =>
  when(Configuring.load({}).responds({}))
    .where(earlier(Phasing.start, {}, { phase: "settings" }))
    .then(Collecting.reset({})),
);

export const SettingsDeclareCollections = reaction(({ root, collections, name, rule, direction }) =>
  when(Collecting.reset({}).responds({}))
    .where(
      earlier(Phasing.start, {}, { phase: "settings" }),
      earlier(Configuring.load, {}, { root }),
      Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
      Configuring._entries({ node: collections }).is({ key: name, child: rule }),
      Configuring._scalar({
        node: rule,
        path: PATHS.collectionSortOrder,
        otherwise: "asc",
      }).is({ value: direction }),
    )
    .then(Collecting.declare({ name, direction })),
);

export const SettingsCollectionDeclarationFailuresDiagnose = reaction(
  ({ root, collections, name, rule, direction, error, detail }) =>
    when(Collecting.declare({ name, direction }).refuses({ error, detail }))
      .where(
        earlier(Phasing.start, {}, { phase: "settings" }),
        earlier(Configuring.load, {}, { root }),
        Configuring._at({ node: root, path: ["collections"] }).is({ found: collections }),
        Configuring._entries({ node: collections }).is({ key: name, child: rule }),
        Configuring._scalar({
          node: rule,
          path: PATHS.collectionSortOrder,
          otherwise: "asc",
        }).is({ value: direction }),
      )
      .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
