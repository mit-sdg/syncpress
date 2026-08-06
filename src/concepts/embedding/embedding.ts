import { isProxy } from "node:util/types";

const INVALID_TEXT_MESSAGE = "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character.";
const INVALID_DIMENSION_MESSAGE = "Intrinsic width and height must be positive safe integers.";
const INVALID_COUNT_MESSAGE = "Expected offer count must be a nonnegative safe integer.";
const INVALID_ADDRESS_MESSAGE = "Image addresses must be safe site-absolute srcset addresses.";
const INVALID_FORMAT_MESSAGE = "Image format must be one of the canonical supported formats.";
const INVALID_ATTRIBUTES_MESSAGE = "Image attributes must be a plain record of text attributes.";
const EMBEDDING_NOT_FOUND_MESSAGE = "There is no such embedding.";
const INVALID_WIDTH_MESSAGE = "Offer width must be a positive safe integer no greater than the intrinsic width.";
const INVALID_ORDER_MESSAGE = "Offer order must be a nonnegative safe integer.";
const EMBEDDING_COMPLETE_MESSAGE = "A completed embedding cannot accept a changed or additional offer.";
const OFFER_CONFLICT_MESSAGE = "An address or format-width candidate is already used by this embedding.";

export class InvalidText extends Error {
  constructor() {
    super(INVALID_TEXT_MESSAGE);
  }
}
export class InvalidDimension extends Error {
  constructor() {
    super(INVALID_DIMENSION_MESSAGE);
  }
}
export class InvalidCount extends Error {
  constructor() {
    super(INVALID_COUNT_MESSAGE);
  }
}
export class InvalidAddress extends Error {
  constructor() {
    super(INVALID_ADDRESS_MESSAGE);
  }
}
export class InvalidFormat extends Error {
  constructor() {
    super(INVALID_FORMAT_MESSAGE);
  }
}
export class InvalidAttributes extends Error {
  constructor() {
    super(INVALID_ATTRIBUTES_MESSAGE);
  }
}
export class EmbeddingNotFound extends Error {
  constructor() {
    super(EMBEDDING_NOT_FOUND_MESSAGE);
  }
}
export class InvalidWidth extends Error {
  constructor() {
    super(INVALID_WIDTH_MESSAGE);
  }
}
export class InvalidOrder extends Error {
  constructor() {
    super(INVALID_ORDER_MESSAGE);
  }
}
export class EmbeddingComplete extends Error {
  constructor() {
    super(EMBEDDING_COMPLETE_MESSAGE);
  }
}
export class OfferConflict extends Error {
  constructor() {
    super(OFFER_CONFLICT_MESSAGE);
  }
}

export const MEDIA_TYPE_BY_FORMAT = Object.freeze({
  avif: "image/avif",
  gif: "image/gif",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jxl: "image/jxl",
  png: "image/png",
  tiff: "image/tiff",
  webp: "image/webp",
} as const);

export type ImageFormat = keyof typeof MEDIA_TYPE_BY_FORMAT;

type Attribute = { name: string; value: string };
type Offer = { offer: string; embedding: string; address: string; format: ImageFormat; width: number; order: number };
type Embedding = {
  embedding: string;
  subject: string;
  alternative: string;
  width: number;
  height: number;
  expects: number;
  original: string;
  originalFormat: ImageFormat;
  attributes: readonly Attribute[];
  offers: Map<string, Offer>;
};
type OfferGroup = { format: ImageFormat; order: number; offers: Offer[] };
type Candidate = { address: string; width: number; order: number };
type DeclareInput = {
  subject: unknown;
  alternative: unknown;
  width: unknown;
  height: unknown;
  expects: unknown;
  original: unknown;
  originalFormat: unknown;
  attributes: unknown;
};
type OfferInput = { embedding: unknown; address: unknown; format: unknown; width: unknown; order: unknown };

const encoder = new TextEncoder();
const exactAttributes = new Set(["class", "crossorigin", "dir", "fetchpriority", "id", "lang", "referrerpolicy", "role", "sizes", "title"]);
const referrerPolicies = new Set(["", "no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin", "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"]);

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isSerializableText(value: unknown): value is string {
  return isText(value) && !value.includes("\u0000");
}

function requireText(value: unknown): asserts value is string {
  if (!isText(value)) throw new InvalidText();
}

