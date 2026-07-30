import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from "yaml";
import { isCanonicalAddress } from "./concepts/routing/routing.ts";

export type ConfigurationProblem = {
  code: "INVALID_CONFIGURATION";
  message: string;
  line: number;
  column: number;
};

export type FeedPolicy = {
  collection: string;
  path: string;
  title?: string;
  description?: string;
};

export type RedirectPolicy = { from: string; to: string };

export type PaginationPolicy = {
  name: string;
  collection: string;
  perPage: number;
  route: string;
  template: string;
  title?: string;
};

export type SitePolicy = {
  outputPath: string;
  deploy: {
    nojekyll: boolean;
    requireNotFound: boolean;
    sitemap: boolean;
    feed?: FeedPolicy;
    redirects: RedirectPolicy[];
    pagination: PaginationPolicy[];
  };
};

type Mapping = Map<string, Node | null>;

const TOP_LEVEL_KEYS = new Set(["site", "paths", "defaults", "collections", "images", "markdown", "deploy"]);
const PATH_KEYS = new Set(["content", "templates", "public", "assets", "output"]);
const DEPLOY_KEYS = new Set(["nojekyll", "requireNotFound", "sitemap", "feed", "redirects", "pagination"]);
const DEFAULT_PATHS = { output: "dist" };

function mapping(node: Node | null | undefined): Mapping | undefined {
  if (!isMap(node)) return undefined;
  const entries = new Map<string, Node | null>();
  for (const pair of node.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== "string") return undefined;
    entries.set(pair.key.value, pair.value as Node | null);
  }
  return entries;
}

function location(counter: LineCounter, node: Node | null | undefined): { line: number; column: number } {
  const position = counter.linePos(node?.range?.[0] ?? 0);
  return { line: position.line, column: position.col };
}

function problem(problems: ConfigurationProblem[], counter: LineCounter, node: Node | null | undefined, message: string): void {
  problems.push({ code: "INVALID_CONFIGURATION", message, ...location(counter, node) });
}

function stringValue(
  entries: Mapping | undefined,
  key: string,
  otherwise: string | undefined,
  problems: ConfigurationProblem[],
  counter: LineCounter,
): string | undefined {
  const node = entries?.get(key);
  if (node === undefined) return otherwise;
  if (!isScalar(node) || typeof node.value !== "string") {
    problem(problems, counter, node, `${key} must be a string.`);
    return otherwise;
  }
  return node.value;
}

function booleanValue(
  entries: Mapping | undefined,
  key: string,
  otherwise: boolean,
  problems: ConfigurationProblem[],
  counter: LineCounter,
): boolean {
  const node = entries?.get(key);
  if (node === undefined) return otherwise;
  if (!isScalar(node) || typeof node.value !== "boolean") {
    problem(problems, counter, node, `${key} must be a boolean.`);
    return otherwise;
  }
  return node.value;
}

function positiveIntegerValue(
  entries: Mapping,
  key: string,
  problems: ConfigurationProblem[],
  counter: LineCounter,
): number | undefined {
  const node = entries.get(key);
  if (!isScalar(node) || typeof node.value !== "number" || !Number.isSafeInteger(node.value) || node.value <= 0) {
    problem(problems, counter, node, `${key} must be a positive safe integer.`);
    return undefined;
  }
  return node.value;
}

function checkKnownKeys(entries: Mapping, allowed: ReadonlySet<string>, label: string, problems: ConfigurationProblem[], counter: LineCounter): void {
  for (const [key, node] of entries) {
    if (!allowed.has(key)) problem(problems, counter, node, `${label}.${key} is not a supported setting.`);
  }
}

function portableDirectory(value: string): boolean {
  return value !== "" &&
    value.isWellFormed() &&
    value.normalize("NFC") === value &&
    !value.startsWith("/") &&
    !/^[a-z]:\//i.test(value) &&
    !value.includes("\\") &&
    value.split("/").every((segment) =>
      segment !== "" && segment !== "." && segment !== ".." && !/[\u0000-\u001f\u007f]/u.test(segment));
}

function portableOutputPath(value: string): boolean {
  return portableDirectory(value) && !value.includes("\u0000");
}

