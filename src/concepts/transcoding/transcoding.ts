import { createHash } from "node:crypto";
import sharp from "sharp";

const INVALID_SUBJECT = "An image subject must be well-formed text.";
const UNREADABLE_IMAGE = "These bytes are not a fully readable image.";
const UNSUPPORTED_SOURCE_FORMAT = "The source image format is not supported.";
const ORIGINAL_NOT_FOUND = "There is no such image.";
const INVALID_WIDTHS = "Widths must be positive safe integers.";
const UNSUPPORTED_FORMAT = "A rendition format is unsupported or unavailable.";
const RENDITION_FAILED = "A requested image rendition could not be produced.";

export class InvalidSubject extends Error {
  constructor() {
    super(INVALID_SUBJECT);
    this.name = "InvalidSubject";
  }
}

export class UnreadableImage extends Error {
  constructor() {
    super(UNREADABLE_IMAGE);
    this.name = "UnreadableImage";
  }
}

export class UnsupportedSourceFormat extends Error {
  constructor() {
    super(UNSUPPORTED_SOURCE_FORMAT);
    this.name = "UnsupportedSourceFormat";
  }
}

export class OriginalNotFound extends Error {
  constructor() {
    super(ORIGINAL_NOT_FOUND);
    this.name = "OriginalNotFound";
  }
}

export class InvalidWidths extends Error {
  constructor() {
    super(INVALID_WIDTHS);
    this.name = "InvalidWidths";
  }
}

export class UnsupportedFormat extends Error {
  constructor() {
    super(UNSUPPORTED_FORMAT);
    this.name = "UnsupportedFormat";
  }
}

export class RenditionFailed extends Error {
  constructor() {
    super(RENDITION_FAILED);
    this.name = "RenditionFailed";
  }
}

export type ImageFormat = "avif" | "gif" | "jpeg" | "png" | "webp";

type Metadata = Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
type FormatFacts = { extension: string; mediaType: string };
type Original = {
  original: string;
  subject: string;
  content: Uint8Array;
  digest: string;
  format: ImageFormat;
  width: number;
  height: number;
  animated: boolean;
  frames: number;
  loop: number;
  delay: number[];
};
type Rendition = {
  rendition: string;
  original: string;
  width: number;
  height: number;
  format: ImageFormat;
  animated: boolean;
  order: number;
  content: Uint8Array;
  digest: string;
  extension: string;
  mediaType: string;
};
type Plan = Pick<Rendition, "width" | "format" | "order"> & { exactOriginal: boolean };

const factsByFormat: Record<ImageFormat, FormatFacts> = {
  avif: { extension: "avif", mediaType: "image/avif" },
  gif: { extension: "gif", mediaType: "image/gif" },
  jpeg: { extension: "jpg", mediaType: "image/jpeg" },
  png: { extension: "png", mediaType: "image/png" },
  webp: { extension: "webp", mediaType: "image/webp" },
};

