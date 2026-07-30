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
type BaseWork = { work: string; deployment: string };
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

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, otherwise = ""): string {
  return typeof value === "string" ? value : otherwise;
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
  #deployments = new Map<string, Deployment>();
  #works = new Map<string, Work>();

  #current(deployment: string, work: string): { deployment: Deployment; work: Work } {
    const state = this.#deployments.get(deployment);
    const current = state?.works[state.position];
    if (state === undefined || current?.work !== work) throw new WorkNotCurrent();
    return { deployment: state, work: current };
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
    const deployment = `deployment:${++this.#next}`;
    const works: Work[] = [];
    const add = (work: Work): void => {
      works.push(work);
      this.#works.set(work.work, work);
    };
    if (policy.nojekyll) {
      add({ work: `${deployment}:nojekyll`, deployment, kind: "nojekyll", producer: "deployment:nojekyll", path: ".nojekyll" });
    }
    for (const redirect of policy.redirects) {
      const owner = `deployment:redirect:${redirect.from}`;
      add({ work: `${deployment}:redirect:${redirect.from}`, deployment, kind: "redirect", owner, producer: owner, ...redirect });
    }
    for (const pagination of policy.pagination) {
      add({
        work: `${deployment}:pagination:${pagination.name}`,
        deployment,
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
      add({ work: `${deployment}:sitemap`, deployment, kind: "sitemap", producer: "deployment:sitemap", path: "sitemap.xml" });
    }
    if (policy.feed !== undefined) {
      add({ work: `${deployment}:feed`, deployment, kind: "feed", producer: "deployment:feed", ...policy.feed });
    }
    const state = { deployment, works, position: 0 };
    this.#deployments.set(deployment, state);
    return this.#result(state);
  }

  dispatch({ deployment, work }: { deployment: string; work: string }): { deployment: string; work: string } {
    this.#current(deployment, work);
    return { deployment, work };
  }

  complete({ work }: { work: string }): { deployment: string; work?: string; completed: boolean } {
    const found = this.#works.get(work);
    if (found === undefined) throw new WorkNotCurrent();
    const current = this.#current(found.deployment, work);
    current.deployment.position += 1;
    return this.#result(current.deployment);
  }

  completeOwner({ owner }: { owner: string }): { deployment: string; work?: string; completed: boolean } {
    const found = [...this.#works.values()].find((work) => "owner" in work && work.owner === owner);
    if (found === undefined) throw new WorkNotCurrent();
    return this.complete({ work: found.work });
  }

  completeProducer({ producer }: { producer: string }): { deployment: string; work?: string; completed: boolean } {
    const found = [...this.#works.values()].find((work) => "producer" in work && work.producer === producer);
    if (found === undefined) throw new WorkNotCurrent();
    return this.complete({ work: found.work });
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
    const current = this.#current(deployment, work);
    if (current.work.kind !== "pagination-plan") throw new WorkNotCurrent();
    const plan = current.work;
    const entries = Array.isArray(rawEntries) ? rawEntries as CollectionEntry[] : [];
    const pages = Math.max(1, Math.ceil(entries.length / plan.perPage));
    const pageWorks: PaginationPageWork[] = [];
    for (let number = 1; number <= pages; number += 1) {
      const owner = `deployment:pagination:${plan.name}:${number}`;
      const slice = entries.slice((number - 1) * plan.perPage, number * plan.perPage);
      pageWorks.push({
        work: `${deployment}:pagination:${plan.name}:${number}`,
        deployment,
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
    const current = this.#works.get(work);
    if (current?.kind !== "redirect") throw new WorkNotCurrent();
    const safeTarget = htmlEscape(target);
    return {
      content: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${safeTarget}"><link rel="canonical" href="${htmlEscape(canonical)}"></head><body><p>Moved to <a href="${safeTarget}">${safeTarget}</a>.</p></body></html>\n`,
    };
  }

  context({ work, site, collections, canonicalUrl }: { work: string; site: unknown; collections: unknown; canonicalUrl?: string }): { owner: string; template: string; context: unknown } {
    const current = this.#works.get(work);
    if (current?.kind !== "pagination-page") throw new WorkNotCurrent();
    return {
      owner: current.owner,
      template: current.template,
      context: {
        site,
        collections,
        page: {
          data: { section: "Collection page", title: current.title, description: "" },
          url: current.address,
          canonicalUrl: canonicalUrl ?? "",
          source: { path: current.sourcePath },
          content: current.content,
        },
        pagination: {
          collection: current.collection,
          current: current.number,
          pages: current.pages,
          items: structuredClone(current.cards),
          previous: current.previous,
          next: current.next,
        },
      },
    };
  }

  feed({ work, site, entries: rawEntries }: { work: string; site: unknown; entries: unknown }): { path: string; content: string; invalid: number; valid: boolean; origin: boolean } {
    const current = this.#works.get(work);
    if (current?.kind !== "feed") throw new WorkNotCurrent();
    const siteRecord = record(site);
    const entries = Array.isArray(rawEntries) ? rawEntries as CollectionEntry[] : [];
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
    return {
      path: current.path,
      invalid,
      valid: invalid === 0,
      origin: feedUrl !== undefined,
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(id)}</id><title>${xmlEscape(title)}</title>${subtitle === "" ? "" : `<subtitle>${xmlEscape(subtitle)}</subtitle>`}<updated>${updated}</updated><link href="${xmlEscape(id)}"/>${rendered.join("")}</feed>\n`,
    };
  }

  sitemap({ work, urls: rawUrls }: { work: string; urls: unknown }): { path: string; content: string } {
    const current = this.#works.get(work);
    if (current?.kind !== "sitemap") throw new WorkNotCurrent();
    const urls = Array.isArray(rawUrls) ? rawUrls as Array<{ url: string }> : [];
    return {
      path: current.path,
      content: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(({ url }) => `<url><loc>${xmlEscape(url)}</loc></url>`).join("")}</urlset>\n`,
    };
  }

  outputFailure({ path, detail }: { path: string; detail: string }): { path: string; message: string } {
    return { path, message: `${path}: ${detail}` };
  }

  _work({ work }: { work: string }): Work[] {
    const found = this.#works.get(work);
    return found === undefined ? [] : [structuredClone(found)];
  }

  _forOwner({ owner }: { owner: string }): Work[] {
    return [...this.#works.values()].filter((work) => "owner" in work && work.owner === owner).map((work) => structuredClone(work));
  }

  _forProducer({ producer }: { producer: string }): Work[] {
    return [...this.#works.values()].filter((work) => "producer" in work && work.producer === producer).map((work) => structuredClone(work));
  }

  _current(): Work[] {
    return [...this.#deployments.values()]
      .map((deployment) => deployment.works[deployment.position])
      .filter((work): work is Work => work !== undefined)
      .map((work) => structuredClone(work));
  }
}