function canonicalAddress(value: string): boolean {
  return isCanonicalAddress(value);
}

function externalRedirectTarget(value: string): boolean {
  if (!/^https?:\/\//.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseDefaults(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): void {
  if (node === undefined) return;
  if (!isSeq(node)) {
    problem(problems, counter, node, "defaults must be a sequence.");
    return;
  }
  for (const rule of node.items) {
    const entries = mapping(rule as Node | null);
    if (entries === undefined) {
      problem(problems, counter, rule as Node | null, "Each defaults entry must be a mapping.");
      continue;
    }
    const match = stringValue(entries, "match", undefined, problems, counter);
    if (match === undefined) problem(problems, counter, rule as Node | null, "Each defaults entry needs a match string.");
    const values = entries.get("values");
    if (mapping(values) === undefined) problem(problems, counter, values, "Each defaults entry needs a values mapping.");
  }
}

function parseCollections(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): void {
  if (node === undefined) return;
  const collections = mapping(node);
  if (collections === undefined) {
    problem(problems, counter, node, "collections must be a mapping.");
    return;
  }
  for (const [name, ruleNode] of collections) {
    const rule = mapping(ruleNode);
    if (rule === undefined) {
      problem(problems, counter, ruleNode, `collections.${name} must be a mapping.`);
      continue;
    }
    if (stringValue(rule, "match", undefined, problems, counter) === undefined) {
      problem(problems, counter, ruleNode, `collections.${name} needs a match string.`);
    }
    const sort = rule.get("sort");
    if (sort !== undefined) {
      const values = mapping(sort);
      if (values === undefined) {
        problem(problems, counter, sort, `collections.${name}.sort must be a mapping.`);
      } else {
        stringValue(values, "by", undefined, problems, counter);
        const order = stringValue(values, "order", "asc", problems, counter);
        if (order !== "asc" && order !== "desc") problem(problems, counter, values.get("order"), "sort.order must be asc or desc.");
      }
    }
    const where = rule.get("where");
    if (where !== undefined) {
      const values = mapping(where);
      if (values === undefined) {
        problem(problems, counter, where, `collections.${name}.where must be a mapping.`);
      } else {
        const field = stringValue(values, "field", undefined, problems, counter);
        if (field === undefined) problem(problems, counter, where, `collections.${name}.where needs a field string.`);
        const predicates = ["equals", "contains", "exists"].filter((key) => values.has(key));
        if (predicates.length !== 1) problem(problems, counter, where, `collections.${name}.where needs exactly one predicate.`);
        if (values.has("exists") && booleanValue(values, "exists", false, problems, counter) !== true) {
          problem(problems, counter, values.get("exists"), "where.exists must be true.");
        }
      }
    }
  }
}

function parseImages(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): void {
  if (node === undefined) return;
  const images = mapping(node);
  if (images === undefined) {
    problem(problems, counter, node, "images must be a mapping.");
    return;
  }
  const widths = images.get("widths");
  if (widths !== undefined) {
    if (!isSeq(widths) || widths.items.some((item) => !isScalar(item) || typeof item.value !== "number" || !Number.isSafeInteger(item.value) || item.value <= 0)) {
      problem(problems, counter, widths, "images.widths must be a sequence of positive safe integers.");
    }
  }
  const formats = images.get("formats");
  const supported = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp", "original"]);
  if (formats !== undefined) {
    if (!isSeq(formats) || formats.items.some((item) => !isScalar(item) || typeof item.value !== "string" || !supported.has(item.value))) {
      problem(problems, counter, formats, "images.formats must be a sequence of supported rendition formats.");
    }
  }
}

function parseMarkdown(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): void {
  if (node === undefined) return;
  const markdown = mapping(node);
  if (markdown === undefined) {
    problem(problems, counter, node, "markdown must be a mapping.");
    return;
  }
  const extensions = markdown.get("extensions");
  if (extensions !== undefined && (!isSeq(extensions) || extensions.items.some((item) => !isScalar(item) || typeof item.value !== "string"))) {
    problem(problems, counter, extensions, "markdown.extensions must be a sequence of strings.");
  }
  booleanValue(markdown, "raw", true, problems, counter);
  stringValue(markdown, "excerptSeparator", "", problems, counter);
}

function parseFeed(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): FeedPolicy | undefined {
  if (node === undefined || (isScalar(node) && node.value === false)) return undefined;
  const feed = mapping(node);
  if (feed === undefined) {
    problem(problems, counter, node, "deploy.feed must be false or a mapping.");
    return undefined;
  }
  const collection = stringValue(feed, "collection", undefined, problems, counter);
  const path = stringValue(feed, "path", "feed.xml", problems, counter);
  const title = stringValue(feed, "title", undefined, problems, counter);
  const description = stringValue(feed, "description", undefined, problems, counter);
  if (collection === undefined) problem(problems, counter, node, "deploy.feed needs a collection string.");
  if (path === undefined || !portableOutputPath(path)) problem(problems, counter, feed.get("path"), "deploy.feed.path must be a portable output path.");
  return collection === undefined || path === undefined ? undefined : { collection, path, ...(title === undefined ? {} : { title }), ...(description === undefined ? {} : { description }) };
}

function parseRedirects(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): RedirectPolicy[] {
  if (node === undefined) return [];
  const redirects = mapping(node);
  if (redirects === undefined) {
    problem(problems, counter, node, "deploy.redirects must be a mapping from source routes to targets.");
    return [];
  }
  const policies: RedirectPolicy[] = [];
  const locations = new Map<string, Node | null>();
  for (const [from, target] of redirects) {
    if (!canonicalAddress(from)) {
      problem(problems, counter, target, "Each redirect source must be a canonical site-relative route.");
      continue;
    }
    if (!isScalar(target) || typeof target.value !== "string" || target.value === "") {
      problem(problems, counter, target, "Each redirect target must be a nonempty URL or canonical site-relative route.");
      continue;
    }
    if (!canonicalAddress(target.value) && !externalRedirectTarget(target.value)) {
      problem(problems, counter, target, "Each redirect target must be a nonempty URL or canonical site-relative route.");
      continue;
    }
    policies.push({ from, to: target.value });
    locations.set(from, target);
  }
  const bySource = new Map(policies.map((policy) => [policy.from, policy]));
  const reported = new Set<string>();
  for (const policy of policies) {
    const chain: string[] = [];
    const positions = new Map<string, number>();
    let current = policy.from;
    while (true) {
      const position = positions.get(current);
      if (position !== undefined) {
        const cycle = chain.slice(position);
        const identity = [...cycle].sort().join("\u0000");
        if (!reported.has(identity)) {
          reported.add(identity);
          problem(
            problems,
            counter,
            locations.get(cycle[0]!) ?? node,
            `deploy.redirects contains a cycle: ${[...cycle, cycle[0]!].join(" -> ")}.`,
          );
        }
        break;
      }
      positions.set(current, chain.length);
      chain.push(current);
      const target = bySource.get(current)?.to;
      if (target === undefined || !target.startsWith("/")) break;
      current = target;
    }
  }
  return policies.sort((left, right) => left.from.localeCompare(right.from));
}

function parsePagination(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): PaginationPolicy[] {
  if (node === undefined) return [];
  const rules = mapping(node);
  if (rules === undefined) {
    problem(problems, counter, node, "deploy.pagination must be a mapping.");
    return [];
  }
  const policies: PaginationPolicy[] = [];
  for (const [name, ruleNode] of rules) {
    const rule = mapping(ruleNode);
    if (rule === undefined) {
      problem(problems, counter, ruleNode, `deploy.pagination.${name} must be a mapping.`);
      continue;
    }
    const collection = stringValue(rule, "collection", undefined, problems, counter);
    const perPage = positiveIntegerValue(rule, "perPage", problems, counter);
    const route = stringValue(rule, "route", undefined, problems, counter);
    const template = stringValue(rule, "template", "page.html", problems, counter);
    const title = stringValue(rule, "title", undefined, problems, counter);
    if (collection === undefined) problem(problems, counter, ruleNode, `deploy.pagination.${name} needs a collection string.`);
    if (route === undefined || route.split(":page").length !== 2 || !canonicalAddress(route.replace(":page", "1"))) {
      problem(problems, counter, rule.get("route"), `deploy.pagination.${name}.route must contain one :page in a canonical route.`);
    }
    if (template === undefined) problem(problems, counter, ruleNode, `deploy.pagination.${name} needs a template string.`);
    if (collection !== undefined && perPage !== undefined && route !== undefined && template !== undefined) {
      policies.push({ name, collection, perPage, route, template, ...(title === undefined ? {} : { title }) });
    }
  }
  return policies.sort((left, right) => left.name.localeCompare(right.name));
}

/** Parse the product-owned portion of a valid Syncpress YAML configuration. */
export function parseSitePolicy(source: string): { policy: SitePolicy; problems: ConfigurationProblem[] } {
  const counter = new LineCounter();
  const document = parseDocument(source, { lineCounter: counter, prettyErrors: false, schema: "core", version: "1.2" });
  const problems: ConfigurationProblem[] = [];
  const root = mapping(document.contents);
  if (root === undefined) {
    problem(problems, counter, document.contents, "The site configuration must be a mapping.");
    return {
      policy: { outputPath: DEFAULT_PATHS.output, deploy: { nojekyll: false, requireNotFound: false, sitemap: false, redirects: [], pagination: [] } },
      problems,
    };
  }

  checkKnownKeys(root, TOP_LEVEL_KEYS, "site.yaml", problems, counter);
  const paths = root.get("paths") === undefined ? undefined : mapping(root.get("paths"));
  if (root.has("paths") && paths === undefined) problem(problems, counter, root.get("paths"), "paths must be a mapping.");
  if (paths !== undefined) {
    checkKnownKeys(paths, PATH_KEYS, "paths", problems, counter);
    for (const key of PATH_KEYS) {
      const value = stringValue(paths, key, key === "output" ? DEFAULT_PATHS.output : undefined, problems, counter);
      if (value !== undefined && !portableDirectory(value)) problem(problems, counter, paths.get(key), `paths.${key} must be a portable project-relative directory path.`);
    }
  }
  const outputPath = stringValue(paths, "output", DEFAULT_PATHS.output, problems, counter) ?? DEFAULT_PATHS.output;

  const site = root.get("site") === undefined ? undefined : mapping(root.get("site"));
  if (root.has("site") && site === undefined) problem(problems, counter, root.get("site"), "site must be a mapping.");
  if (site !== undefined) {
    stringValue(site, "basePath", "/", problems, counter);
    stringValue(site, "origin", undefined, problems, counter);
  }

  parseDefaults(root.get("defaults"), problems, counter);
  parseCollections(root.get("collections"), problems, counter);
  parseImages(root.get("images"), problems, counter);
  parseMarkdown(root.get("markdown"), problems, counter);

  const deployNode = root.get("deploy");
  const deploy = deployNode === undefined ? undefined : mapping(deployNode);
  if (root.has("deploy") && deploy === undefined) problem(problems, counter, root.get("deploy"), "deploy must be a mapping.");
  if (deploy !== undefined) checkKnownKeys(deploy, DEPLOY_KEYS, "deploy", problems, counter);
  const nojekyll = booleanValue(deploy, "nojekyll", false, problems, counter);
  const requireNotFound = booleanValue(deploy, "requireNotFound", false, problems, counter);
  const sitemap = booleanValue(deploy, "sitemap", false, problems, counter);
  const feed = parseFeed(deploy?.get("feed"), problems, counter);
  const redirects = parseRedirects(deploy?.get("redirects"), problems, counter);
  const pagination = parsePagination(deploy?.get("pagination"), problems, counter);
  const origin = stringValue(site, "origin", undefined, problems, counter);
  if ((sitemap || feed !== undefined) && origin === undefined) {
    problem(problems, counter, deployNode ?? document.contents, "site.origin is required when sitemap or feed generation is enabled.");
  }

  return { policy: { outputPath, deploy: { nojekyll, requireNotFound, sitemap, ...(feed === undefined ? {} : { feed }), redirects, pagination } }, problems };
}
