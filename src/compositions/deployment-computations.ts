type CollectionEntry = { item: string; key?: unknown; card: unknown };

export type DeploymentFeedPreparation = {
  path: string;
  content: string;
  invalid: number;
  valid: boolean;
  origin: boolean;
};

export type DeploymentPaginationContextInput = {
  site: unknown;
  collections: unknown;
  address: unknown;
  canonicalUrl: unknown;
  sourcePath: unknown;
  title: unknown;
  collection: unknown;
  number: unknown;
  pages: unknown;
  cards: unknown;
  previous: unknown;
  next: unknown;
};

export type DeploymentFeedInput = {
  path: unknown;
  title: unknown;
  description: unknown;
  site: unknown;
  entries: unknown;
};

const queueTransitions = new Set(["start", "complete", "reject", "rejectOwnerWork", "rejectProducerWork", "failWork", "expandPagination"]);

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, otherwise = ""): string {
  return isText(value) ? value : otherwise;
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

function encodePath(path: string): string {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function outputUrl(site: Record<string, unknown>, path: string): string | undefined {
  return basedUrl(site, `/${encodePath(path)}`);
}

function collectionCards(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function paginationBody(cards: readonly unknown[]): string {
  const items = cards.map((card) => {
    const values = record(card);
    const data = record(values.data);
    const url = text(values.url);
    const title = text(data.title, "Untitled page");
    const excerpt = text(values.excerpt);
    return `<li><a href="${htmlEscape(url)}">${htmlEscape(title)}</a>${excerpt === "" ? "" : `<div>${excerpt}</div>`}</li>`;
  }).join("");
  return `<ul class="syncpress-pagination-items">${items}</ul>`;
}

export function deploymentTransitionWork(action: unknown, result: unknown): string | null {
  if (!isText(action) || !queueTransitions.has(action)) return null;
  const returned = record(result);
  return isText(returned.deployment) && isText(returned.work) ? returned.work : null;
}

export function deploymentRedirectDocument(targetValue: unknown, canonicalValue: unknown): string {
  const target = text(targetValue);
  const canonical = text(canonicalValue);
  const safeTarget = htmlEscape(target);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${safeTarget}"><link rel="canonical" href="${htmlEscape(canonical)}"></head><body><p>Moved to <a href="${safeTarget}">${safeTarget}</a>.</p></body></html>\n`;
}

export function deploymentPaginationContext(input: DeploymentPaginationContextInput): unknown {
  const cards = collectionCards(input.cards);
  const canonicalUrl = isText(input.canonicalUrl) ? input.canonicalUrl : undefined;
  return {
    site: input.site,
    collections: input.collections,
    page: {
      data: { section: "Collection page", title: text(input.title), description: "" },
      url: text(input.address),
      ...(canonicalUrl === undefined ? {} : { canonicalUrl }),
      source: { path: text(input.sourcePath) },
      content: paginationBody(cards),
    },
    pagination: {
      collection: text(input.collection),
      current: Number.isSafeInteger(input.number) ? input.number : 1,
      pages: Number.isSafeInteger(input.pages) ? input.pages : 1,
      items: cards,
      previous: isText(input.previous) ? input.previous : undefined,
      next: isText(input.next) ? input.next : undefined,
    },
  };
}

export function deploymentSitemapDocument(urlsValue: unknown): string {
  const urls = Array.isArray(urlsValue) ? urlsValue : [];
  const body = urls.map((entry) => text(record(entry).url)).filter((url) => url !== "")
    .map((url) => `<url><loc>${xmlEscape(url)}</loc></url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>\n`;
}

export function deploymentFeedPreparation(input: DeploymentFeedInput): DeploymentFeedPreparation {
  const path = text(input.path);
  const site = record(input.site);
  const feedUrl = outputUrl(site, path);
  let invalid = 0;
  let updated = "1970-01-01T00:00:00Z";
  const rendered: string[] = [];
  const entries: unknown[] = Array.isArray(input.entries) ? input.entries : [];
  if (!Array.isArray(input.entries)) invalid += 1;
  for (let index = 0; index < entries.length; index += 1) {
    if (!(index in entries)) {
      invalid += 1;
      continue;
    }
    const entry = record(entries[index]);
    if (!isText(entry.item) || !("card" in entry)) {
      invalid += 1;
      continue;
    }
    const values = record((entry as CollectionEntry).card);
    const data = record(values.data);
    const link = basedUrl(site, text(values.url));
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
  const title = isText(input.title) ? input.title : text(site.title, "Syncpress");
  const subtitle = isText(input.description) ? input.description : text(site.description);
  const id = feedUrl ?? "";
  return {
    path,
    invalid,
    valid: invalid === 0,
    origin: feedUrl !== undefined,
    content: `<?xml version="1.0" encoding="UTF-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(id)}</id><title>${xmlEscape(title)}</title>${subtitle === "" ? "" : `<subtitle>${xmlEscape(subtitle)}</subtitle>`}<updated>${updated}</updated><link href="${xmlEscape(id)}"/>${rendered.join("")}</feed>\n`,
  };
}

/** Pure deployment projections registered with the Syncpress concept set. */
export const deploymentComputations = {
  deploymentTransitionWork: ({ action, result }: { action: unknown; result: unknown }) =>
    deploymentTransitionWork(action, result),
  deploymentRedirectDocument: ({ target, canonical }: { target: unknown; canonical: unknown }) =>
    deploymentRedirectDocument(target, canonical),
  deploymentPaginationContext: (input: DeploymentPaginationContextInput) => deploymentPaginationContext(input),
  deploymentSitemapDocument: ({ urls }: { urls: unknown }) => deploymentSitemapDocument(urls),
  deploymentFeedPreparation: (input: DeploymentFeedInput) => deploymentFeedPreparation(input),
};
