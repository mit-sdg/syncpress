import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { InvocationResult } from "@mit-sdg/sync-engine/boundary";
import { lstat, mkdtemp, readdir, readFile, realpath, rm, watch } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { SyncpressWire } from "../generated/wire.ts";
import { assembleSyncpress } from "./assembly.ts";
import { TRUSTED_COLLECTION_EXCERPTS } from "./concepts/templating/templating.ts";
import {
  CONFIGURATION_PATH,
  DEFAULTS,
  PATHS,
  ROOTS,
} from "./compositions/full-site/shared.ts";
import { parseSitePolicy, type PaginationPolicy, type SitePolicy } from "./site-policy.ts";

type Application = ReturnType<typeof buildSyncpress>["application"];
type Configuring = Application["concepts"]["Configuring"];
type SourceFile = { path: string; source: string };
type Diagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
  source: string | undefined;
  line: number | undefined;
  column: number | undefined;
};
type ActionFailure = { readonly error: string; readonly detail?: unknown };
type ActionValue<T> = T extends { readonly error: string } ? never : T;

export function buildSyncpress() {
  const application = assembleSyncpress();
  const gateway = createGateway<SyncpressWire>({ application });
  return { application, gateway };
}

const HELP = `Usage:
  bun run site build [site-directory] [output-directory]
  bun run site build --watch [site-directory] [output-directory]
  bun run site dev [--port PORT] [site-directory] [output-directory]
  bun run site inspect <page-or-route> [site-directory]

Build the configured site rooted at <site-directory>, defaulting to the current
directory. Without an explicit output directory, paths.output (or dist) is used.
`;

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function isActionFailure(value: unknown): value is ActionFailure {
  return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string";
}

function actionValue<T>(result: T, context: string): ActionValue<T> {
  if (isActionFailure(result)) {
    throw new Error(`${context}: ${typeof result.detail === "string" ? result.detail : result.error}`);
  }
  return result as ActionValue<T>;
}

function gatewayError(error: { kind: "domain"; value: unknown } | { kind: "framework"; code: string; detail?: string }): string {
  return error.kind === "domain" ? describe(error.value) : error.detail ?? error.code;
}

function gatewayValue<T>(result: InvocationResult<T, unknown>, context: string): T {
  if (!result.ok) throw new Error(`${context}: ${gatewayError(result.error)}`);
  return result.value;
}

function containsPath(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function pathsOverlap(left: string, right: string): boolean {
  return containsPath(left, right) || containsPath(right, left);
}

async function canonicalPath(path: string, name: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    const code = errorCode(error);
    if (code !== "ENOENT" && code !== "ENOTDIR") {
      throw new Error(`Could not resolve ${name} ${path}: ${errorMessage(error)}`);
    }
  }

  const parent = dirname(path);
  return parent === path ? path : join(await canonicalPath(parent, name), basename(path));
}

async function requireDirectory(directory: string, name: string): Promise<void> {
  let status: Awaited<ReturnType<typeof lstat>>;
  try {
    status = await lstat(directory);
  } catch (error) {
    if (errorCode(error) === "ENOENT") throw new Error(`Required ${name} directory is missing: ${directory}`);
    if (errorCode(error) === "ENOTDIR") throw new Error(`Required ${name} directory is not a directory: ${directory}`);
    throw new Error(`Could not inspect required ${name} directory ${directory}: ${errorMessage(error)}`);
  }

  if (status.isSymbolicLink()) throw new Error(`Required ${name} directory must not be a symbolic link: ${directory}`);
  if (!status.isDirectory()) throw new Error(`Required ${name} directory is not a directory: ${directory}`);
}

async function readRequiredFile(file: string, name: string): Promise<Uint8Array> {
  let status: Awaited<ReturnType<typeof lstat>>;
  try {
    status = await lstat(file);
  } catch (error) {
    if (errorCode(error) === "ENOENT") throw new Error(`Required ${name} is missing: ${file}`);
    throw new Error(`Could not inspect required ${name} ${file}: ${errorMessage(error)}`);
  }

  if (status.isSymbolicLink()) throw new Error(`Required ${name} must not be a symbolic link: ${file}`);
  if (!status.isFile()) throw new Error(`Required ${name} is not a regular file: ${file}`);

  try {
    return new Uint8Array(await readFile(file));
  } catch (error) {
    throw new Error(`Could not read required ${name} ${file}: ${errorMessage(error)}`);
  }
}

