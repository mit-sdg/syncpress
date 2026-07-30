import { isCanonicalAddress, isText, pathSegments } from "../../address.ts";

export type DeploymentPolicy = {
  nojekyll: boolean;
  requireNotFound: boolean;
  sitemap: boolean;
  feed?: { collection: string; path: string; title?: string; description?: string };
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

type CollectionEntry = { item: string; key?: unknown; card: unknown };
type WorkStatus = "pending" | "active" | "prepared" | "failed" | "completed";
type DeploymentOutcome = "absent" | "active" | "failed" | "completed";
type BaseWork = { work: string; deployment: string; status: WorkStatus; preparation?: unknown };
type NojekyllWork = BaseWork & { kind: "nojekyll"; producer: string; path: string };
type RedirectWork = BaseWork & {
  kind: "redirect";
  owner: string;
  producer: string;
  from: string;
  to: string;
};
type PaginationPlanWork = BaseWork & {
  kind: "pagination-plan";
  name: string;
  collection: string;
  perPage: number;
  route: string;
  templateName: string;
  title: string;
};
type PaginationPageWork = BaseWork & {
  kind: "pagination-page";
  owner: string;
  producer: string;
  name: string;
  collection: string;
  templateName: string;
  template: string;
  number: number;
  pages: number;
  address: string;
  previous?: string;
  next?: string;
  cards: unknown[];
  content: string;
  title: string;
  sourcePath: string;
};
type SitemapWork = BaseWork & { kind: "sitemap"; producer: string; path: string };
type FeedWork = BaseWork & {
  kind: "feed";
  producer: string;
  path: string;
  collection: string;
  title?: string;
  description?: string;
};
type Work = NojekyllWork | RedirectWork | PaginationPlanWork | PaginationPageWork | SitemapWork | FeedWork;
type Deployment = { deployment: string; works: Work[]; position: number };

export class WorkNotCurrent extends Error {
  constructor() {
    super("Deployment work must be the current item.");
    this.name = "WorkNotCurrent";
  }
}

export class DeploymentActive extends Error {
  constructor() {
    super("A deployment is already active.");
    this.name = "DeploymentActive";
  }
}

export class WorkNotPending extends Error {
  constructor() {
    super("Current deployment work has already been activated.");
    this.name = "WorkNotPending";
  }
}

export class WorkNotActive extends Error {
  constructor() {
    super("Deployment work must be active before this transition.");
    this.name = "WorkNotActive";
  }
}

export class WorkNotPrepared extends Error {
  constructor() {
    super("Deployment work must be prepared before completion.");
    this.name = "WorkNotPrepared";
  }
}

export class InvalidPolicy extends Error {
  constructor() {
    super("A deployment policy must have the supported publishing shape.");
    this.name = "InvalidPolicy";
  }
}

export class InvalidEntries extends Error {
  constructor() {
    super("Deployment entries must be a dense list of structured-cloneable identified cards.");
    this.name = "InvalidEntries";
  }
}

export class InvalidUrls extends Error {
  constructor() {
    super("Sitemap URLs must be a dense list of absolute HTTP URL records.");
    this.name = "InvalidUrls";
  }
}

export class InvalidContext extends Error {
  constructor() {
    super("Deployment context values must be structured-cloneable.");
    this.name = "InvalidContext";
  }
}

export class InvalidRedirect extends Error {
  constructor() {
    super("Redirect preparation requires a valid projection of its configured target.");
    this.name = "InvalidRedirect";
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, otherwise = ""): string {
  return typeof value === "string" ? value : otherwise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function optionalText(value: unknown): boolean {
  return value === undefined || isText(value);
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) return false;
  }
  return true;
}

function webUrl(value: unknown): value is string {
  if (!isText(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function redirectTarget(value: unknown): value is string {
  return isCanonicalAddress(value) || webUrl(value);
}

function paginationRoute(value: unknown): value is string {
  if (!isText(value)) return false;
  const parts = value.split(":page");
  return parts.length === 2 && isCanonicalAddress(`${parts[0]}1${parts[1]}`);
}

function redirectsAreAcyclic(redirects: ReadonlyArray<{ from: string; to: string }>): boolean {
  const bySource = new Map(redirects.map(({ from, to }) => [from, to]));
  for (const { from } of redirects) {
    const visited = new Set<string>();
    let current: string | undefined = from;
    while (current !== undefined) {
      if (visited.has(current)) return false;
      visited.add(current);
      current = bySource.get(current);
    }
  }
  return true;
}

function validRedirectProjection(configured: string, target: unknown, canonical: unknown): target is string {
  if (webUrl(configured)) return target === configured && canonical === configured;
  if (!isCanonicalAddress(target)) return false;
  if (target !== configured && !target.endsWith(configured)) return false;
  if (canonical === target) return true;
  if (!webUrl(canonical)) return false;
  const url = new URL(canonical);
  return url.pathname === target && url.search === "" && url.hash === "";
}

function isDeploymentPolicy(value: unknown): value is DeploymentPolicy {
  if (!isRecord(value)) return false;
  if (
    typeof value.nojekyll !== "boolean" ||
    typeof value.requireNotFound !== "boolean" ||
    typeof value.sitemap !== "boolean" ||
    !isDenseArray(value.redirects) ||
    !isDenseArray(value.pagination)
  ) return false;
  for (const redirect of value.redirects) {
    if (!isRecord(redirect) || !isCanonicalAddress(redirect.from) || !redirectTarget(redirect.to)) return false;
  }
  for (const pagination of value.pagination) {
    if (
      !isRecord(pagination) ||
      !isText(pagination.name) || pagination.name === "" ||
      !isText(pagination.collection) || pagination.collection === "" ||
      !Number.isSafeInteger(pagination.perPage) ||
      (pagination.perPage as number) <= 0 ||
      !paginationRoute(pagination.route) ||
      !isText(pagination.template) || pagination.template === "" ||
      !optionalText(pagination.title)
    ) return false;
  }
  const redirectSources = value.redirects.map((redirect) => (redirect as { from: string }).from);
  const paginationNames = value.pagination.map((pagination) => (pagination as { name: string }).name);
  if (new Set(redirectSources).size !== redirectSources.length) return false;
  if (new Set(paginationNames).size !== paginationNames.length) return false;
  if (!redirectsAreAcyclic(value.redirects as Array<{ from: string; to: string }>)) return false;
  return value.feed === undefined || (
    isRecord(value.feed) &&
    isText(value.feed.collection) && value.feed.collection !== "" &&
    isText(value.feed.path) && pathSegments(value.feed.path) !== undefined &&
    optionalText(value.feed.title) &&
    optionalText(value.feed.description)
  );
}

function deploymentEntries(value: unknown): CollectionEntry[] {
  if (
    !isDenseArray(value) ||
    value.some((entry) => !isRecord(entry) || typeof entry.item !== "string" || !("card" in entry))
  ) throw new InvalidEntries();
  try {
    return structuredClone(value) as CollectionEntry[];
  } catch {
    throw new InvalidEntries();
  }
}

function sitemapUrls(value: unknown): Array<{ url: string }> {
  if (!isDenseArray(value) || value.some((entry) => !isRecord(entry) || !webUrl(entry.url))) {
    throw new InvalidUrls();
  }
  return value as Array<{ url: string }>;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isXmlCharacter(codePoint: number): boolean {
  return codePoint === 0x9 || codePoint === 0xa || codePoint === 0xd ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
    codePoint >= 0x10000;
}

function xmlEscape(value: string): string {
  const normalized = [...value]
    .map((character) => isXmlCharacter(character.codePointAt(0)!) ? character : "\uFFFD")
    .join("");
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  ) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function basedUrl(site: Record<string, unknown>, address: string): string | undefined {
  const origin = text(site.origin);
  if (origin === "") return undefined;
  const base = text(site.basePath, "/");
  const projected = base === "/" ? address : `${base.replace(/\/$/, "")}${address}`;
  try {
    const url = new URL(projected, origin);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function outputUrl(site: Record<string, unknown>, path: string): string | undefined {
  const encoded = `/${path.split("/").map((segment) => encodeURIComponent(segment)).join("/")}`;
  return basedUrl(site, encoded);
}

function paginationBody(entries: readonly CollectionEntry[]): string {
  const items = entries.map(({ card }) => {
    const values = record(card);
    const data = record(values.data);
    const url = text(values.url, "#");
    const title = text(data.title, "Untitled page");
    const excerpt = text(values.excerpt);
    return `<li><a href="${htmlEscape(url)}">${htmlEscape(title)}</a>${excerpt === "" ? "" : `<div>${excerpt}</div>`}</li>`;
  }).join("");
  return `<ul class="syncpress-pagination-items">${items}</ul>`;
}

export class DeployingConcept {
  #next = 0;
  #latest: string | undefined;
  #deployments = new Map<string, Deployment>();
  #works = new Map<string, Work>();

  #current(deployment: string, work: string): { deployment: Deployment; work: Work } {
    const state = this.#deployments.get(deployment);
    const current = state?.works[state.position];
    if (state === undefined || current?.work !== work) throw new WorkNotCurrent();
    return { deployment: state, work: current };
  }

  #latestWorks(): Work[] {
    return this.#latest === undefined ? [] : this.#deployments.get(this.#latest)?.works ?? [];
  }

  #active(work: string, kind?: Work["kind"]): Work {
    const found = this.#works.get(work);
    if (found === undefined) throw new WorkNotCurrent();
    const { work: current } = this.#current(found.deployment, work);
    if (current.status !== "active" || (kind !== undefined && current.kind !== kind)) {
      throw new WorkNotActive();
    }
    return current;
  }

  #result(state: Deployment): { deployment: string; work?: string; completed: boolean } {
    const current = state.works[state.position];
    return {
      deployment: state.deployment,
      ...(current === undefined ? {} : { work: current.work }),
      completed: current === undefined,
    };
  }

  start({ policy }: { policy: DeploymentPolicy }): { deployment: string; work?: string; completed: boolean } {
    if (!isDeploymentPolicy(policy)) throw new InvalidPolicy();
    if (this.#latest !== undefined) {
      const latest = this.#deployments.get(this.#latest);
      if (latest?.works[latest.position] !== undefined) throw new DeploymentActive();
      this.#deployments.clear();
      this.#works.clear();
    }
    const deployment = `deployment:${++this.#next}`;
    const works: Work[] = [];
    const add = (work: Work): void => {
      works.push(work);
      this.#works.set(work.work, work);
    };
    if (policy.nojekyll) {
      add({ work: `${deployment}:nojekyll`, deployment, status: "pending", kind: "nojekyll", producer: "deployment:nojekyll", path: ".nojekyll" });
    }
    for (const redirect of policy.redirects) {
      const owner = `deployment:redirect:${redirect.from}`;
      add({ work: `${deployment}:redirect:${redirect.from}`, deployment, status: "pending", kind: "redirect", owner, producer: owner, ...redirect });
    }
    for (const pagination of policy.pagination) {
      add({
        work: `${deployment}:pagination:${pagination.name}`,
        deployment,
        status: "pending",
        kind: "pagination-plan",
        name: pagination.name,
        collection: pagination.collection,
        perPage: pagination.perPage,
        route: pagination.route,
        templateName: pagination.template,
        title: pagination.title ?? pagination.name,
      });
    }
    if (policy.sitemap) {
      add({ work: `${deployment}:sitemap`, deployment, status: "pending", kind: "sitemap", producer: "deployment:sitemap", path: "sitemap.xml" });
    }
    if (policy.feed !== undefined) {
      add({ work: `${deployment}:feed`, deployment, status: "pending", kind: "feed", producer: "deployment:feed", ...policy.feed });
    }
    const state = { deployment, works, position: 0 };
    this.#deployments.set(deployment, state);
    this.#latest = deployment;
    return this.#result(state);
  }

  dispatch({ deployment, work }: { deployment: string; work: string }): { deployment: string; work: string } {
    const current = this.#current(deployment, work).work;
    if (current.status !== "pending") throw new WorkNotPending();
    current.status = "active";
    return { deployment, work };
  }

  complete({ work }: { work: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#works.get(work);
    if (found === undefined) throw new WorkNotCurrent();
    const current = this.#current(found.deployment, work);
    if (current.work.status !== "active" && current.work.status !== "prepared") throw new WorkNotActive();
    if (current.work.kind !== "nojekyll" && current.work.status !== "prepared") throw new WorkNotPrepared();
    current.work.status = "completed";
    current.deployment.position += 1;
    return this.#result(current.deployment);
  }

  reject({ work }: { work: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#works.get(work);
    if (found === undefined) throw new WorkNotCurrent();
    const current = this.#current(found.deployment, work);
    if (current.work.status !== "active" && current.work.status !== "prepared") throw new WorkNotActive();
    current.work.status = "failed";
    current.deployment.position += 1;
    return this.#result(current.deployment);
  }

  rejectOwner({ owner }: { owner: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#latestWorks().find((work) => "owner" in work && work.owner === owner);
    if (found === undefined) throw new WorkNotCurrent();
    return this.reject({ work: found.work });
  }

  rejectProducer({ producer }: { producer: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#latestWorks().find((work) => "producer" in work && work.producer === producer);
    if (found === undefined) throw new WorkNotCurrent();
    return this.reject({ work: found.work });
  }

  divide({
    deployment,
    work,
    template,
    entries: rawEntries,
  }: {
    deployment: string;
    work: string;
    template: string;
    entries: unknown;
  }): { deployment: string; work: string; pages: number } {
    const entries = deploymentEntries(rawEntries);
    const plan = this.#active(work, "pagination-plan") as PaginationPlanWork;
    if (plan.deployment !== deployment) throw new WorkNotCurrent();
    const current = this.#current(deployment, work);
    const pages = Math.max(1, Math.ceil(entries.length / plan.perPage));
    const pageWorks: PaginationPageWork[] = [];
    for (let number = 1; number <= pages; number += 1) {
      const owner = `deployment:pagination:${plan.name}:${number}`;
      const slice = entries.slice((number - 1) * plan.perPage, number * plan.perPage);
      pageWorks.push({
        work: `${deployment}:pagination:${plan.name}:${number}`,
        deployment,
        status: "pending",
        kind: "pagination-page",
        owner,
        producer: owner,
        name: plan.name,
        collection: plan.collection,
        templateName: plan.templateName,
        template,
        number,
        pages,
        address: plan.route.replace(":page", String(number)),
        ...(number === 1 ? {} : { previous: plan.route.replace(":page", String(number - 1)) }),
        ...(number === pages ? {} : { next: plan.route.replace(":page", String(number + 1)) }),
        cards: slice.map(({ card }) => structuredClone(card)),
        content: paginationBody(slice),
        title: plan.title,
        sourcePath: `[generated]/${plan.name}/${number}`,
      });
    }
    current.deployment.works.splice(current.deployment.position, 1, ...pageWorks);
    this.#works.delete(plan.work);
    for (const page of pageWorks) this.#works.set(page.work, page);
    return { deployment, work: pageWorks[0]!.work, pages };
  }

  redirect({ work, target, canonical }: { work: string; target: string; canonical: string }): { content: string } {
    const current = this.#active(work, "redirect") as RedirectWork;
    if (!validRedirectProjection(current.to, target, canonical)) throw new InvalidRedirect();
    const safeTarget = htmlEscape(target);
    const result = {
      content: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${safeTarget}"><link rel="canonical" href="${htmlEscape(canonical)}"></head><body><p>Moved to <a href="${safeTarget}">${safeTarget}</a>.</p></body></html>\n`,
    };
    current.status = "prepared";
    current.preparation = structuredClone(result);
    return result;
  }

  context({ work, site, collections, canonicalUrl }: { work: string; site: unknown; collections: unknown; canonicalUrl?: string }): { owner: string; template: string; context: unknown } {
    const current = this.#active(work, "pagination-page") as PaginationPageWork;
    let result: { owner: string; template: string; context: unknown };
    try {
      result = structuredClone({
        owner: current.owner,
        template: current.template,
        context: {
          site,
          collections,
          page: {
            data: { section: "Collection page", title: current.title, description: "" },
            url: current.address,
            ...(canonicalUrl == null ? {} : { canonicalUrl }),
            source: { path: current.sourcePath },
            content: current.content,
          },
          pagination: {
            collection: current.collection,
            current: current.number,
            pages: current.pages,
            items: current.cards,
            previous: current.previous,
            next: current.next,
          },
        },
      });
    } catch {
      throw new InvalidContext();
    }
    current.preparation = structuredClone(result);
    current.status = "prepared";
    return result;
  }

  feed({ work, site, entries: rawEntries }: { work: string; site: unknown; entries: unknown }): { path: string; content: string; invalid: number; valid: boolean; origin: boolean } {
    const entries = deploymentEntries(rawEntries);
    const current = this.#active(work, "feed") as FeedWork;
    const siteRecord = record(site);
    const feedUrl = outputUrl(siteRecord, current.path);
    let invalid = 0;
    let updated = "1970-01-01T00:00:00Z";
    const rendered: string[] = [];
    for (const { card } of entries) {
      const values = record(card);
      const data = record(values.data);
      const link = basedUrl(siteRecord, text(values.url));
      const date = atomTimestamp(text(data.date));
      if (link === undefined || date === undefined) {
        invalid += 1;
        continue;
      }
      if (date > updated) updated = date;
      const title = text(data.title, "Untitled page");
      const summary = text(values.excerpt, text(data.description));
      rendered.push(`<entry><id>${xmlEscape(link)}</id><title>${xmlEscape(title)}</title><link href="${xmlEscape(link)}"/><updated>${date}</updated>${summary === "" ? "" : `<summary type="html">${xmlEscape(summary)}</summary>`}</entry>`);
    }
    const title = current.title ?? text(siteRecord.title, "Syncpress");
    const subtitle = current.description ?? text(siteRecord.description);
    const id = feedUrl ?? "";
    const result = {
      path: current.path,
      invalid,
      valid: invalid === 0,
      origin: feedUrl !== undefined,
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(id)}</id><title>${xmlEscape(title)}</title>${subtitle === "" ? "" : `<subtitle>${xmlEscape(subtitle)}</subtitle>`}<updated>${updated}</updated><link href="${xmlEscape(id)}"/>${rendered.join("")}</feed>\n`,
    };
    current.status = "prepared";
    current.preparation = structuredClone(result);
    return result;
  }

  sitemap({ work, urls: rawUrls }: { work: string; urls: unknown }): { path: string; content: string } {
    const urls = sitemapUrls(rawUrls);
    const current = this.#active(work, "sitemap") as SitemapWork;
    const result = {
      path: current.path,
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(({ url }) => `<url><loc>${xmlEscape(url)}</loc></url>`).join("")}</urlset>\n`,
    };
    current.status = "prepared";
    current.preparation = structuredClone(result);
    return result;
  }

  fail({ producer, path, detail }: { producer: string; path: string; detail: string }): { deployment: string; work?: string; completed: boolean; path: string; message: string } {
    const found = this.#latestWorks().find((work) => "producer" in work && work.producer === producer);
    if (found === undefined) throw new WorkNotCurrent();
    const current = this.#current(found.deployment, found.work);
    if (current.work.status !== "active" && current.work.status !== "prepared") throw new WorkNotActive();
    current.work.status = "failed";
    current.work.preparation = { path, detail };
    current.deployment.position += 1;
    return { ...this.#result(current.deployment), path, message: `${path}: ${detail}` };
  }

  _work({ work }: { work: string }): Work[] {
    const found = this.#works.get(work);
    return found === undefined ? [] : [structuredClone(found)];
  }

  _forOwner({ owner }: { owner: string }): Work[] {
    return this.#latestWorks().filter((work) => "owner" in work && work.owner === owner).map((work) => structuredClone(work));
  }

  _forProducer({ producer }: { producer: string }): Work[] {
    return this.#latestWorks().filter((work) => "producer" in work && work.producer === producer).map((work) => structuredClone(work));
  }

  _current(): Work[] {
    if (this.#latest === undefined) return [];
    const deployment = this.#deployments.get(this.#latest);
    const work = deployment?.works[deployment.position];
    return work === undefined ? [] : [structuredClone(work)];
  }

  _outcome(): { state: DeploymentOutcome } {
    if (this.#latest === undefined) return { state: "absent" };
    const deployment = this.#deployments.get(this.#latest)!;
    if (deployment.works[deployment.position] !== undefined) return { state: "active" };
    return { state: deployment.works.some(({ status }) => status === "failed") ? "failed" : "completed" };
  }
}
