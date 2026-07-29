import { createHash } from "node:crypto";
import sharp from "sharp";

export class OriginalNotFound extends Error {}
export class UnreadableImage extends Error {}

type Original = {
  original: string;
  subject: string;
  content: Uint8Array;
  digest: string;
  format: string;
  width: number;
  height: number;
  animated: boolean;
};
type Rendition = {
  rendition: string;
  original: string;
  width: number;
  format: string;
  order: number;
  content: Uint8Array;
  name: string;
  medium: string;
};
type Plan = Pick<Rendition, "width" | "format" | "order" | "name" | "medium">;
type OutputFormat = keyof typeof sharp.format | "avif";

const mediaByFormat: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jxl: "image/jxl",
  png: "image/png",
  tiff: "image/tiff",
  webp: "image/webp",
};

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function renditionName(original: Original, width: number, format: string): string {
  return `${original.digest}-${width}.${format}`;
}

function mediumFor(format: string): string {
  return mediaByFormat[format] ?? "application/octet-stream";
}

function effectiveFormat(format: string, original: Original): string {
  if (format === "original") return original.format;
  return format === "jpg" ? "jpeg" : format;
}

function preservesAnimation(format: string): boolean {
  return format === "gif" || format === "webp";
}

function canEncode(format: string): boolean {
  if (format === "avif") return true;
  return sharp.format[format as keyof typeof sharp.format]?.output.buffer === true;
}

/** Derive stable, resized image renditions without choosing where they are published. */
export class TranscodingConcept {
  readonly #originalsBySubject = new Map<string, Original>();
  readonly #originalsByID = new Map<string, Original>();
  readonly #renditionsByOriginal = new Map<string, Rendition[]>();
  readonly #renditionsByID = new Map<string, Rendition>();

  async admit({ subject, content }: { subject: string; content: Uint8Array }) {
    const nextDigest = digest(content);
    const current = this.#originalsBySubject.get(subject);
    if (current?.digest === nextDigest) {
      return {
        original: current.original,
        format: current.format,
        width: current.width,
        height: current.height,
        animated: current.animated,
        changed: false,
      };
    }

    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
    try {
      metadata = await sharp(content, { animated: true }).metadata();
    } catch {
      throw new UnreadableImage();
    }
    if (metadata.format === undefined || metadata.width === undefined || metadata.height === undefined) {
      throw new UnreadableImage();
    }

    const animated = (metadata.pages ?? 1) > 1;
    const original = current?.original ?? `original:${subject}`;
    const record: Original = {
      original,
      subject,
      content: content.slice(),
      digest: nextDigest,
      format: metadata.format,
      width: metadata.width,
      height: animated ? metadata.pageHeight ?? metadata.height : metadata.height,
      animated,
    };
    if (current !== undefined) this.#discardRenditions(current.original);
    this.#originalsBySubject.set(subject, record);
    this.#originalsByID.set(original, record);
    return { original, format: record.format, width: record.width, height: record.height, animated, changed: true };
  }

  async render({ original, widths, formats }: { original: string; widths: number[]; formats: string[] }) {
    const source = this.#originalsByID.get(original);
    if (source === undefined) throw new OriginalNotFound();

    const plan = this.#plan(source, widths, formats);
    const current = this.#renditionsByOriginal.get(original) ?? [];
    if (this.#matches(current, plan)) return { original, count: current.length, changed: false };

    this.#discardRenditions(original);
    const renditions: Rendition[] = [];
    for (const item of plan) {
      const content = await this.#encode(source, item.width, item.format);
      if (content === undefined) continue;
      const rendition = `rendition:${original}:${item.width}:${item.format}`;
      const record = { rendition, original, content, ...item };
      renditions.push(record);
      this.#renditionsByID.set(rendition, record);
    }
    this.#renditionsByOriginal.set(original, renditions);
    return { original, count: renditions.length, changed: true };
  }

  release({ subject }: { subject: string }) {
    const record = this.#originalsBySubject.get(subject);
    if (record !== undefined) {
      this.#originalsBySubject.delete(subject);
      this.#originalsByID.delete(record.original);
      this.#discardRenditions(record.original);
    }
    return { original: record?.original ?? `original:${subject}` };
  }

  _original({ subject }: { subject: string }): { original: string; format: string; width: number; height: number; animated: boolean }[] {
    const record = this.#originalsBySubject.get(subject);
    return record === undefined
      ? []
      : [{ original: record.original, format: record.format, width: record.width, height: record.height, animated: record.animated }];
  }

  _renditions({ original }: { original: string }): { rendition: string; width: number; format: string; order: number; name: string; medium: string; content: Uint8Array }[] {
    return (this.#renditionsByOriginal.get(original) ?? [])
      .slice()
      .sort((left, right) => left.order - right.order)
      .map(({ rendition, width, format, order, name, medium, content }) => ({ rendition, width, format, order, name, medium, content: content.slice() }));
  }

  _rendition({ rendition }: { rendition: string }) {
    const record = this.#renditionsByID.get(rendition);
    return record === undefined
      ? { original: "", width: 0, format: "", order: 0, name: "", medium: "" }
      : { original: record.original, width: record.width, format: record.format, order: record.order, name: record.name, medium: record.medium };
  }

  #plan(original: Original, widths: number[], formats: string[]): Plan[] {
    const planned: Plan[] = [];
    const seen = new Set<string>();
    for (const requestedFormat of formats) {
      const format = effectiveFormat(requestedFormat, original);
      if (original.animated && !preservesAnimation(format)) continue;
      for (const width of widths) {
        if (!Number.isInteger(width) || width <= 0 || width > original.width) continue;
        if (!canEncode(format) && !(format === original.format && width === original.width)) continue;
        const key = `${width}\u0000${format}`;
        if (seen.has(key)) continue;
        seen.add(key);
        planned.push({ width, format, order: planned.length, name: renditionName(original, width, format), medium: mediumFor(format) });
      }
    }
    return planned;
  }

  #matches(renditions: Rendition[], plan: Plan[]): boolean {
    return renditions.length === plan.length && renditions.every((rendition, index) => {
      const item = plan[index]!;
      return rendition.width === item.width && rendition.format === item.format && rendition.order === item.order && rendition.name === item.name;
    });
  }

  async #encode(original: Original, width: number, format: string): Promise<Uint8Array | undefined> {
    if (width === original.width && format === original.format) return original.content.slice();
    try {
      const content = await sharp(original.content, { animated: original.animated })
        .resize({ width, withoutEnlargement: true })
        .toFormat(format as OutputFormat)
        .toBuffer();
      const metadata = original.animated ? await sharp(content, { animated: true }).metadata() : undefined;
      if (original.animated && (metadata?.pages ?? 1) < 2) {
        return undefined;
      }
      return new Uint8Array(content);
    } catch {
      return undefined;
    }
  }

  #discardRenditions(original: string): void {
    for (const rendition of this.#renditionsByOriginal.get(original) ?? []) this.#renditionsByID.delete(rendition.rendition);
    this.#renditionsByOriginal.delete(original);
  }
}