async function sourceFiles(directory: string, name: string): Promise<SourceFile[]> {
  await requireDirectory(directory, name);
  const files: SourceFile[] = [];

  async function visit(current: string, prefix: string): Promise<void> {
    let entries: { name: string }[];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      throw new Error(`Could not read ${name} directory ${current}: ${errorMessage(error)}`);
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    for (const entry of entries) {
      const source = join(current, entry.name);
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      let status: Awaited<ReturnType<typeof lstat>>;
      try {
        status = await lstat(source);
      } catch (error) {
        throw new Error(`Could not inspect ${name} entry ${source}: ${errorMessage(error)}`);
      }

      if (status.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in ${name}: ${source}`);
      if (status.isDirectory()) {
        await visit(source, path);
      } else if (status.isFile()) {
        files.push({ path, source });
      } else {
        throw new Error(`Non-regular entry is not allowed in ${name}: ${source}`);
      }
    }
  }

  await visit(directory, "");
  return files;
}

async function configuredPath(
  configuring: Configuring,
  root: string,
  path: readonly string[],
  otherwise: string,
  name: string,
): Promise<string> {
  const value = (await configuring._scalar({ node: root, path, otherwise }))[0]?.value;
  if (typeof value !== "string") throw new Error(`Configured ${name} must be a string.`);
  return value;
}

function sourceDirectory(siteDirectory: string, configured: string, name: string): string {
  if (
    configured === "" ||
    isAbsolute(configured) ||
    configured.includes("\\") ||
    configured.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Configured ${name} must be a project-relative portable directory path.`);
  }

  const directory = resolve(siteDirectory, configured);
  if (!containsPath(siteDirectory, directory)) {
    throw new Error(`Configured ${name} must stay inside the site directory.`);
  }
  return directory;
}

function outputPrefix(configured: string, name: string): void {
  if (
    configured === "" ||
    isAbsolute(configured) ||
    /^[a-z]:\//i.test(configured) ||
    configured.includes("\\") ||
    configured.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Configured ${name} must be a portable relative output prefix.`);
  }
}

const INCLUDES_PREFIX = `${ROOTS.includes}/`;

function logicalTemplateName(path: string): string {
  return path.startsWith(INCLUDES_PREFIX) ? path.slice(INCLUDES_PREFIX.length) : path;
}

function requireUniqueTemplateNames(files: readonly SourceFile[]): void {
  const names = new Map<string, string>();
  for (const file of files) {
    const name = logicalTemplateName(file.path);
    const existing = names.get(name);
    if (existing !== undefined) {
      throw new Error(`Duplicate logical Liquid template name "${name}": "${existing}" and "${file.path}".`);
    }
    names.set(name, file.path);
  }
}

async function placeFile(application: Application, root: string, path: string, source: string): Promise<void> {
  let content: Uint8Array;
  try {
    content = new Uint8Array(await readFile(source));
  } catch (error) {
    throw new Error(`Could not read source file ${source}: ${errorMessage(error)}`);
  }
  actionValue(
    await application.concepts.Filing.place({ root, path, content }),
    `Could not stage source file ${source}`,
  );
}

function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  if (diagnostics.length === 0) return "No diagnostics were reported.";
  return diagnostics
    .map(({ severity, code, message, source, line, column }) => {
      const location =
        source === undefined ? "" : ` ${source}${line === undefined ? "" : `:${line}${column === undefined ? "" : `:${column}`}`}`;
      return `${severity.toUpperCase()} ${code}${location}: ${message}`;
    })
    .join("\n");
}

async function runPhases(application: Application, sequence: string): Promise<string> {
  const started = actionValue(
    await application.concepts.Phasing.start({ sequence, mode: "once" }),
    "Could not start the site build",
  );
  await application.whenIdle();

  let phase: string | null = started.phase;
  while (phase !== null) {
    const advanced = actionValue(
      await application.concepts.Phasing.advance({ job: started.job }),
      "Could not advance the site build",
    );
    await application.whenIdle();
    phase = advanced.phase;
  }
  return started.job;
}

async function validateProjectPolicy(application: Application, configuration: Uint8Array): Promise<SitePolicy> {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(configuration);
  } catch {
    throw new Error(`${CONFIGURATION_PATH} must be valid UTF-8 text.`);
  }

  actionValue(
    await application.concepts.Configuring.load({ source, notation: "yaml" }),
    `Could not parse ${CONFIGURATION_PATH}`,
  );
  const parsed = parseSitePolicy(source);
  for (const diagnostic of parsed.problems) {
    actionValue(
      await application.concepts.Diagnosing.report({
        severity: "error",
        code: diagnostic.code,
        message: diagnostic.message,
        source: CONFIGURATION_PATH,
        line: diagnostic.line,
        column: diagnostic.column,
      }),
      `Could not record a ${CONFIGURATION_PATH} diagnostic`,
    );
  }
  if (parsed.problems.length > 0) {
    throw new Error(`Invalid ${CONFIGURATION_PATH}:\n\n${formatDiagnostics(await application.concepts.Diagnosing._all())}`);
  }
  return parsed.policy;
}

function isXmlCharacter(codePoint: number): boolean {
  return codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    codePoint >= 0x10000;
}

function xmlEscape(value: string): string {
  const xmlText = [...value].map((character) =>
    isXmlCharacter(character.codePointAt(0)!) ? character : "\uFFFD").join("");
  return xmlText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown, otherwise = ""): string {
  return typeof value === "string" ? value : otherwise;
}

function cardData(card: unknown): Record<string, unknown> {
  return recordValue(recordValue(card).data);
}

async function reportDiagnostic(
  application: Application,
  code: string,
  message: string,
  source = CONFIGURATION_PATH,
): Promise<string | undefined> {
  const reported = await application.concepts.Diagnosing.report({ severity: "error", code, message, source });
  if (isActionFailure(reported)) throw new Error(`Could not record ${code}: ${reported.detail ?? reported.error}`);
  return typeof reported.diagnostic === "string" ? reported.diagnostic : undefined;
}

async function reportOutputFailure(application: Application, path: string, detail: string, source = CONFIGURATION_PATH): Promise<void> {
  const diagnostic = await reportDiagnostic(application, "OUTPUT_COLLISION", `${path}: ${detail}`, source);
  if (diagnostic === undefined) return;
  for (const { producer } of await application.concepts.Emitting._producers({ path })) {
    const related = await application.concepts.Diagnosing.relate({
      diagnostic,
      source: producer,
      note: "Competing output producer.",
    });
    if (isActionFailure(related)) throw new Error(`Could not relate output collision: ${related.detail ?? related.error}`);
  }
}

async function stageArtifact(
  application: Application,
  producer: string,
  path: string,
  content: string,
  source = CONFIGURATION_PATH,
): Promise<boolean> {
  const begun = await application.concepts.Emitting.begin({ producer });
  if (isActionFailure(begun)) {
    await reportOutputFailure(application, path, begun.detail === undefined ? begun.error : String(begun.detail), source);
    return false;
  }
  const intended = await application.concepts.Emitting.intend({ producer, path, content, medium: "text/plain" });
  if (isActionFailure(intended)) {
    await reportOutputFailure(application, path, intended.detail === undefined ? intended.error : String(intended.detail), source);
    const aborted = await application.concepts.Emitting.abort({ producer });
    if (isActionFailure(aborted)) throw new Error(`Could not abort ${producer}: ${aborted.detail ?? aborted.error}`);
    return false;
  }
  const committed = await application.concepts.Emitting.commit({ producer });
  if (isActionFailure(committed)) {
    await reportOutputFailure(application, path, committed.detail === undefined ? committed.error : String(committed.detail), source);
    return false;
  }
  return true;
}

async function claimGeneratedRoute(application: Application, owner: string, address: string, source = CONFIGURATION_PATH): Promise<boolean> {
  const claimed = await application.concepts.Routing.claim({ owner, address });
  if (isActionFailure(claimed)) {
    await reportDiagnostic(application, claimed.error === "ADDRESS_TAKEN" ? "ROUTE_COLLISION" : claimed.error, claimed.detail === undefined ? claimed.error : String(claimed.detail), source);
    return false;
  }
  actionValue(await application.concepts.Depending.begin({ subject: owner }), `Could not start generated page ${address}`);
  actionValue(await application.concepts.Depending.use({ subject: owner, input: CONFIGURATION_PATH }), `Could not track generated page ${address}`);
  actionValue(await application.concepts.Depending.settle({ subject: owner }), `Could not settle generated page ${address}`);
  return true;
}

async function projectDeploymentTarget(application: Application, target: string): Promise<string | undefined> {
  if (!target.startsWith("/")) return target;
  return (await application.concepts.Routing._url({ target }))[0]?.url;
}

async function deploymentAbsoluteUrl(
  application: Application,
  site: Record<string, unknown>,
  path: string,
): Promise<string | undefined> {
  const origin = textValue(site.origin);
  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  const projected = (await application.concepts.Routing._url({ target: `/${encodedPath}` }))[0]?.url;
  if (origin === "" || projected === undefined) return undefined;
  try {
    const url = new URL(projected, origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function resolveVirtualLayout(application: Application, subject: string, text: string): Promise<string | undefined> {
  const scanned = await application.concepts.Referencing.scan({ subject, part: "deployment-layout", text });
  if (isActionFailure(scanned)) {
    await reportDiagnostic(application, scanned.error, scanned.detail === undefined ? scanned.error : String(scanned.detail));
    return undefined;
  }
  if (typeof scanned.source !== "string") {
    await reportDiagnostic(application, "REFERENCE_SCAN_FAILED", "A generated layout scan produced no source identity.");
    return undefined;
  }

  let complete = true;
  for (const reference of await application.concepts.Referencing._references({ source: scanned.source })) {
    const classification = (await application.concepts.Routing._classify({ target: reference.raw }))[0]?.kind;
    let value: string | undefined;
    if (classification === "absolute") value = (await application.concepts.Routing._url({ target: reference.raw }))[0]?.url;
    else if (classification === "external" || classification === "fragment") value = reference.raw;
    else {
      complete = false;
      await reportDiagnostic(application, "RELATIVE_LAYOUT_REFERENCE", "A generated layout reference must be site-absolute, external, or fragment-only.");
      continue;
    }
    if (value === undefined) {
      complete = false;
      await reportDiagnostic(application, "INVALID_LOCAL_REFERENCE", "A generated layout reference could not be projected.");
      continue;
    }
    const answered = await application.concepts.Referencing.answer({ reference: reference.reference, form: "address", value });
    if (isActionFailure(answered)) {
      complete = false;
      await reportDiagnostic(application, answered.error, answered.detail === undefined ? answered.error : String(answered.detail));
    }
  }
  if (!complete) return undefined;
  return (await application.concepts.Referencing._finished({ subject, part: "deployment-layout" }))[0]?.text;
}

function paginationBody(items: readonly { card: unknown }[]): string {
  const entries = items
    .map(({ card }) => {
      const values = recordValue(card);
      const data = cardData(card);
      const url = textValue(values.url, "#");
      const title = textValue(data.title, "Untitled page");
      const excerpt = textValue(values.excerpt);
      return `<li><a href="${htmlEscape(url)}">${htmlEscape(title)}</a>${excerpt === "" ? "" : `<div>${excerpt}</div>`}</li>`;
    })
    .join("");
  return `<ul class="syncpress-pagination-items">${entries}</ul>`;
}

async function renderPagination(application: Application, policy: PaginationPolicy, site: Record<string, unknown>, collections: Record<string, unknown>): Promise<void> {
  const named = (await application.concepts.Collecting._named({ name: policy.collection }))[0];
  if (named === undefined) {
    await reportDiagnostic(application, "PAGINATION_COLLECTION_NOT_FOUND", `Pagination ${policy.name} names no configured collection.`);
    return;
  }
  const template = (await application.concepts.Templating._template({ name: policy.template }))[0];
  if (template === undefined) {
    await reportDiagnostic(application, "TEMPLATE_NOT_FOUND", `Pagination ${policy.name} selects an undefined template.`);
    return;
  }
  const allItems = await application.concepts.Collecting._items({ collection: named.collection });
  const pages = Math.max(1, Math.ceil(allItems.length / policy.perPage));
  for (let number = 1; number <= pages; number += 1) {
    const owner = `deployment:pagination:${policy.name}:${number}`;
    const address = policy.route.replace(":page", String(number));
    if (!await claimGeneratedRoute(application, owner, address)) continue;
    const path = (await application.concepts.Routing._file({ address }))[0]?.path;
    if (path === undefined) {
      await reportDiagnostic(application, "INVALID_ADDRESS", `Pagination ${policy.name} has an invalid route.`);
      continue;
    }
    const start = (number - 1) * policy.perPage;
    const items = allItems.slice(start, start + policy.perPage);
    const previous = number === 1 ? undefined : policy.route.replace(":page", String(number - 1));
    const next = number === pages ? undefined : policy.route.replace(":page", String(number + 1));
    const canonicalUrl = (await application.concepts.Routing._absolute({ address }))[0]?.url;
    const context = {
      site,
      collections,
      page: {
        data: { section: "Collection page", title: policy.title ?? policy.name, description: "" },
        url: address,
        canonicalUrl: textValue(canonicalUrl),
        source: { path: `[generated]/${policy.name}/${number}` },
        content: paginationBody(items),
      },
      pagination: { collection: policy.collection, current: number, pages, items: items.map(({ card }) => card), previous, next },
    };
    const rendered = await application.concepts.Templating.render({
      template: template.template,
      subject: owner,
      context,
      trusted: [["page", "content"], TRUSTED_COLLECTION_EXCERPTS],
    });
    if (isActionFailure(rendered)) {
      await reportDiagnostic(
        application,
        rendered.error,
        `Pagination ${policy.name}: ${rendered.detail === undefined ? rendered.error : String(rendered.detail)}`,
      );
      continue;
    }
    if (typeof rendered.output !== "string") {
      await reportDiagnostic(application, "TEMPLATE_FAILED", `Pagination ${policy.name} produced no layout output.`);
      continue;
    }
    const output = await resolveVirtualLayout(application, owner, rendered.output);
    if (output !== undefined) await stageArtifact(application, owner, path, output);
  }
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1]!;
}

function atomTimestamp(value: string): string | undefined {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (date !== null) {
    const [, years, months, days] = date;
    if (!validCalendarDate(Number(years), Number(months), Number(days))) return undefined;
    return `${value}T00:00:00Z`;
  }

  const timestamp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (timestamp === null) return undefined;
  const [, years, months, days, hours, minutes, seconds, offset] = timestamp;
  if (
    !validCalendarDate(Number(years), Number(months), Number(days)) ||
    Number(hours) > 23 ||
    Number(minutes) > 59 ||
    Number(seconds) > 59 ||
    (offset !== "Z" && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4, 6)) > 59))
  ) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

async function emitFeed(application: Application, policy: NonNullable<SitePolicy["deploy"]["feed"]>, site: Record<string, unknown>): Promise<void> {
  const collection = (await application.concepts.Collecting._named({ name: policy.collection }))[0];
  if (collection === undefined) {
    await reportDiagnostic(application, "FEED_COLLECTION_NOT_FOUND", `Feed names no configured collection: ${policy.collection}.`);
    return;
  }
  const feedUrl = await deploymentAbsoluteUrl(application, site, policy.path);
  if (feedUrl === undefined) {
    await reportDiagnostic(application, "ORIGIN_REQUIRED", "Feed generation requires a valid site.origin.");
    return;
  }
  const entries: string[] = [];
  let updated = "1970-01-01T00:00:00Z";
  for (const { card } of await application.concepts.Collecting._items({ collection: collection.collection })) {
    const values = recordValue(card);
    const data = cardData(card);
    const address = textValue(values.url);
    const link = (await application.concepts.Routing._absolute({ address }))[0]?.url;
    const date = atomTimestamp(textValue(data.date));
    if (link === undefined || date === undefined) {
      await reportDiagnostic(application, "INVALID_FEED_ENTRY", "Feed entries need a routed URL and a valid data.date.");
      continue;
    }
    if (date > updated) updated = date;
    const title = textValue(data.title, "Untitled page");
    const summary = textValue(values.excerpt, textValue(data.description));
    entries.push(`<entry><id>${xmlEscape(link)}</id><title>${xmlEscape(title)}</title><link href="${xmlEscape(link)}"/><updated>${date}</updated>${summary === "" ? "" : `<summary type="html">${xmlEscape(summary)}</summary>`}</entry>`);
  }
  const title = policy.title ?? textValue(site.title, "Syncpress");
  const subtitle = policy.description ?? textValue(site.description);
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(feedUrl)}</id><title>${xmlEscape(title)}</title>${subtitle === "" ? "" : `<subtitle>${xmlEscape(subtitle)}</subtitle>`}<updated>${updated}</updated><link href="${xmlEscape(feedUrl)}"/>${entries.join("")}</feed>\n`;
  await stageArtifact(application, "deployment:feed", policy.path, content);
}

async function emitSitemap(application: Application): Promise<void> {
  if ((await application.concepts.Routing._absolute({ address: "/" }))[0]?.url === undefined) {
    await reportDiagnostic(application, "ORIGIN_REQUIRED", "Sitemap generation requires a valid site.origin.");
    return;
  }
  const urls: string[] = [];
  for (const { owner, address } of await application.concepts.Routing._claims()) {
    if (address === "/404.html" || owner.startsWith("deployment:redirect:")) continue;
    const url = (await application.concepts.Routing._absolute({ address }))[0]?.url;
    if (url !== undefined) urls.push(url);
  }
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`).join("")}</urlset>\n`;
  await stageArtifact(application, "deployment:sitemap", "sitemap.xml", content);
}

async function applyDeploymentPolicy(application: Application, policy: SitePolicy): Promise<void> {
  const active = (await application.concepts.Configuring._active())[0];
  if (active === undefined) throw new Error("Site configuration did not remain active.");
  const site = recordValue((await application.concepts.Configuring._values({ node: active.root, path: PATHS.site, otherwise: {} }))[0]?.values);
  const collections = recordValue((await application.concepts.Collecting._catalog()).collections);

  if (policy.deploy.nojekyll) await stageArtifact(application, "deployment:nojekyll", ".nojekyll", "");
  if (policy.deploy.requireNotFound && (await application.concepts.Routing._owner({ address: "/404.html" })).length === 0) {
    await reportDiagnostic(application, "MISSING_NOT_FOUND", "deploy.requireNotFound requires an authored /404.html page.");
  }

  for (const redirect of policy.deploy.redirects) {
    const owner = `deployment:redirect:${redirect.from}`;
    if (!await claimGeneratedRoute(application, owner, redirect.from)) continue;
    const path = (await application.concepts.Routing._file({ address: redirect.from }))[0]?.path;
    const target = await projectDeploymentTarget(application, redirect.to);
    if (path === undefined || target === undefined) {
      await reportDiagnostic(application, "INVALID_REDIRECT", `Redirect ${redirect.from} cannot be emitted.`);
      continue;
    }
    const canonical = redirect.to.startsWith("/")
      ? (await application.concepts.Routing._absolute({ address: redirect.to }))[0]?.url ?? target
      : target;
    const content = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${htmlEscape(target)}"><link rel="canonical" href="${htmlEscape(canonical)}"></head><body><p>Moved to <a href="${htmlEscape(target)}">${htmlEscape(target)}</a>.</p></body></html>\n`;
    await stageArtifact(application, owner, path, content);
  }

  for (const pagination of policy.deploy.pagination) await renderPagination(application, pagination, site, collections);
  if (policy.deploy.sitemap) await emitSitemap(application);
  if (policy.deploy.feed !== undefined) await emitFeed(application, policy.deploy.feed, site);
}

async function prepareSite(projectDirectory = ".", destination?: string) {
  const siteDirectory = resolve(projectDirectory);
  await requireDirectory(siteDirectory, "site");
  const canonicalSiteDirectory = await canonicalPath(siteDirectory, "site directory");

  const configurationFile = join(siteDirectory, CONFIGURATION_PATH);
  const configuration = await readRequiredFile(configurationFile, CONFIGURATION_PATH);
  const { application, gateway } = buildSyncpress();
  const policy = await validateProjectPolicy(application, configuration);
  const outputDirectory = destination === undefined
    ? sourceDirectory(siteDirectory, policy.outputPath, "paths.output")
    : resolve(siteDirectory, destination);

  const project = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.project }),
    "Could not open the project Filing root",
  );
  actionValue(
    await application.concepts.Filing.place({ root: project.root, path: CONFIGURATION_PATH, content: configuration }),
    `Could not stage ${CONFIGURATION_PATH}`,
  );

  const configured = gatewayValue<SyncpressWire["/site/configure"]["output"]>(
    await gateway.invoke("/site/configure", { destination: outputDirectory }),
    "Could not configure the site build",
  );
  const active = await application.concepts.Configuring._active();
  if (active.length !== 1) throw new Error("Site configuration did not produce one active configuration.");

  const configurationRoot = active[0]!.root;
  const contentPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsContent,
    DEFAULTS.contentPath,
    "paths.content",
  );
  const templatesPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsTemplates,
    DEFAULTS.templatesPath,
    "paths.templates",
  );
  const publicPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsPublic,
    DEFAULTS.publicPath,
    "paths.public",
  );
  const assetsPath = await configuredPath(
    application.concepts.Configuring,
    configurationRoot,
    PATHS.pathsAssets,
    DEFAULTS.assetsPath,
    "paths.assets",
  );
  outputPrefix(assetsPath, "paths.assets");

  const contentDirectory = sourceDirectory(
    siteDirectory,
    contentPath,
    "paths.content",
  );
  const templatesDirectory = sourceDirectory(
    siteDirectory,
    templatesPath,
    "paths.templates",
  );
  const publicDirectory = sourceDirectory(
    siteDirectory,
    publicPath,
    "paths.public",
  );

  const sourceRoots = [
    { name: ROOTS.content, directory: contentDirectory },
    { name: ROOTS.templates, directory: templatesDirectory },
    { name: ROOTS.public, directory: publicDirectory },
  ];
  for (const source of sourceRoots) await requireDirectory(source.directory, source.name);
  const canonicalSourceRoots = await Promise.all(
    sourceRoots.map(async (source) => ({
      ...source,
      canonicalDirectory: await canonicalPath(source.directory, `${source.name} directory`),
    })),
  );
  for (const source of canonicalSourceRoots) {
    if (!containsPath(canonicalSiteDirectory, source.canonicalDirectory)) {
      throw new Error(
        `Configured paths.${source.name} must stay inside the site directory after resolving symbolic links: ${source.directory}`,
      );
    }
  }
  const comparableOutputDirectory = await canonicalPath(outputDirectory, "output directory");
  if (destination === undefined && !containsPath(canonicalSiteDirectory, comparableOutputDirectory)) {
    throw new Error(
      `Configured paths.output must stay inside the site directory after resolving symbolic links: ${outputDirectory}`,
    );
  }
  for (const source of canonicalSourceRoots) {
    if (pathsOverlap(source.canonicalDirectory, comparableOutputDirectory)) {
      throw new Error(
        `Output directory overlaps configured ${source.name} directory: ${outputDirectory} and ${source.directory}`,
      );
    }
  }
  if (containsPath(comparableOutputDirectory, await canonicalPath(configurationFile, CONFIGURATION_PATH))) {
    throw new Error(`Output directory overlaps ${CONFIGURATION_PATH}: ${outputDirectory} and ${configurationFile}`);
  }

  const contentFiles = await sourceFiles(contentDirectory, ROOTS.content);
  const templateFiles = await sourceFiles(templatesDirectory, ROOTS.templates);
  const publicFiles = await sourceFiles(publicDirectory, ROOTS.public);
  requireUniqueTemplateNames(templateFiles);
  const inputFiles = 1 + contentFiles.length + templateFiles.length + publicFiles.length;

  const content = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.content }),
    "Could not open the content Filing root",
  );
  const templates = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.templates }),
    "Could not open the templates Filing root",
  );
  const includes = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.includes }),
    "Could not open the includes Filing root",
  );
  const publicFilesRoot = actionValue(
    await application.concepts.Filing.open({ name: ROOTS.public }),
    "Could not open the public Filing root",
  );

  for (const file of contentFiles) await placeFile(application, content.root, file.path, file.source);
  for (const file of templateFiles) {
    const isInclude = file.path.startsWith(INCLUDES_PREFIX);
    await placeFile(
      application,
      isInclude ? includes.root : templates.root,
      logicalTemplateName(file.path),
      file.source,
    );
  }
  for (const file of publicFiles) await placeFile(application, publicFilesRoot.root, file.path, file.source);

  const job = await runPhases(application, configured.sequence);
  await applyDeploymentPolicy(application, policy);
  await application.whenIdle();
  return { application, gateway, job, inputFiles, policy };
}

