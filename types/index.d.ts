export type Diagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  source?: string;
  line?: number;
  column?: number;
};

export type FeedPolicy = {
  collection: string;
  path: string;
  title?: string;
  description?: string;
};

export type SiteValue = null | boolean | number | string | SiteValue[] | { [key: string]: SiteValue };

export type SitePolicy = {
  paths: {
    content: string;
    templates: string;
    public: string;
    assets: string;
    output: string;
  };
  site: { [key: string]: SiteValue };
  defaults: Array<{ index: number; match: string; values: { [key: string]: SiteValue } }>;
  collections: Array<{
    name: string;
    match: string;
    direction: "asc" | "desc";
    sort: string | null;
    condition:
      | { test: "equals" | "contains"; field: string; value: SiteValue }
      | { test: "exists"; field: string }
      | null;
  }>;
  markdown: { extensions: string[]; raw: boolean; excerptSeparator: string };
  images: { widths: number[]; formats: string[] };
  deploy: {
    nojekyll: boolean;
    requireNotFound: boolean;
    sitemap: boolean;
    feed?: FeedPolicy;
    redirects: Array<{ from: string; to: string }>;
    pagination: Array<{
      name: string;
      collection: string;
      perPage: number;
      route: string;
      template: string;
      title?: string;
    }>;
  };
};

export type BuildResult = {
  pages: number;
  inputFiles: number;
  written: number;
  replaced: number;
  kept: number;
  removed: number;
  policy: SitePolicy;
  diagnostics: Diagnostic[];
};

export type SiteWatcher = { close(): Promise<void> };

export type DevelopmentServer = {
  host: string;
  port: number;
  close(): Promise<void>;
};

export type InspectionResult = {
  target: string;
  owner: string;
  route?: string;
  source?: { path: string; digest: string };
  template?: { name: string; digest: string; tree: unknown };
  layers: unknown[];
  origins: unknown[];
  rendering?: unknown;
  renderings: unknown[];
  memberships: Array<{ collection: string; name: string; index: number }>;
  dependencies: {
    state: Array<{ state: string }>;
    reason?: string;
    inputs: Array<{ input: string }>;
  };
  outputs: Array<{ path: string; digest: string; medium: string }>;
  claims: Array<{ owner: string; address: string }>;
  diagnostics: Array<Diagnostic & {
    related: Array<{ source: string; line?: number; column?: number; note: string }>;
  }>;
};

export function runCli(args?: string[]): Promise<void>;
export function buildSite(projectDirectory?: string, destination?: string): Promise<BuildResult>;
export function inspectSite(projectDirectory: string, target: string): Promise<InspectionResult>;
export function watchSite(
  projectDirectory?: string,
  destination?: string,
  options?: {
    onBuild?: (result: BuildResult, outputDirectory: string) => void;
    onError?: (error: unknown) => void;
  },
): Promise<SiteWatcher>;
export function serveSite(
  projectDirectory?: string,
  destination?: string,
  options?: {
    host?: string;
    port?: number;
    onError?: (error: unknown) => void;
  },
): Promise<DevelopmentServer>;