const formatAliases: Readonly<Record<string, ImageFormat | "original">> = {
  avif: "avif",
  gif: "gif",
  jpeg: "jpeg",
  jpg: "jpeg",
  original: "original",
  png: "png",
  webp: "webp",
};

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function copyBytes(content: unknown): Uint8Array {
  if (!(content instanceof Uint8Array)) throw new UnreadableImage();
  try {
    return Uint8Array.from(content);
  } catch {
    throw new UnreadableImage();
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isDensePlainArray(value: unknown): value is unknown[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || !keys.includes("length")) return false;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function normalizedWidths(widths: unknown): number[] {
  if (!isDensePlainArray(widths)) throw new InvalidWidths();
  const unique = new Set<number>();
  for (const width of widths) {
    if (typeof width !== "number" || !Number.isSafeInteger(width) || width <= 0) throw new InvalidWidths();
    unique.add(width);
  }
  return [...unique].sort((left, right) => left - right);
}

function encoderAvailable(format: ImageFormat): boolean {
  const sharpFormat = format === "avif" ? sharp.format.heif : sharp.format[format];
  if (sharpFormat?.output.buffer !== true) return false;
  return format !== "avif" || sharpFormat.output.alias?.includes("avif") === true;
}

function normalizedFormats(formats: unknown): ImageFormat[] {
  if (!isDensePlainArray(formats)) throw new UnsupportedFormat();
  const unique = new Set<ImageFormat>();
  for (const requested of formats) {
    if (typeof requested !== "string") throw new UnsupportedFormat();
    const format = formatAliases[requested];
    if (format === undefined) throw new UnsupportedFormat();
    if (format !== "original") {
      if (!encoderAvailable(format)) throw new UnsupportedFormat();
      unique.add(format);
    }
  }
  return [...unique];
}

function canonicalFormat(metadata: Metadata): ImageFormat | undefined {
  if (metadata.format === "heif" && metadata.compression === "av1" && metadata.mediaType === "image/avif") return "avif";
  if (metadata.format === "gif" || metadata.format === "jpeg" || metadata.format === "png" || metadata.format === "webp") return metadata.format;
  return undefined;
}

function displayedDimensions(metadata: Metadata): { width: number; height: number } | undefined {
  if (!Number.isSafeInteger(metadata.width) || metadata.width! <= 0) return undefined;
  const frames = metadata.pages ?? 1;
  if (!Number.isSafeInteger(frames) || frames <= 0) return undefined;
  const frameHeight = frames > 1 ? metadata.pageHeight : metadata.height;
  if (!Number.isSafeInteger(frameHeight) || frameHeight! <= 0) return undefined;
  return metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8
    ? { width: frameHeight!, height: metadata.width! }
    : { width: metadata.width!, height: frameHeight! };
}

function originalIdentity(subject: string, sourceDigest: string): string {
  return `original:${JSON.stringify([subject, sourceDigest])}`;
}

function renditionIdentity(original: string, width: number, format: ImageFormat, contentDigest: string): string {
  return `rendition:${JSON.stringify([original, width, format, contentDigest])}`;
}

function preservesAnimation(format: ImageFormat): boolean {
  return format === "gif" || format === "webp";
}

function expectedHeight(original: Original, width: number): number {
  return Math.max(1, Math.round((original.height * width) / original.width));
}

function sameNumbers(left: number[], right: readonly number[] | undefined): boolean {
  return right !== undefined && left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Derive factual, content-addressed image renditions without choosing publication names or locations. */
export class TranscodingConcept {
  readonly #originalsBySubject = new Map<string, Original>();
  readonly #originalsByID = new Map<string, Original>();
  readonly #renditionsByOriginal = new Map<string, Rendition[]>();
  readonly #renditionsByID = new Map<string, Rendition>();

  async admit({ subject, content }: { subject: string; content: Uint8Array }) {
    if (!isText(subject)) throw new InvalidSubject();
    const nextContent = copyBytes(content);
    const nextDigest = digest(nextContent);
    const current = this.#originalsBySubject.get(subject);
    if (current?.digest === nextDigest && sameBytes(current.content, nextContent)) return this.#admission(current, false);

    let metadata: Metadata;
    try {
      metadata = await sharp(nextContent, { animated: true, failOn: "warning" }).metadata();
    } catch {
      throw new UnreadableImage();
    }
    const dimensions = displayedDimensions(metadata);
    if (dimensions === undefined) throw new UnreadableImage();

    try {
      await sharp(nextContent, { animated: true, failOn: "warning" }).stats();
    } catch {
      throw new UnreadableImage();
    }
    const format = canonicalFormat(metadata);
    if (format === undefined) throw new UnsupportedSourceFormat();

    const frames = metadata.pages ?? 1;
    const original = originalIdentity(subject, nextDigest);
    const record: Original = {
      original,
      subject,
      content: nextContent,
      digest: nextDigest,
      format,
      width: dimensions.width,
      height: dimensions.height,
      animated: frames > 1,
      frames,
      loop: metadata.loop ?? 0,
      delay: [...(metadata.delay ?? [])],
    };
    if (current !== undefined) {
      this.#originalsByID.delete(current.original);
      this.#discardRenditions(current.original);
    }
    this.#originalsBySubject.set(subject, record);
    this.#originalsByID.set(original, record);
    return this.#admission(record, true);
  }

  async render({ original, widths, formats }: { original: string; widths: number[]; formats: string[] }) {
    const source = this.#originalsByID.get(original);
    if (source === undefined) throw new OriginalNotFound();
    const normalizedWidthList = normalizedWidths(widths);
    const normalizedFormatList = normalizedFormats(formats);
    const needsSourceEncoder = normalizedWidthList.some((width) => width < source.width) && (!source.animated || preservesAnimation(source.format));
    if (needsSourceEncoder && !encoderAvailable(source.format)) throw new UnsupportedFormat();
    const plan = this.#plan(source, normalizedWidthList, normalizedFormatList);
    const current = this.#renditionsByOriginal.get(original) ?? [];
    if (this.#matches(current, plan)) return { original, count: current.length, changed: false };

    const renditions: Rendition[] = [];
    for (const item of plan) renditions.push(await this.#derive(source, item));

    this.#discardRenditions(original);
    this.#renditionsByOriginal.set(original, renditions);
    for (const rendition of renditions) this.#renditionsByID.set(rendition.rendition, rendition);
    return { original, count: renditions.length, changed: true };
  }

  release({ subject }: { subject: string }) {
    if (!isText(subject)) throw new InvalidSubject();
    const record = this.#originalsBySubject.get(subject);
    if (record === undefined) return { subject, count: 0 };
    this.#originalsBySubject.delete(subject);
    this.#originalsByID.delete(record.original);
    this.#discardRenditions(record.original);
    return { subject, count: 1 };
  }

  _original({ subject }: { subject: string }): { original: string; digest: string; format: ImageFormat; width: number; height: number; animated: boolean }[] {
    if (!isText(subject)) return [];
    const record = this.#originalsBySubject.get(subject);
    return record === undefined
      ? []
      : [{ original: record.original, digest: record.digest, format: record.format, width: record.width, height: record.height, animated: record.animated }];
  }

  _renditions({ original }: { original: string }): Array<Omit<Rendition, "original">> {
    if (!isText(original)) return [];
    return (this.#renditionsByOriginal.get(original) ?? []).map((record) => ({
      rendition: record.rendition,
      ...this.#renditionFacts(record),
      content: Uint8Array.from(record.content),
    }));
  }

  _rendition({ rendition }: { rendition: string }): Array<Omit<Rendition, "rendition" | "content">> {
    if (!isText(rendition)) return [];
    const record = this.#renditionsByID.get(rendition);
    return record === undefined ? [] : [{ original: record.original, ...this.#renditionFacts(record) }];
  }

  #admission(record: Original, changed: boolean) {
    return {
      original: record.original,
      digest: record.digest,
      format: record.format,
      width: record.width,
      height: record.height,
      animated: record.animated,
      changed,
    };
  }

  #plan(original: Original, widths: number[], formats: ImageFormat[]): Plan[] {
    const planned: Plan[] = [];
    const usableWidths = widths.filter((width) => width <= original.width);
    const orderedFormats = formats.filter((format) => format !== original.format);

    for (const format of orderedFormats) {
      if (original.animated && !preservesAnimation(format)) continue;
      for (const width of usableWidths) planned.push({ width, format, order: planned.length, exactOriginal: false });
    }

    if (!original.animated || preservesAnimation(original.format)) {
      for (const width of usableWidths) {
        if (width < original.width) planned.push({ width, format: original.format, order: planned.length, exactOriginal: false });
      }
    }
    planned.push({ width: original.width, format: original.format, order: planned.length, exactOriginal: true });
    return planned;
  }

  #matches(renditions: Rendition[], plan: Plan[]): boolean {
    return renditions.length === plan.length && renditions.every((rendition, index) => {
      const item = plan[index]!;
      return rendition.width === item.width && rendition.format === item.format && rendition.order === item.order;
    });
  }

  async #derive(original: Original, item: Plan): Promise<Rendition> {
    if (item.exactOriginal) return this.#record(original, item, original.content, original.height, original.animated);

    try {
      let pipeline = sharp(original.content, { animated: true, failOn: "warning" })
        .autoOrient()
        .resize({
          width: item.width,
          fit: "inside",
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true,
          fastShrinkOnLoad: false,
        });

      switch (item.format) {
        case "avif":
          pipeline = pipeline.avif({ quality: 50, lossless: false, effort: 4, chromaSubsampling: "4:4:4", bitdepth: 8, tune: "auto" });
          break;
        case "gif":
          pipeline = pipeline.gif({
            reuse: true,
            progressive: false,
            colours: 256,
            effort: 7,
            dither: 1,
            interFrameMaxError: 0,
            interPaletteMaxError: 3,
            keepDuplicateFrames: true,
            ...(original.animated ? { loop: original.loop, delay: original.delay } : {}),
          });
          break;
        case "jpeg":
          pipeline = pipeline.jpeg({ quality: 80, progressive: false, chromaSubsampling: "4:2:0", optimiseCoding: true });
          break;
        case "png":
          pipeline = pipeline.png({ progressive: false, compressionLevel: 9, adaptiveFiltering: false, palette: false });
          break;
        case "webp":
          pipeline = pipeline.webp({
            quality: 80,
            alphaQuality: 100,
            lossless: false,
            nearLossless: false,
            smartSubsample: false,
            effort: 4,
            ...(original.animated ? { loop: original.loop, delay: original.delay } : {}),
          });
          break;
      }

      const output = await pipeline.toBuffer({ resolveWithObject: true });
      const content = Uint8Array.from(output.data);
      const metadata = await sharp(content, { animated: true, failOn: "warning" }).metadata();
      const dimensions = displayedDimensions(metadata);
      if (canonicalFormat(metadata) !== item.format || dimensions?.width !== item.width || dimensions.height !== expectedHeight(original, item.width)) {
        throw new RenditionFailed();
      }
      await sharp(content, { animated: true, failOn: "warning" }).stats();

      const frames = metadata.pages ?? 1;
      if (original.animated) {
        if (frames !== original.frames || (metadata.loop ?? 0) !== original.loop || !sameNumbers(original.delay, metadata.delay)) throw new RenditionFailed();
      } else if (frames !== 1) {
        throw new RenditionFailed();
      }
      return this.#record(original, item, content, dimensions.height, original.animated);
    } catch (error) {
      if (error instanceof RenditionFailed) throw error;
      throw new RenditionFailed();
    }
  }

  #record(original: Original, item: Plan, sourceContent: Uint8Array, height: number, animated: boolean): Rendition {
    const content = Uint8Array.from(sourceContent);
    const contentDigest = digest(content);
    const facts = factsByFormat[item.format];
    return {
      rendition: renditionIdentity(original.original, item.width, item.format, contentDigest),
      original: original.original,
      width: item.width,
      height,
      format: item.format,
      animated,
      order: item.order,
      content,
      digest: contentDigest,
      extension: facts.extension,
      mediaType: facts.mediaType,
    };
  }

  #renditionFacts(record: Rendition) {
    return {
      width: record.width,
      height: record.height,
      format: record.format,
      animated: record.animated,
      order: record.order,
      digest: record.digest,
      extension: record.extension,
      mediaType: record.mediaType,
    };
  }

  #discardRenditions(original: string): void {
    for (const rendition of this.#renditionsByOriginal.get(original) ?? []) this.#renditionsByID.delete(rendition.rendition);
    this.#renditionsByOriginal.delete(original);
  }
}
