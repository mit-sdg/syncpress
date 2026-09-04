/** Stable names used by the batch static-site composition. */
export const CONFIGURATION_PATH = "site.yaml";

export const DIAGNOSTIC_SCOPES = {
  cataloging: "collection-indexing",
  configuration: "configuration-assessment",
  rendering: "page-rendering",
  settings: "configuration-settings",
  staging: "project-staging",
} as const;

export const ROOTS = {
  content: "content",
  project: "project",
  public: "public",
  templates: "templates",
} as const;

/** Locating names for the host locations one run records, grounds, and admits. */
export const PLACES = {
  base: "site",
  destination: "destination",
  output: "output",
  settings: "settings",
} as const;

export const PHASES = ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"];
export const PHASE_SEQUENCE = "site-build";

export const PAGE_PATTERNS = {
  html: "**/*.html",
  markdown: "**/*.md",
  raster: "**/*.{avif,gif,jpeg,jpg,png,webp}",
} as const;

export const PARTS = {
  body: "body",
  excerpt: "excerpt",
  layout: "layout",
} as const;

export const PAGE_CONTENT_PATH = ["page", "content"] as const;

export const PROFILES = {
  markdown: "markdown",
  verbatim: "verbatim",
} as const;

export const PATHS = {
  buildPublish: ["build", "publish"],
  buildRoute: ["build", "route"],
} as const;

export const MAX_PAGE_LAYER_RANK = Number.MAX_SAFE_INTEGER;

/** Templating capability granted to collection-card excerpts by this composition. */
export const TRUSTED_COLLECTION_EXCERPTS = {
  wildcard: ["collections", "*", "*", "excerpt"],
} as const;
