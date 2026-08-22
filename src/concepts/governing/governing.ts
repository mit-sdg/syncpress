import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from "yaml";
import { isPortableGlob } from "@compositions/computations.ts";

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

export type SiteValue = null | boolean | number | string | SiteValue[] | SiteValues;
export type SiteValues = { [key: string]: SiteValue };
export type CatalogCondition =
  | { test: "equals" | "contains"; field: string; value: SiteValue }
  | { test: "exists"; field: string };
export type DefaultPolicy = { index: number; match: string; values: SiteValues };
export type CollectionPolicy = {
  name: string;
  match: string;
  direction: "asc" | "desc";
  sort: string | null;
  condition: CatalogCondition | null;
};

export type SitePolicy = {
  paths: {
    content: string;
    templates: string;
    public: string;
    assets: string;
    output: string;
  };
  site: SiteValues;
  defaults: DefaultPolicy[];
  collections: CollectionPolicy[];
  markdown: { extensions: string[]; raw: boolean; excerptSeparator: string };
  images: { widths: number[]; formats: string[] };
  deploy: {
    nojekyll: boolean;
    requireNotFound: boolean;
    sitemap: boolean;
    feed?: FeedPolicy;
    redirects: RedirectPolicy[];
    pagination: PaginationPolicy[];
  };
};

export type SiteSource = {
  name: "content" | "templates" | "public";
  path: string;
};

type Mapping = Map<string, Node | null>;

const TOP_LEVEL_KEYS = new Set(["site", "paths", "defaults", "collections", "images", "markdown", "deploy"]);
const PATH_KEYS = new Set<keyof SitePolicy["paths"]>(["content", "templates", "public", "assets", "output"]);
const DEPLOY_KEYS = new Set(["nojekyll", "requireNotFound", "sitemap", "feed", "redirects", "pagination"]);
const SORT_KEYS = new Set(["by", "order"]);
const CONDITION_KEYS = new Set(["field", "equals", "contains", "exists"]);
const DEFAULT_PATHS = {
  content: "content",
  templates: "templates",
  public: "public",
  assets: "assets",
  output: "dist",
};
const DEFAULT_MARKDOWN = {
  extensions: ["tables", "footnotes", "strikethrough", "autolinks"],
  raw: true,
  excerptSeparator: "",
};
const DEFAULT_IMAGES = { widths: [480, 960, 1440], formats: ["avif", "webp", "original"] };
const addressEncoder = new TextEncoder();
const literalAddressCharacter = /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/;
const forbiddenAddressSegmentCharacter = /[\\/\u0000-\u001f\u007f]/u;
const catalogFieldPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

function addressText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function addressSegment(value: unknown): value is string {
  return addressText(value) && value !== "" && value !== "." && value !== ".." &&
    value.normalize("NFC") === value && !forbiddenAddressSegmentCharacter.test(value);
}

function encodeAddressSegment(segment: string): string {
  let encoded = "";
  for (const character of segment) {
    if (literalAddressCharacter.test(character)) encoded += character;
    else for (const byte of addressEncoder.encode(character)) encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return encoded;
}

function parseAddress(address: unknown): { directory: boolean } | undefined {
  if (!addressText(address) || !address.startsWith("/") || address.startsWith("//")) return undefined;
  if (address === "/") return { directory: true };
  const directory = address.endsWith("/");
  const body = address.slice(1, directory ? -1 : address.length);
  if (body === "") return undefined;
  const segments: string[] = [];
  for (const encoded of body.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      return undefined;
    }
    if (!addressSegment(decoded) || encodeAddressSegment(decoded) !== encoded) return undefined;
    segments.push(decoded);
  }
  return !directory && segments.at(-1) === "index.html" ? undefined : { directory };
}

function isCanonicalAddress(value: unknown): value is string {
  return parseAddress(value) !== undefined;
}