function requireSerializableText(value: unknown): asserts value is string {
  if (!isSerializableText(value)) throw new InvalidText();
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function normalizedInteger(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function requireAddress(value: unknown): asserts value is string {
  if (
    !isText(value) ||
    value[0] !== "/" ||
    value[1] === "/" ||
    /[\u0000-\u0020\u007f-\u009f,"'<>`\\]/u.test(value) ||
    /%(?![\da-f]{2})/iu.test(value)
  ) {
    throw new InvalidAddress();
  }
}

function requireFormat(value: unknown): asserts value is ImageFormat {
  if (!isText(value) || !Object.hasOwn(MEDIA_TYPE_BY_FORMAT, value)) throw new InvalidFormat();
}

function compareText(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    const comparison = leftBytes[index]! - rightBytes[index]!;
    if (comparison !== 0) return comparison;
  }
  return leftBytes.length - rightBytes.length;
}

function approvedAttribute(name: string, value: string): boolean {
  if (!exactAttributes.has(name) && !/^(?:aria|data)-[a-z][a-z0-9_.:-]*$/u.test(name)) return false;
  if (name === "crossorigin") return value === "" || value === "anonymous" || value === "use-credentials";
  if (name === "dir") return value === "auto" || value === "ltr" || value === "rtl";
  if (name === "fetchpriority") return value === "auto" || value === "high" || value === "low";
  if (name === "referrerpolicy") return referrerPolicies.has(value);
  return true;
}

function normalizeAttributes(value: unknown): readonly Attribute[] {
  try {
    if (value === null || typeof value !== "object" || isProxy(value)) throw new InvalidAttributes();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new InvalidAttributes();
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) throw new InvalidAttributes();

    const attributes: Attribute[] = [];
    for (const name of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new InvalidAttributes();
      if (!isSerializableText(name) || !isSerializableText(descriptor.value)) throw new InvalidAttributes();
      if (!approvedAttribute(name, descriptor.value)) continue;
      attributes.push({ name, value: descriptor.value });
    }
    attributes.sort((left, right) => compareText(left.name, right.name));
    return attributes;
  } catch (error) {
    if (error instanceof InvalidAttributes) throw error;
    throw new InvalidAttributes();
  }
}

function equalAttributes(left: readonly Attribute[], right: readonly Attribute[]): boolean {
  return left.length === right.length && left.every((attribute, index) => attribute.name === right[index]!.name && attribute.value === right[index]!.value);
}

function embeddingIdentity(subject: string): string {
  return `embedding:${JSON.stringify(subject)}`;
}

function offerIdentity(embedding: string, address: string): string {
  return `offer:${JSON.stringify([embedding, address])}`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function complete(embedding: Embedding): boolean {
  return embedding.offers.size === embedding.expects;
}

function sameDeclaration(
  embedding: Embedding,
  input: Omit<Embedding, "embedding" | "offers">,
): boolean {
  return embedding.subject === input.subject &&
    embedding.alternative === input.alternative &&
    embedding.width === input.width &&
    embedding.height === input.height &&
    embedding.expects === input.expects &&
    embedding.original === input.original &&
    embedding.originalFormat === input.originalFormat &&
    equalAttributes(embedding.attributes, input.attributes);
}

/** Build one safe, deterministic HTML picture element around an explicit original image. */
export class EmbeddingConcept {
  readonly #embeddingsBySubject = new Map<string, Embedding>();
  readonly #embeddingsByID = new Map<string, Embedding>();

  declare({ subject, alternative, width, height, expects, original, originalFormat, attributes }: DeclareInput) {
    requireText(subject);
    requireSerializableText(alternative);
    if (!isPositiveInteger(width) || !isPositiveInteger(height)) throw new InvalidDimension();
    if (!isNonnegativeInteger(expects)) throw new InvalidCount();
    requireAddress(original);
    requireFormat(originalFormat);
    const normalizedAttributes = normalizeAttributes(attributes);
    const declaration = {
      subject,
      alternative,
      width: normalizedInteger(width),
      height: normalizedInteger(height),
      expects: normalizedInteger(expects),
      original,
      originalFormat,
      attributes: normalizedAttributes,
    };
    const current = this.#embeddingsBySubject.get(subject);
    if (current !== undefined && sameDeclaration(current, declaration)) {
      return { embedding: current.embedding, changed: false, completed: false };
    }

    const embedding = current?.embedding ?? embeddingIdentity(subject);
    const record: Embedding = { embedding, ...declaration, offers: new Map<string, Offer>() };
    this.#embeddingsBySubject.set(subject, record);
    this.#embeddingsByID.set(embedding, record);
    return { embedding, changed: true, completed: expects === 0 };
  }

  provideCandidate({ embedding, address, format, width, order }: OfferInput) {
    requireText(embedding);
    const record = this.#embeddingsByID.get(embedding);
    if (record === undefined) throw new EmbeddingNotFound();
    requireAddress(address);
    requireFormat(format);
    if (!isPositiveInteger(width) || width > record.width) throw new InvalidWidth();
    if (!isNonnegativeInteger(order)) throw new InvalidOrder();
    const normalizedWidth = normalizedInteger(width);
    const normalizedOrder = normalizedInteger(order);

    const current = record.offers.get(address);
    if (current !== undefined && current.format === format && current.width === normalizedWidth && current.order === normalizedOrder) {
      return { offer: current.offer, embedding, arrived: record.offers.size, changed: false, completed: false };
    }
    if (complete(record)) throw new EmbeddingComplete();
    if (
      address === record.original ||
      (format === record.originalFormat && normalizedWidth === record.width) ||
      [...record.offers.values()].some((candidate) => candidate.address !== address && candidate.format === format && candidate.width === normalizedWidth)
    ) {
      throw new OfferConflict();
    }

    const offer = current?.offer ?? offerIdentity(embedding, address);
    record.offers.set(address, { offer, embedding, address, format, width: normalizedWidth, order: normalizedOrder });
    const completed = complete(record);
    return { offer, embedding, arrived: record.offers.size, changed: true, completed };
  }

  withdraw({ subject }: { subject: unknown }) {
    requireText(subject);
    const record = this.#embeddingsBySubject.get(subject);
    if (record === undefined) throw new EmbeddingNotFound();
    this.#embeddingsBySubject.delete(subject);
    this.#embeddingsByID.delete(record.embedding);
    return { embedding: record.embedding, count: record.offers.size };
  }

  _embedding({ embedding }: { embedding: unknown }) {
    if (!isText(embedding)) return [];
    const record = this.#embeddingsByID.get(embedding);
    return record === undefined
      ? []
      : [{
          subject: record.subject,
          original: record.original,
          originalFormat: record.originalFormat,
          expects: record.expects,
          arrived: record.offers.size,
          complete: complete(record),
        }];
  }

  _for({ subject }: { subject: unknown }) {
    if (!isText(subject)) return [];
    const record = this.#embeddingsBySubject.get(subject);
    return record === undefined
      ? []
      : [{
          embedding: record.embedding,
          original: record.original,
          originalFormat: record.originalFormat,
          expects: record.expects,
          arrived: record.offers.size,
          complete: complete(record),
        }];
  }

  _offers({ embedding }: { embedding: unknown }): { offer: string; address: string; format: ImageFormat; width: number; order: number }[] {
    if (!isText(embedding)) return [];
    const record = this.#embeddingsByID.get(embedding);
    return record === undefined
      ? []
      : [...record.offers.values()]
          .sort((left, right) => left.order - right.order || compareText(left.format, right.format) || left.width - right.width || compareText(left.address, right.address))
          .map(({ offer, address, format, width, order }) => ({ offer, address, format, width, order }));
  }

  _markup({ embedding }: { embedding: unknown }): { markup: string }[] {
    if (!isText(embedding)) return [];
    const record = this.#embeddingsByID.get(embedding);
    if (record === undefined || !complete(record)) return [];
    return [{ markup: this.#markup(record) }];
  }

  #markup(embedding: Embedding): string {
    const groups = new Map<ImageFormat, OfferGroup>();
    for (const offer of embedding.offers.values()) {
      if (offer.format === embedding.originalFormat) continue;
      const group = groups.get(offer.format);
      if (group === undefined) {
        groups.set(offer.format, { format: offer.format, order: offer.order, offers: [offer] });
      } else {
        group.order = Math.min(group.order, offer.order);
        group.offers.push(offer);
      }
    }
    const ordered = [...groups.values()]
      .sort((left, right) => left.order - right.order || compareText(left.format, right.format))
      .map((group) => ({
        ...group,
        offers: group.offers.sort((left, right) => left.width - right.width || left.order - right.order || compareText(left.address, right.address)),
      }));
    const fallback: Candidate[] = [
      ...[...embedding.offers.values()]
        .filter((offer) => offer.format === embedding.originalFormat)
        .map(({ address, width, order }) => ({ address, width, order })),
      { address: embedding.original, width: embedding.width, order: Number.MAX_SAFE_INTEGER },
    ];
    fallback.sort((left, right) => left.width - right.width || left.order - right.order || compareText(left.address, right.address));

    const srcset = (candidates: readonly Candidate[]): string => candidates.map((candidate) => `${escapeAttribute(candidate.address)} ${candidate.width}w`).join(", ");
    const sizes = embedding.attributes.find(({ name }) => name === "sizes");
    const sourceSizes = sizes === undefined ? "" : ` sizes="${escapeAttribute(sizes.value)}"`;
    const sources = ordered
      .map((group) => `<source type="${MEDIA_TYPE_BY_FORMAT[group.format]}" srcset="${srcset(group.offers)}"${sourceSizes}>`)
      .join("");
    const fallbackSet = fallback.length > 1 ? ` srcset="${srcset(fallback)}"` : "";
    const preserved = embedding.attributes.map(({ name, value }) => ` ${name}="${escapeAttribute(value)}"`).join("");
    const image = `<img src="${escapeAttribute(embedding.original)}"${fallbackSet} width="${embedding.width}" height="${embedding.height}" alt="${escapeAttribute(embedding.alternative)}" loading="lazy" decoding="async"${preserved}>`;
    return `<picture>${sources}${image}</picture>`;
  }
}