export async function buildSite(projectDirectory = ".", destination?: string) {
  const { application, gateway, job, inputFiles, policy } = await prepareSite(projectDirectory, destination);
  const reconciled = await gateway.invoke("/site/reconcile", { job });
  const diagnostics = await application.concepts.Diagnosing._all();
  if (!reconciled.ok) {
    throw new Error(
      `Could not reconcile the site build: ${gatewayError(reconciled.error)}\n\nDiagnostics:\n${formatDiagnostics(diagnostics)}`,
    );
  }

  const pages = (await application.concepts.Routing._claims()).length;
  return { pages, inputFiles, policy, ...reconciled.value, diagnostics };
}

function leafPaths(value: unknown, prefix: string[] = []): string[][] {
  if (Array.isArray(value)) return value.flatMap((item, index) => leafPaths(item, [...prefix, String(index)]));
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length === 0 ? [prefix] : entries.flatMap(([key, item]) => leafPaths(item, [...prefix, key]));
  }
  return [prefix];
}

/** Build an isolated application model and report the current provenance for one page or route. */
export async function inspectSite(projectDirectory: string, target: string) {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-inspect-"));
  try {
    const { application, policy } = await prepareSite(projectDirectory, join(temporary, "output"));
    const claims = await application.concepts.Routing._claims();
    let owner: string | undefined;
    if (target.startsWith("/")) owner = (await application.concepts.Routing._owner({ address: target }))[0]?.owner;
    else {
      const content = (await application.concepts.Filing._named({ name: ROOTS.content }))[0];
      if (content !== undefined) owner = (await application.concepts.Filing._at({ root: content.root, path: target }))[0]?.file;
    }
    if (owner === undefined) {
      const diagnostics = await application.concepts.Diagnosing._all();
      throw new Error(`No routed page or content source matches ${JSON.stringify(target)}.\n\nDiagnostics:\n${formatDiagnostics(diagnostics)}`);
    }

    const source = (await application.concepts.Filing._file({ file: owner }))[0];
    const address = (await application.concepts.Routing._address({ owner }))[0]?.address;
    const selected = source === undefined
      ? undefined
      : (await application.concepts.Layering._value({ subject: owner, path: PATHS.buildTemplate }))[0]?.value;
    const generatedPagination = source === undefined
      ? policy.deploy.pagination.find((pagination) => owner!.startsWith(`deployment:pagination:${pagination.name}:`))
      : undefined;
    const templateName = source === undefined
      ? generatedPagination?.template
      : typeof selected === "string" ? selected : DEFAULTS.template;
    const template = templateName === undefined
      ? undefined
      : (await application.concepts.Templating._template({ name: templateName }))[0];
    const resolved = source === undefined ? undefined : await application.concepts.Layering._resolved({ subject: owner });
    const layers = source === undefined ? [] : await application.concepts.Layering._layers({ subject: owner });
    const origins = source === undefined || resolved === undefined
      ? []
      : (await Promise.all(
          leafPaths(resolved.values).filter((path) => path.length > 0).map(async (path) => ({
            path,
            ...(await application.concepts.Layering._origin({ subject: owner!, path }))[0],
          })),
        )).filter((origin) => origin.layer !== undefined);
    const memberships = await Promise.all(
      (await application.concepts.Collecting._membership({ item: owner })).map(async (membership) => ({
        ...membership,
        ...(await application.concepts.Collecting._position({ collection: membership.collection, item: owner }))[0],
      })),
    );
    const diagnostics = await application.concepts.Diagnosing._all();
    const detailedDiagnostics = await Promise.all(
      diagnostics.map(async (diagnostic) => ({ ...diagnostic, related: await application.concepts.Diagnosing._related({ diagnostic: diagnostic.diagnostic }) })),
    );

    return {
      target,
      owner,
      route: address,
      source: source === undefined ? undefined : { path: source.path, digest: source.digest },
      template: template === undefined || templateName === undefined
        ? undefined
        : { name: templateName, digest: template.digest, tree: await application.concepts.Templating._tree({ owner: template.template }) },
      layers,
      origins,
      memberships,
      dependencies: {
        state: await application.concepts.Depending._state({ subject: owner }),
        reason: (await application.concepts.Depending._reason({ subject: owner }))[0]?.reason,
        inputs: await application.concepts.Depending._uses({ subject: owner }),
      },
      outputs: await application.concepts.Emitting._byProducer({ producer: owner }),
      claims,
      diagnostics: detailedDiagnostics,
    };
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

type BuildResult = Awaited<ReturnType<typeof buildSite>>;
type WatchedOutput = { directory: string; target: string };

export type SiteWatcher = { close(): Promise<void> };

async function watchedOutput(directory: string): Promise<WatchedOutput> {
  return { directory, target: await canonicalPath(directory, "output directory") };
}

function isOutputTransactionPath(output: WatchedOutput, candidate: string): boolean {
  const parent = dirname(output.target);
  if (!containsPath(parent, candidate)) return false;
  const [first] = relative(parent, candidate).split(sep);
  return first?.startsWith(`.${basename(output.target)}.emitting-`) ?? false;
}

async function configuredWatchOutputDirectory(siteDirectory: string, destination: string | undefined): Promise<string | undefined> {
  if (destination !== undefined) return resolve(siteDirectory, destination);
  try {
    const source = await readFile(join(siteDirectory, CONFIGURATION_PATH), "utf8");
    const { policy, problems } = parseSitePolicy(source);
    return problems.length === 0 ? resolve(siteDirectory, policy.outputPath) : undefined;
  } catch {
    return undefined;
  }
}

/** Rebuild a project after filesystem changes while retaining the last reconciled output on failures. */
export async function watchSite(
  projectDirectory = ".",
  destination?: string,
  options: { onBuild?: (result: BuildResult) => void; onError?: (error: unknown) => void } = {},
): Promise<SiteWatcher> {
  const siteDirectory = resolve(projectDirectory);
  let current = await buildSite(siteDirectory, destination);
  options.onBuild?.(current);
  let output = await watchedOutput(resolve(siteDirectory, destination ?? current.policy.outputPath));
  let rebuildingOutput: WatchedOutput | undefined;
  const controller = new AbortController();
  let closed = false;
  let rebuilding = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rebuild = async (): Promise<void> => {
    if (closed) return;
    if (rebuilding) {
      queued = true;
      return;
    }
    rebuilding = true;
    try {
      const configuredOutput = await configuredWatchOutputDirectory(siteDirectory, destination);
      if (configuredOutput !== undefined) output = await watchedOutput(configuredOutput);
      rebuildingOutput = output;
      current = await buildSite(siteDirectory, destination);
      output = await watchedOutput(resolve(siteDirectory, destination ?? current.policy.outputPath));
      options.onBuild?.(current);
    } catch (error) {
      options.onError?.(error);
    } finally {
      rebuildingOutput = undefined;
      rebuilding = false;
      if (queued) {
        queued = false;
        void rebuild();
      }
    }
  };
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void rebuild();
    }, 75);
  };
  const watcher = watch(siteDirectory, { recursive: true, signal: controller.signal });
  const task = (async (): Promise<void> => {
    try {
      for await (const event of watcher) {
        if (closed) break;
        const filename = event.filename === null ? undefined : resolve(siteDirectory, event.filename.toString());
        if (
          filename !== undefined &&
          (containsPath(output.target, filename) ||
            (rebuildingOutput !== undefined && isOutputTransactionPath(rebuildingOutput, filename)))
        ) {
          continue;
        }
        schedule();
      }
    } catch (error) {
      if (!closed && (error as { name?: string }).name !== "AbortError") options.onError?.(error);
    }
  })();

  return {
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
      await task;
    },
  };
}