function canonicalOrigin(value: unknown): string | undefined {
  if (!addressText(value)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.origin === value.replace(/\/$/, "")
    ? parsed.origin
    : undefined;
}

function catalogField(value: string): boolean {
  return addressText(value) && catalogFieldPattern.test(value);
}

function catalogValue(value: SiteValue): boolean {
  if (typeof value === "string") return addressText(value);
  if (value === null || typeof value !== "object") return true;
  if (Array.isArray(value)) return value.every(catalogValue);
  return Object.entries(value).every(([key, member]) => addressText(key) && catalogValue(member));
}

export class InvalidConfiguration extends Error {
  constructor() {
    super("The assessed site configuration is invalid.");
    this.name = "InvalidConfiguration";
  }
}

function defaultPolicy(): SitePolicy {
  return {
    paths: { ...DEFAULT_PATHS },
    site: {},
    defaults: [],
    collections: [],
    markdown: structuredClone(DEFAULT_MARKDOWN),
    images: structuredClone(DEFAULT_IMAGES),
    deploy: { nojekyll: false, requireNotFound: false, sitemap: false, redirects: [], pagination: [] },
  };
}

function siteSources(policy: SitePolicy): SiteSource[] {
  return [
    { name: "content", path: policy.paths.content },
    { name: "templates", path: policy.paths.templates },
    { name: "public", path: policy.paths.public },
  ];
}

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

function stringValue<T extends string | undefined>(
  entries: Mapping | undefined,
  key: string,
  otherwise: T,
  problems: ConfigurationProblem[],
  counter: LineCounter,
): string | T {
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

function portableRelativePath(value: string): boolean {
  return value !== "" &&
    value.isWellFormed() &&
    value.normalize("NFC") === value &&
    !value.startsWith("/") &&
    !/^[a-z]:\//i.test(value) &&
    !value.includes("\\") &&
    value.split("/").every((segment) =>
      segment !== "" && segment !== "." && segment !== ".." && !/[\u0000-\u001f\u007f]/u.test(segment));
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

function defineValue(record: SiteValues, key: string, value: SiteValue): void {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
}

function normalizeNode(node: Node | null | undefined): SiteValue | undefined {
  if (isScalar(node)) {
    const value = node.value;
    return value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
      ? value
      : undefined;
  }
  if (isSeq(node)) {
    const values: SiteValue[] = [];
    for (const item of node.items) {
      const value = normalizeNode(item as Node | null);
      if (value === undefined) return undefined;
      values.push(value);
    }
    return values;
  }
  if (!isMap(node)) return undefined;
  const values: SiteValues = {};
  for (const pair of node.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== "string") return undefined;
    const value = normalizeNode(pair.value as Node | null);
    if (value === undefined) return undefined;
    defineValue(values, pair.key.value, value);
  }
  return values;
}

function normalizedMapping(node: Node | null | undefined): SiteValues | undefined {
  const value = normalizeNode(node);
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function parseDefaults(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): DefaultPolicy[] {
  if (node === undefined) return [];
  if (!isSeq(node)) {
    problem(problems, counter, node, "defaults must be a sequence.");
    return [];
  }
  const policies: DefaultPolicy[] = [];
  for (const [index, rule] of node.items.entries()) {
    const entries = mapping(rule as Node | null);
    if (entries === undefined) {
      problem(problems, counter, rule as Node | null, "Each defaults entry must be a mapping.");
      continue;
    }
    const match = stringValue(entries, "match", undefined, problems, counter);
    if (match === undefined) problem(problems, counter, rule as Node | null, "Each defaults entry needs a match string.");
    else if (!isPortableGlob(match)) problem(problems, counter, entries.get("match"), `defaults[${index}].match must be a valid portable glob.`);
    const values = entries.get("values");
    const normalizedValues = normalizedMapping(values);
    if (normalizedValues === undefined) problem(problems, counter, values, "Each defaults entry needs a values mapping.");
    if (match !== undefined && normalizedValues !== undefined) policies.push({ index, match, values: normalizedValues });
  }
  return policies;
}

function parseCollections(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): CollectionPolicy[] {
  if (node === undefined) return [];
  const collections = mapping(node);
  if (collections === undefined) {
    problem(problems, counter, node, "collections must be a mapping.");
    return [];
  }
  const policies: CollectionPolicy[] = [];
  for (const [name, ruleNode] of collections) {
    const rule = mapping(ruleNode);
    if (rule === undefined) {
      problem(problems, counter, ruleNode, `collections.${name} must be a mapping.`);
      continue;
    }
    const match = stringValue(rule, "match", undefined, problems, counter);
    if (match === undefined) {
      problem(problems, counter, ruleNode, `collections.${name} needs a match string.`);
    } else if (!isPortableGlob(match)) {
      problem(problems, counter, rule.get("match"), `collections.${name}.match must be a valid portable glob.`);
    }
    let sortBy: string | null = null;
    let direction: "asc" | "desc" = "asc";
    const sort = rule.get("sort");
    if (sort !== undefined) {
      const values = mapping(sort);
      if (values === undefined) {
        problem(problems, counter, sort, `collections.${name}.sort must be a mapping.`);
      } else {
        checkKnownKeys(values, SORT_KEYS, `collections.${name}.sort`, problems, counter);
        const by = stringValue(values, "by", undefined, problems, counter);
        if (!values.has("by")) problem(problems, counter, sort, `collections.${name}.sort needs a by field.`);
        else if (by !== undefined && !catalogField(by)) {
          problem(problems, counter, values.get("by"), `collections.${name}.sort.by must use dotted ASCII segments.`);
        } else if (by !== undefined) sortBy = by;
        const order = stringValue(values, "order", "asc", problems, counter);
        if (order !== "asc" && order !== "desc") problem(problems, counter, values.get("order"), "sort.order must be asc or desc.");
        else direction = order;
      }
    }
    let condition: CatalogCondition | null = null;
    const where = rule.get("where");
    if (where !== undefined) {
      const values = mapping(where);
      if (values === undefined) {
        problem(problems, counter, where, `collections.${name}.where must be a mapping.`);
      } else {
        checkKnownKeys(values, CONDITION_KEYS, `collections.${name}.where`, problems, counter);
        const field = stringValue(values, "field", undefined, problems, counter);
        if (field === undefined) problem(problems, counter, where, `collections.${name}.where needs a field string.`);
        else if (!catalogField(field)) {
          problem(problems, counter, values.get("field"), `collections.${name}.where.field must use dotted ASCII segments.`);
        }
        const predicates = ["equals", "contains", "exists"].filter((key) => values.has(key));
        if (predicates.length !== 1) problem(problems, counter, where, `collections.${name}.where needs exactly one predicate.`);
        const validExists = !values.has("exists") || booleanValue(values, "exists", false, problems, counter) === true;
        if (!validExists) {
          problem(problems, counter, values.get("exists"), "where.exists must be true.");
        }
        if (field !== undefined && catalogField(field) && predicates.length === 1 && validExists) {
          const predicate = predicates[0]!;
          if (predicate === "exists") condition = { test: "exists", field };
          else {
            const value = normalizeNode(values.get(predicate));
            if (value === undefined || !catalogValue(value)) {
              problem(
                problems,
                counter,
                values.get(predicate),
                `collections.${name}.where.${predicate} must be a supported configuration value.`,
              );
            } else condition = { test: predicate as "equals" | "contains", field, value };
          }
        }
      }
    }
    if (match !== undefined) policies.push({ name, match, direction, sort: sortBy, condition });
  }
  return policies.sort((left, right) => left.name.localeCompare(right.name));
}

function parseImages(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): SitePolicy["images"] {
  const settings = structuredClone(DEFAULT_IMAGES);
  if (node === undefined) return settings;
  const images = mapping(node);
  if (images === undefined) {
    problem(problems, counter, node, "images must be a mapping.");
    return settings;
  }
  const widths = images.get("widths");
  if (widths !== undefined) {
    if (!isSeq(widths) || widths.items.some((item) => !isScalar(item) || typeof item.value !== "number" || !Number.isSafeInteger(item.value) || item.value <= 0)) {
      problem(problems, counter, widths, "images.widths must be a sequence of positive safe integers.");
    } else settings.widths = widths.items.map((item) => (item as { value: number }).value);
  }
  const formats = images.get("formats");
  const supported = new Set(["avif", "gif", "jpeg", "jpg", "png", "webp", "original"]);
  if (formats !== undefined) {
    if (!isSeq(formats) || formats.items.some((item) => !isScalar(item) || typeof item.value !== "string" || !supported.has(item.value))) {
      problem(problems, counter, formats, "images.formats must be a sequence of supported rendition formats.");
    } else settings.formats = formats.items.map((item) => (item as { value: string }).value);
  }
  return settings;
}

function parseMarkdown(node: Node | null | undefined, problems: ConfigurationProblem[], counter: LineCounter): SitePolicy["markdown"] {
  const settings = structuredClone(DEFAULT_MARKDOWN);
  if (node === undefined) return settings;
  const markdown = mapping(node);
  if (markdown === undefined) {
    problem(problems, counter, node, "markdown must be a mapping.");
    return settings;
  }
  const extensions = markdown.get("extensions");
  if (extensions !== undefined && (!isSeq(extensions) || extensions.items.some((item) => !isScalar(item) || typeof item.value !== "string"))) {
    problem(problems, counter, extensions, "markdown.extensions must be a sequence of strings.");
  } else if (isSeq(extensions)) settings.extensions = extensions.items.map((item) => (item as { value: string }).value);
  settings.raw = booleanValue(markdown, "raw", true, problems, counter);
  settings.excerptSeparator = stringValue(markdown, "excerptSeparator", "", problems, counter);
  return settings;
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
  else if (collection === "") problem(problems, counter, feed.get("collection"), "deploy.feed.collection must not be empty.");
  if (!portableRelativePath(path)) problem(problems, counter, feed.get("path"), "deploy.feed.path must be a portable output path.");
  return collection === undefined || collection === ""
    ? undefined
    : { collection, path, ...(title === undefined ? {} : { title }), ...(description === undefined ? {} : { description }) };
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
    if (!isCanonicalAddress(from)) {
      problem(problems, counter, target, "Each redirect source must be a canonical site-relative route.");
      continue;
    }
    if (!isScalar(target) || typeof target.value !== "string" || target.value === "") {
      problem(problems, counter, target, "Each redirect target must be a nonempty URL or canonical site-relative route.");
      continue;
    }
    if (!isCanonicalAddress(target.value) && !externalRedirectTarget(target.value)) {
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
    if (name === "") problem(problems, counter, ruleNode, "deploy.pagination names must not be empty.");
    if (collection === undefined) problem(problems, counter, ruleNode, `deploy.pagination.${name} needs a collection string.`);
    else if (collection === "") problem(problems, counter, rule.get("collection"), `deploy.pagination.${name}.collection must not be empty.`);
    if (template === "") problem(problems, counter, rule.get("template"), `deploy.pagination.${name}.template must not be empty.`);
    if (route === undefined || route.split(":page").length !== 2 || !isCanonicalAddress(route.replace(":page", "1"))) {
      problem(problems, counter, rule.get("route"), `deploy.pagination.${name}.route must contain one :page in a canonical route.`);
    }
    if (name !== "" && collection !== undefined && collection !== "" && perPage !== undefined && route !== undefined && template !== "") {
      policies.push({ name, collection, perPage, route, template, ...(title === undefined ? {} : { title }) });
    }
  }
  return policies.sort((left, right) => left.name.localeCompare(right.name));
}

/** Parse the product-owned portion of a valid Syncpress YAML configuration. */
export function parseSitePolicy(source: string): { policy: SitePolicy; problems: ConfigurationProblem[] } {
  const counter = new LineCounter();
  const document = parseDocument(source, {
    customTags: [],
    lineCounter: counter,
    merge: false,
    prettyErrors: false,
    resolveKnownTags: false,
    schema: "core",
    strict: true,
    uniqueKeys: true,
    version: "1.2",
  });
  const problems: ConfigurationProblem[] = [];
  for (const issue of [...document.errors, ...document.warnings]) {
    const position = counter.linePos(issue.pos[0]);
    problems.push({
      code: "INVALID_CONFIGURATION",
      message: `The site configuration is not valid YAML 1.2: ${issue.message}`,
      line: position.line,
      column: position.col,
    });
  }
  if (document.directives.yaml.version !== "1.2") {
    problem(problems, counter, document.contents, "The site configuration must use YAML 1.2.");
  }
  if (problems.length > 0) return { policy: defaultPolicy(), problems };

  const root = mapping(document.contents);
  if (root === undefined) {
    problem(problems, counter, document.contents, "The site configuration must be a mapping.");
    return { policy: defaultPolicy(), problems };
  }

  checkKnownKeys(root, TOP_LEVEL_KEYS, "site.yaml", problems, counter);
  const paths = root.get("paths") === undefined ? undefined : mapping(root.get("paths"));
  if (root.has("paths") && paths === undefined) problem(problems, counter, root.get("paths"), "paths must be a mapping.");
  const policyPaths = { ...DEFAULT_PATHS };
  if (paths !== undefined) {
    checkKnownKeys(paths, PATH_KEYS, "paths", problems, counter);
    for (const key of PATH_KEYS) {
      const value = stringValue(paths, key, DEFAULT_PATHS[key], problems, counter);
      if (value !== undefined && !portableRelativePath(value)) problem(problems, counter, paths.get(key), `paths.${key} must be a portable project-relative directory path.`);
      if (value !== undefined) policyPaths[key] = value;
    }
  }

  const site = root.get("site") === undefined ? undefined : mapping(root.get("site"));
  if (root.has("site") && site === undefined) problem(problems, counter, root.get("site"), "site must be a mapping.");
  const normalizedSite = site === undefined ? undefined : normalizedMapping(root.get("site"));
  if (site !== undefined && normalizedSite === undefined) {
    problem(problems, counter, root.get("site"), "site must contain only supported configuration values.");
  }
  const siteValues = normalizedSite ?? {};
  let declaredOrigin: string | undefined;
  if (site !== undefined) {
    const base = stringValue(site, "basePath", "/", problems, counter);
    if (parseAddress(base)?.directory !== true) {
      problem(problems, counter, site.get("basePath"), "site.basePath must be a canonical directory address.");
    }
    declaredOrigin = stringValue(site, "origin", undefined, problems, counter);
    if (declaredOrigin !== undefined) {
      const origin = canonicalOrigin(declaredOrigin);
      if (origin === undefined) problem(problems, counter, site.get("origin"), "site.origin must be a canonical HTTP or HTTPS origin.");
      else defineValue(siteValues, "origin", origin);
    }
  }

  const defaults = parseDefaults(root.get("defaults"), problems, counter);
  const collections = parseCollections(root.get("collections"), problems, counter);
  const images = parseImages(root.get("images"), problems, counter);
  const markdown = parseMarkdown(root.get("markdown"), problems, counter);

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
  if ((sitemap || feed !== undefined) && declaredOrigin === undefined) {
    problem(problems, counter, deployNode ?? document.contents, "site.origin is required when sitemap or feed generation is enabled.");
  }

  return {
    policy: {
      paths: policyPaths,
      site: siteValues,
      defaults,
      collections,
      markdown,
      images,
      deploy: { nojekyll, requireNotFound, sitemap, ...(feed === undefined ? {} : { feed }), redirects, pagination },
    },
    problems,
  };
}

type Assessment = {
  source: string;
  policy: SitePolicy;
  problems: ConfigurationProblem[];
};

/** Own Syncpress-specific configuration policy without coupling generic configuration storage to product keys. */
export class GoverningConcept {
  #assessment: Assessment | undefined;

  assess({ source }: { source: string }): { policy: SitePolicy; sources: SiteSource[] } {
    if (this.#assessment?.source !== source) {
      const { policy, problems } = parseSitePolicy(source);
      this.#assessment = {
        source,
        policy: structuredClone(policy),
        problems: structuredClone(problems),
      };
    }
    if (this.#assessment.problems.length > 0) throw new InvalidConfiguration();
    return {
      policy: structuredClone(this.#assessment.policy),
      sources: siteSources(this.#assessment.policy),
    };
  }

  _policy(): { policy: SitePolicy }[] {
    return this.#assessment === undefined || this.#assessment.problems.length > 0
      ? []
      : [{ policy: structuredClone(this.#assessment.policy) }];
  }

  _paths(): { content: string; templates: string; public: string; assets: string; output: string }[] {
    return this.#valid(({ paths }) => ({ ...paths }));
  }

  _sources(): SiteSource[] {
    return this.#assessment === undefined || this.#assessment.problems.length > 0
      ? []
      : siteSources(this.#assessment.policy);
  }

  _site(): { site: SiteValues; base: string }[] {
    return this.#valid(({ site }) => ({ site: structuredClone(site), base: typeof site.basePath === "string" ? site.basePath : "/" }));
  }

  _origin(): { origin: string }[] {
    return this.#valid(({ site }) => typeof site.origin === "string" ? { origin: site.origin } : undefined);
  }

  _markdown(): { extensions: string[]; raw: boolean; separator: string }[] {
    return this.#valid(({ markdown }) => ({ extensions: [...markdown.extensions], raw: markdown.raw, separator: markdown.excerptSeparator }));
  }

  _images(): { widths: number[]; formats: string[] }[] {
    return this.#valid(({ images }) => ({ widths: [...images.widths], formats: [...images.formats] }));
  }

  _defaults(): { index: number; text: string; values: SiteValues }[] {
    return this.#assessment === undefined || this.#assessment.problems.length > 0
      ? []
      : this.#assessment.policy.defaults.map(({ index, match, values }) => ({ index, text: match, values: structuredClone(values) }));
  }

  _collections(): CollectionPolicy[] {
    return this.#assessment === undefined || this.#assessment.problems.length > 0
      ? []
      : structuredClone(this.#assessment.policy.collections);
  }

  _deployment(): { nojekyll: boolean; requireNotFound: boolean; sitemap: boolean }[] {
    const deployment = this.#assessment?.policy.deploy;
    return deployment === undefined || this.#assessment!.problems.length > 0
      ? []
      : [{
          nojekyll: deployment.nojekyll,
          requireNotFound: deployment.requireNotFound,
          sitemap: deployment.sitemap,
        }];
  }

  _publishing(): { policy: SitePolicy["deploy"] }[] {
    return this.#assessment === undefined || this.#assessment.problems.length > 0
      ? []
      : [{ policy: structuredClone(this.#assessment.policy.deploy) }];
  }

  _problems(): ConfigurationProblem[] {
    return structuredClone(this.#assessment?.problems ?? []);
  }

  #valid<Row>(select: (policy: SitePolicy) => Row | undefined): Row[] {
    if (this.#assessment === undefined || this.#assessment.problems.length > 0) return [];
    const row = select(this.#assessment.policy);
    return row === undefined ? [] : [row];
  }
}
