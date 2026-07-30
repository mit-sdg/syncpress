/** Shared names and policy defaults for the batch static-site composition. */
export const CONFIGURATION_PATH = "site.yaml";

export const ROOTS = {
  content: "content",
  includes: "includes",
  project: "project",
  public: "public",
  templates: "templates",
} as const;

export const PHASES = ["settings", "read", "route", "excerpt", "collect", "render", "emit"];
export const PHASE_SEQUENCE = "site-build";

export const PAGE_PATTERNS = {
  html: "**/*.html",
  markdown: "**/*.md",
  raster: "**/*.{avif,gif,jpeg,jpg,png,webp}",
} as const;

export const DEFAULTS = {
  assetsPath: "assets",
  basePath: "/",
  contentPath: "content",
  imageFormats: ["avif", "webp", "original"],
  imageWidths: [480, 960, 1440],
  markdownExtensions: ["tables", "footnotes", "strikethrough", "autolinks"],
  markdownRaw: true,
  publicPath: "public",
  template: "page.html",
  templatesPath: "templates",
} as const;

export const PARTS = {
  body: "body",
  card: "card",
  context: "context",
  excerpt: "excerpt",
  layout: "layout",
} as const;

export const PROFILES = {
  markdown: "markdown",
  verbatim: "verbatim",
} as const;

export const PATHS = {
  buildMarkup: ["build", "markup"],
  buildPublish: ["build", "publish"],
  buildRoute: ["build", "route"],
  buildTemplate: ["build", "template"],
  collectionMatch: ["match"],
  collectionSortBy: ["sort", "by"],
  collectionSortOrder: ["sort", "order"],
  collectionWhereContains: ["where", "contains"],
  collectionWhereEquals: ["where", "equals"],
  collectionWhereExists: ["where", "exists"],
  defaults: ["defaults"],
  defaultMatch: ["match"],
  defaultValues: ["values"],
  imagesFormats: ["images", "formats"],
  imagesWidths: ["images", "widths"],
  markdownExtensions: ["markdown", "extensions"],
  markdownExcerptSeparator: ["markdown", "excerptSeparator"],
  markdownRaw: ["markdown", "raw"],
  pathsAssets: ["paths", "assets"],
  pathsContent: ["paths", "content"],
  pathsPublic: ["paths", "public"],
  pathsTemplates: ["paths", "templates"],
  site: ["site"],
  siteBasePath: ["site", "basePath"],
} as const;

export const CONTEXT_PATHS = {
  collections: ["collections"],
  pageContent: ["page", "content"],
  pageData: ["page", "data"],
  pageSourcePath: ["page", "source", "path"],
  pageUrl: ["page", "url"],
  site: ["site"],
} as const;

export const CARD_PATHS = {
  data: ["data"],
  excerpt: ["excerpt"],
  sourcePath: ["source", "path"],
  url: ["url"],
} as const;

export const MAX_PAGE_LAYER_RANK = Number.MAX_SAFE_INTEGER;
