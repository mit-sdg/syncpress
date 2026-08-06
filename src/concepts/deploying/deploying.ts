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
type BaseWork = { work: string; deployment: string; status: WorkStatus };
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
  previous: string | null;
  next: string | null;
  cards: unknown[];
  title: string;
  sourcePath: string;
};
type SitemapWork = BaseWork & { kind: "sitemap"; producer: string; path: string };
type FeedWork = BaseWork & {
  kind: "feed";
  producer: string;
  path: string;
  collection: string;
  title: string | null;
  description: string | null;
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
    super("A deployment was already started.");
    this.name = "DeploymentActive";
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

export class InvalidPreparation extends Error {
  constructor() {
    super("Deployment preparation must match the current work snapshot.");
    this.name = "InvalidPreparation";
  }
}

const addressEncoder = new TextEncoder();
const literalAddressCharacter = /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/;
const forbiddenSegmentCharacter = /[\\/\u0000-\u001f\u007f]/u;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isPathSegment(value: unknown): value is string {
  return isText(value) && value !== "" && value !== "." && value !== ".." &&
    value.normalize("NFC") === value && !forbiddenSegmentCharacter.test(value);
}

function encodeAddressSegment(segment: string): string {
  let encoded = "";
  for (const character of segment) {
    if (literalAddressCharacter.test(character)) encoded += character;
    else for (const byte of addressEncoder.encode(character)) encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return encoded;
}

function isCanonicalAddress(value: unknown): value is string {
  if (!isText(value) || !value.startsWith("/") || value.startsWith("//")) return false;
  if (value === "/") return true;
  const directory = value.endsWith("/");
  const body = value.slice(1, directory ? -1 : value.length);
  if (body === "") return false;
  const segments: string[] = [];
  for (const encoded of body.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(encoded);
    } catch {
      return false;
    }
    if (!isPathSegment(decoded) || encodeAddressSegment(decoded) !== encoded) return false;
    segments.push(decoded);
  }
  return directory || segments.at(-1) !== "index.html";
}

function isCanonicalPath(value: unknown): value is string {
  return isText(value) && value !== "" && !value.startsWith("/") && value.split("/").every(isPathSegment);
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
    isCanonicalPath(value.feed.path) &&
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

function paginationEntries(value: unknown): CollectionEntry[] {
  const entries = deploymentEntries(value);
  if (entries.some(({ card }) => !isRecord(card) || !isText(card.url) || card.url === "")) throw new InvalidEntries();
  return entries;
}

function sitemapUrls(value: unknown): Array<{ url: string }> {
  if (!isDenseArray(value) || value.some((entry) => !isRecord(entry) || !webUrl(entry.url))) {
    throw new InvalidUrls();
  }
  return value as Array<{ url: string }>;
}

function deploymentIdentity(order: number): string {
  return `deployment:${order}`;
}

function workIdentity(deployment: string, kind: string, ...parts: Array<string | number>): string {
  return `deployment-work:${JSON.stringify([deployment, kind, ...parts])}`;
}

function ownerIdentity(kind: string, ...parts: Array<string | number>): string {
  return `deployment-owner:${JSON.stringify([kind, ...parts])}`;
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
    if (current?.status === "pending") current.status = "active";
    return {
      deployment: state.deployment,
      ...(current === undefined ? {} : { work: current.work }),
      completed: current === undefined,
    };
  }

  start({ policy }: { policy: DeploymentPolicy }): { deployment: string; work?: string; completed: boolean } {
    if (!isDeploymentPolicy(policy)) throw new InvalidPolicy();
    if (this.#latest !== undefined) throw new DeploymentActive();
    const deployment = deploymentIdentity(++this.#next);
    const works: Work[] = [];
    const add = (work: Work): void => {
      works.push(work);
      this.#works.set(work.work, work);
    };
    if (policy.nojekyll) {
      add({ work: workIdentity(deployment, "nojekyll"), deployment, status: "pending", kind: "nojekyll", producer: "deployment:nojekyll", path: ".nojekyll" });
    }
    for (const redirect of policy.redirects) {
      const owner = ownerIdentity("redirect", redirect.from);
      add({ work: workIdentity(deployment, "redirect", redirect.from), deployment, status: "pending", kind: "redirect", owner, producer: owner, ...redirect });
    }
    for (const pagination of policy.pagination) {
      add({
        work: workIdentity(deployment, "pagination-plan", pagination.name),
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
      add({ work: workIdentity(deployment, "sitemap"), deployment, status: "pending", kind: "sitemap", producer: "deployment:sitemap", path: "sitemap.xml" });
    }
    if (policy.feed !== undefined) {
      add({
        work: workIdentity(deployment, "feed"),
        deployment,
        status: "pending",
        kind: "feed",
        producer: "deployment:feed",
        collection: policy.feed.collection,
        path: policy.feed.path,
        title: policy.feed.title ?? null,
        description: policy.feed.description ?? null,
      });
    }
    const state = { deployment, works, position: 0 };
    this.#deployments.set(deployment, state);
    this.#latest = deployment;
    return this.#result(state);
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

  rejectOwnerWork({ owner }: { owner: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#latestWorks().find((work) => "owner" in work && work.owner === owner);
    if (found === undefined) throw new WorkNotCurrent();
    return this.reject({ work: found.work });
  }

  rejectProducerWork({ producer }: { producer: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#latestWorks().find((work) => "producer" in work && work.producer === producer);
    if (found === undefined) throw new WorkNotCurrent();
    return this.reject({ work: found.work });
  }

  expandPagination({
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
    const entries = paginationEntries(rawEntries);
    const plan = this.#active(work, "pagination-plan") as PaginationPlanWork;
    if (plan.deployment !== deployment) throw new WorkNotCurrent();
    const current = this.#current(deployment, work);
    const pages = Math.max(1, Math.ceil(entries.length / plan.perPage));
    const pageWorks: PaginationPageWork[] = [];
    for (let number = 1; number <= pages; number += 1) {
      const owner = ownerIdentity("pagination-page", plan.name, number);
      const slice = entries.slice((number - 1) * plan.perPage, number * plan.perPage);
      pageWorks.push({
        work: workIdentity(deployment, "pagination-page", plan.name, number),
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
        previous: number === 1 ? null : plan.route.replace(":page", String(number - 1)),
        next: number === pages ? null : plan.route.replace(":page", String(number + 1)),
        cards: slice.map(({ card }) => structuredClone(card)),
        title: plan.title,
        sourcePath: `[generated]/${plan.name}/${number}`,
      });
    }
    current.deployment.works.splice(current.deployment.position, 1, ...pageWorks);
    this.#works.delete(plan.work);
    for (const page of pageWorks) this.#works.set(page.work, page);
    pageWorks[0]!.status = "active";
    return { deployment, work: pageWorks[0]!.work, pages };
  }

  prepareRedirect({ work, target, canonical, content }: { work: string; target: string; canonical: string; content: string }): { content: string } {
    const current = this.#active(work, "redirect") as RedirectWork;
    if (!validRedirectProjection(current.to, target, canonical)) throw new InvalidRedirect();
    if (!isText(content)) throw new InvalidPreparation();
    current.status = "prepared";
    return { content };
  }

  preparePageContext({ work, context }: { work: string; context: unknown }): { owner: string; template: string; context: unknown } {
    const current = this.#active(work, "pagination-page") as PaginationPageWork;
    let result: { owner: string; template: string; context: unknown };
    try {
      result = structuredClone({
        owner: current.owner,
        template: current.template,
        context,
      });
    } catch {
      throw new InvalidContext();
    }
    current.status = "prepared";
    return result;
  }

  snapshotFeed({ work, site, entries: rawEntries }: { work: string; site: unknown; entries: unknown }): {
    work: string;
    path: string;
    title: string | null;
    description: string | null;
    site: unknown;
    entries: CollectionEntry[];
  } {
    const current = this.#active(work, "feed") as FeedWork;
    const entries = deploymentEntries(rawEntries);
    try {
      return {
        work,
        path: current.path,
        title: current.title,
        description: current.description,
        site: structuredClone(site),
        entries: structuredClone(entries),
      };
    } catch {
      throw new InvalidPreparation();
    }
  }

  prepareFeed({ work, preparation }: { work: string; preparation: unknown }): { path: string; content: string; invalid: number; valid: boolean; origin: boolean } {
    const current = this.#active(work, "feed") as FeedWork;
    if (
      !isRecord(preparation) || preparation.path !== current.path || !isText(preparation.content) ||
      !Number.isSafeInteger(preparation.invalid) || (preparation.invalid as number) < 0 ||
      typeof preparation.valid !== "boolean" || preparation.valid !== (preparation.invalid === 0) ||
      typeof preparation.origin !== "boolean"
    ) throw new InvalidPreparation();
    const result = {
      path: current.path,
      content: preparation.content,
      invalid: preparation.invalid as number,
      valid: preparation.valid,
      origin: preparation.origin,
    };
    if (result.valid && result.origin) current.status = "prepared";
    return result;
  }

  snapshotSitemap({ work, urls: rawUrls }: { work: string; urls: unknown }): { work: string; path: string; urls: Array<{ url: string }> } {
    const urls = sitemapUrls(rawUrls);
    const current = this.#active(work, "sitemap") as SitemapWork;
    return { work, path: current.path, urls: structuredClone(urls) };
  }

  prepareSitemap({ work, content }: { work: string; content: string }): { path: string; content: string } {
    const current = this.#active(work, "sitemap") as SitemapWork;
    if (!isText(content)) throw new InvalidPreparation();
    const result = { path: current.path, content };
    current.status = "prepared";
    return result;
  }

  failWork({ producer, path, code, detail }: { producer: string; path: string; code: string; detail: string }): { deployment: string; work?: string; completed: boolean; path: string; code: string; message: string } {
    const found = this.#latestWorks().find((work) => "producer" in work && work.producer === producer);
    if (found === undefined) throw new WorkNotCurrent();
    const current = this.#current(found.deployment, found.work);
    if (current.work.status !== "active" && current.work.status !== "prepared") throw new WorkNotActive();
    current.work.status = "failed";
    current.deployment.position += 1;
    return { ...this.#result(current.deployment), path, code, message: `${path}: ${detail}` };
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