function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".avif")) return "image/avif";
  if (path.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (path.endsWith(".xml")) return "application/xml; charset=utf-8";
  return "application/octet-stream";
}

function liveReloadMarkup(html: string): string {
  const script = '<script>new EventSource("/__syncpress/live-reload").onmessage=function(){location.reload()}</script>';
  const closing = html.toLowerCase().lastIndexOf("</body>");
  return closing === -1 ? `${html}${script}` : `${html.slice(0, closing)}${script}${html.slice(closing)}`;
}

async function respondFile(response: ServerResponse, root: string, pathname: string): Promise<void> {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (decoded.includes("\\") || decoded.split("/").some((segment) => segment === "..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  const requested = resolve(root, `.${decoded}`);
  if (!containsPath(root, requested)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  let file = requested;
  try {
    const status = await lstat(file);
    if (status.isSymbolicLink()) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    if (status.isDirectory()) file = join(file, "index.html");
  } catch {
    response.writeHead(404).end("Not found");
    return;
  }
  try {
    const status = await lstat(file);
    if (!status.isFile() || status.isSymbolicLink()) {
      response.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(file);
    if (file.endsWith(".html")) {
      response.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" }).end(liveReloadMarkup(body.toString("utf8")));
    } else {
      response.writeHead(200, { "content-type": contentType(file) }).end(body);
    }
  } catch {
    response.writeHead(404).end("Not found");
  }
}

export type DevelopmentServer = { host: string; port: number; close(): Promise<void> };

/** Serve only reconciled output and notify connected browsers after successful watch rebuilds. */
export async function serveSite(
  projectDirectory = ".",
  destination?: string,
  options: { host?: string; port?: number; onError?: (error: unknown) => void } = {},
): Promise<DevelopmentServer> {
  const clients = new Set<ServerResponse>();
  const siteDirectory = resolve(projectDirectory);
  let outputDirectory = "";
  let outputUpdate = Promise.resolve();
  const watcher = await watchSite(siteDirectory, destination, {
    onBuild(result) {
      const output = resolve(siteDirectory, destination ?? result.policy.outputPath);
      outputUpdate = canonicalPath(output, "output directory").then(
        (target) => {
          outputDirectory = target;
          for (const client of clients) client.write("data: reload\n\n");
        },
        (error) => options.onError?.(error),
      );
    },
    onError: options.onError,
  });
  await outputUpdate;
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 3000;
  const server = createServer((request, response) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${requestedPort}`}`);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (url.pathname === "/__syncpress/live-reload") {
      response.writeHead(200, {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      });
      response.write("retry: 1000\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }
    void respondFile(response, outputDirectory, url.pathname);
  });
  await new Promise<void>((resolveListening, rejectListening) => {
    server.once("error", rejectListening);
    server.listen(requestedPort, host, () => {
      server.off("error", rejectListening);
      resolveListening();
    });
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : requestedPort;
  return {
    host,
    port,
    async close(): Promise<void> {
      await watcher.close();
      for (const client of clients) client.end();
      clients.clear();
      await new Promise<void>((resolveClosed, rejectClosed) => server.close((error) => error === undefined ? resolveClosed() : rejectClosed(error)));
    },
  };
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h", "help"].includes(args[0]!))) {
    console.log(HELP);
    return;
  }

  const printBuild = (result: BuildResult): void => {
    console.log(
      `Built ${result.pages} ${result.pages === 1 ? "page" : "pages"} from ${result.inputFiles} ` +
        `${result.inputFiles === 1 ? "input file" : "input files"} ` +
        `(${result.written} written, ${result.replaced} replaced, ${result.kept} kept, ${result.removed} removed).`,
    );
  };
  const waitForInterrupt = async (close: () => Promise<void>): Promise<void> => {
    await new Promise<void>((resolveSignal) => {
      const stop = (): void => {
        process.off("SIGINT", stop);
        process.off("SIGTERM", stop);
        resolveSignal();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    await close();
  };

  if (args[0] === "inspect" && (args.length === 2 || args.length === 3)) {
    console.log(JSON.stringify(await inspectSite(args[2] ?? ".", args[1]!), null, 2));
    return;
  }

  if (args[0] === "dev") {
    const rest = args.slice(1);
    let port = 3000;
    if (rest[0] === "--port") {
      const requested = Number(rest[1]);
      if (!Number.isSafeInteger(requested) || requested < 1 || requested > 65_535) throw new Error(`Invalid usage.\n\n${HELP}`);
      port = requested;
      rest.splice(0, 2);
    }
    if (rest.length > 2) throw new Error(`Invalid usage.\n\n${HELP}`);
    const server = await serveSite(rest[0] ?? ".", rest[1], {
      port,
      onError(error) {
        console.error(error instanceof Error ? error.message : String(error));
      },
    });
    console.log(`Serving ${resolve(rest[0] ?? ".")} at http://${server.host}:${server.port}/`);
    await waitForInterrupt(() => server.close());
    return;
  }

  if (args[0] !== "build") throw new Error(`Invalid usage.\n\n${HELP}`);
  if (args[1] === "--watch") {
    if (args.length > 4) throw new Error(`Invalid usage.\n\n${HELP}`);
    const watcher = await watchSite(args[2] ?? ".", args[3], {
      onBuild: printBuild,
      onError(error) {
        console.error(error instanceof Error ? error.message : String(error));
      },
    });
    await waitForInterrupt(() => watcher.close());
    return;
  }
  if (args.length > 3) throw new Error(`Invalid usage.\n\n${HELP}`);

  const result = await buildSite(args[1] ?? ".", args[2]);
  printBuild(result);
}

if (import.meta.main) {
  try {
    await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
