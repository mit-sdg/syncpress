import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import sharp from "sharp";
import { transcoding as transcodingRegistration } from "@concepts/transcoding/registry.ts";
import {
  InvalidSubject,
  InvalidWidths,
  OriginalNotFound,
  RenditionFailed,
  TranscodingConcept,
  UnreadableImage,
  UnsupportedFormat,
  UnsupportedSourceFormat,
  type ImageFormat,
} from "@concepts/transcoding/transcoding.ts";

function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

async function still(format: ImageFormat, width = 12, height = 8): Promise<Uint8Array> {
  const image = sharp({ create: { width, height, channels: 4, background: { r: 38, g: 90, b: 147, alpha: 0.75 } } });
  switch (format) {
    case "avif": return new Uint8Array(await image.avif().toBuffer());
    case "gif": return new Uint8Array(await image.gif().toBuffer());
    case "jpeg": return new Uint8Array(await image.jpeg().toBuffer());
    case "png": return new Uint8Array(await image.png().toBuffer());
    case "webp": return new Uint8Array(await image.webp().toBuffer());
  }
}

async function orientedJpeg(): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width: 40, height: 20, channels: 3, background: "red" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer());
}

async function animation(format: "gif" | "webp", width = 8, height = 6): Promise<Uint8Array> {
  const channels = 4;
  const frameSize = width * height * channels;
  const raw = Buffer.alloc(frameSize * 2);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    raw[pixel * channels] = 255;
    raw[pixel * channels + 3] = 255;
  }
  for (let pixel = width * height; pixel < width * height * 2; pixel += 1) {
    raw[pixel * channels + 1] = 255;
    raw[pixel * channels + 3] = 255;
  }
  const image = sharp(raw, { raw: { width, height: height * 2, channels, pageHeight: height } });
  return new Uint8Array(await (format === "gif"
    ? image.gif({ loop: 2, delay: [40, 80], keepDuplicateFrames: true })
    : image.webp({ loop: 2, delay: [40, 80] })).toBuffer());
}

function actualFormat(metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>): ImageFormat | undefined {
  if (metadata.format === "heif" && metadata.compression === "av1") return "avif";
  if (metadata.format === "gif" || metadata.format === "jpeg" || metadata.format === "png" || metadata.format === "webp") return metadata.format;
  return undefined;
}

test("admits every supported raster source and fully rejects corrupt or unsupported input", async () => {
  for (const format of ["png", "jpeg", "webp", "gif", "avif"] as const) {
    const transcoding = new TranscodingConcept();
    const content = await still(format);
    const admitted = await transcoding.ingest({ subject: format, content });
    expect(admitted).toMatchObject({ digest: sha256(content), format, width: 12, height: 8, animated: false, changed: true });
    expect(admitted.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(await transcoding.ingest({ subject: format, content })).toEqual({ ...admitted, changed: false });
  }

  const transcoding = new TranscodingConcept();
  await expect(transcoding.ingest({ subject: "text", content: new TextEncoder().encode("not an image") })).rejects.toThrow(UnreadableImage);
  await expect(transcoding.ingest({
    subject: "vector",
    content: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8"/></svg>'),
  })).rejects.toThrow(UnsupportedSourceFormat);
  await expect(transcoding.ingest({ subject: "bad-subject", content: "not bytes" as unknown as Uint8Array })).rejects.toThrow(UnreadableImage);
  await expect(transcoding.ingest({ subject: "\ud800", content: await still("png") })).rejects.toThrow(InvalidSubject);

  const jpeg = await still("jpeg", 100, 100);
  const truncated = jpeg.slice(0, -1);
  expect((await sharp(truncated).metadata()).format).toBe("jpeg");
  await expect(transcoding.ingest({ subject: "truncated", content: truncated })).rejects.toThrow(UnreadableImage);
  expect(transcoding._original({ subject: "truncated" })).toEqual([]);
});

test("uses displayed EXIF dimensions and physically orients generated pixels", async () => {
  const transcoding = new TranscodingConcept();
  const content = await orientedJpeg();
  const admitted = await transcoding.ingest({ subject: "portrait", content });
  expect(admitted).toMatchObject({ format: "jpeg", width: 20, height: 40, animated: false });

  expect(await transcoding.generateRenditions({ original: admitted.original, widths: [20, 10], formats: ["webp", "original"] })).toEqual({
    original: admitted.original,
    count: 4,
    derived: 3,
    changed: true,
  });
  const renditions = transcoding._renditions({ original: admitted.original });
  expect(renditions.map(({ width, height, format, order }) => ({ width, height, format, order }))).toEqual([
    { width: 10, height: 20, format: "webp", order: 0 },
    { width: 20, height: 40, format: "webp", order: 1 },
    { width: 10, height: 20, format: "jpeg", order: 2 },
    { width: 20, height: 40, format: "jpeg", order: 3 },
  ]);

  for (const rendition of renditions.slice(0, -1)) {
    const metadata = await sharp(rendition.content).metadata();
    expect(metadata).toMatchObject({ width: rendition.width, height: rendition.height });
    expect(metadata.orientation).toBeUndefined();
  }
  const fallback = renditions.at(-1)!;
  expect(fallback.content).toEqual(content);
  expect(fallback.digest).toBe(admitted.digest);
  expect(fallback.fallback).toBe(true);
  expect(fallback.name).toBe(`${admitted.digest}.jpg`);
  expect(renditions.slice(0, -1).every(({ fallback }) => !fallback)).toBe(true);
  expect(await sharp(fallback.content).metadata()).toMatchObject({ width: 40, height: 20, orientation: 6 });
});

test("normalizes ordering and aliases, prevents upscale, and always ends with an original fallback", async () => {
  const transcoding = new TranscodingConcept();
  const admitted = await transcoding.ingest({ subject: "ordering", content: await still("png", 90, 60) });
  const first = await transcoding.generateRenditions({
    original: admitted.original,
    widths: [60, 30, 60, 120],
    formats: ["jpg", "avif", "jpeg", "original", "avif"],
  });
  expect(first).toEqual({ original: admitted.original, count: 7, derived: 6, changed: true });
  expect(transcoding._renditions({ original: admitted.original }).map(({ width, format, order, fallback }) => ({ width, format, order, fallback }))).toEqual([
    { width: 30, format: "jpeg", order: 0, fallback: false },
    { width: 60, format: "jpeg", order: 1, fallback: false },
    { width: 30, format: "avif", order: 2, fallback: false },
    { width: 60, format: "avif", order: 3, fallback: false },
    { width: 30, format: "png", order: 4, fallback: false },
    { width: 60, format: "png", order: 5, fallback: false },
    { width: 90, format: "png", order: 6, fallback: true },
  ]);
  expect(await transcoding.generateRenditions({
    original: admitted.original,
    widths: [120, 30, 60],
    formats: ["jpeg", "avif", "original"],
  })).toEqual({ original: admitted.original, count: 7, derived: 6, changed: false });

  const removed = transcoding._renditions({ original: admitted.original })[1]!.rendition;
  expect(await transcoding.generateRenditions({ original: admitted.original, widths: [45], formats: ["avif"] })).toEqual({
    original: admitted.original,
    count: 3,
    derived: 2,
    changed: true,
  });
  expect(transcoding._rendition({ rendition: removed })).toEqual([]);

  const small = new TranscodingConcept();
  const smallOriginal = await small.ingest({ subject: "small", content: await still("png", 20, 10) });
  expect(await small.generateRenditions({ original: smallOriginal.original, widths: [480, 960], formats: ["avif", "webp"] })).toEqual({
    original: smallOriginal.original,
    count: 1,
    derived: 0,
    changed: true,
  });
  expect(small._renditions({ original: smallOriginal.original })).toMatchObject([
    { width: 20, height: 10, format: "png", order: 0, digest: smallOriginal.digest, fallback: true },
  ]);
  expect(await small.generateRenditions({ original: smallOriginal.original, widths: [], formats: [] })).toEqual({
    original: smallOriginal.original,
    count: 1,
    derived: 0,
    changed: false,
  });
});

test("reports stable intrinsic rendition facts and collision-resistant suggested names", async () => {
  const content = await still("png", 12, 8);
  const first = new TranscodingConcept();
  const admitted = await first.ingest({ subject: "facts", content });
  await first.generateRenditions({ original: admitted.original, widths: [6], formats: ["avif", "gif", "jpg", "png", "webp"] });
  const renditions = first._renditions({ original: admitted.original });
  expect(renditions.map(({ format }) => format)).toEqual(["avif", "gif", "jpeg", "webp", "png", "png"]);
  expect(new Set(renditions.map(({ name }) => name)).size).toBe(renditions.length);
  expect(renditions.filter(({ fallback }) => fallback)).toEqual([renditions.at(-1)!]);

  const expectedFacts = {
    avif: ["avif", "image/avif"],
    gif: ["gif", "image/gif"],
    jpeg: ["jpg", "image/jpeg"],
    png: ["png", "image/png"],
    webp: ["webp", "image/webp"],
  } as const;
  for (const rendition of renditions) {
    const metadata = await sharp(rendition.content, { animated: true }).metadata();
    expect(actualFormat(metadata)).toBe(rendition.format);
    expect(rendition.mediaType).toBe(metadata.mediaType!);
    expect([metadata.width, metadata.pageHeight ?? metadata.height]).toEqual([rendition.width, rendition.height]);
    expect([rendition.extension, rendition.mediaType]).toEqual([...expectedFacts[rendition.format]]);
    expect(rendition.digest).toBe(sha256(rendition.content));
    expect(rendition.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(rendition.name).toBe(`${rendition.digest}.${rendition.extension}`);
    expect(first._rendition({ rendition: rendition.rendition })).toEqual([{
      original: admitted.original,
      width: rendition.width,
      height: rendition.height,
      format: rendition.format,
      animated: rendition.animated,
      order: rendition.order,
      digest: rendition.digest,
      extension: rendition.extension,
      name: rendition.name,
      mediaType: rendition.mediaType,
      fallback: rendition.fallback,
    }]);
  }
  expect(renditions.at(-1)!.content).toEqual(content);

  const second = new TranscodingConcept();
  const equivalent = await second.ingest({ subject: "facts", content });
  await second.generateRenditions({ original: equivalent.original, widths: [6], formats: ["avif", "gif", "jpg", "png", "webp"] });
  expect(second._renditions({ original: equivalent.original })).toEqual(renditions);

  const otherSubject = await second.ingest({ subject: "same-bytes", content });
  await second.generateRenditions({ original: otherSubject.original, widths: [6], formats: ["avif", "gif", "jpg", "png", "webp"] });
  expect(second._renditions({ original: otherSubject.original }).map(({ name }) => name)).toEqual(
    renditions.map(({ name }) => name),
  );
});

test("copies source and rendition bytes at every boundary", async () => {
  const supplied = Buffer.from(await still("png", 10, 5));
  const expected = Uint8Array.from(supplied);
  const transcoding = new TranscodingConcept();
  const admitted = await transcoding.ingest({ subject: "clones", content: supplied });
  supplied.fill(0);
  await transcoding.generateRenditions({ original: admitted.original, widths: [], formats: [] });

  const observed = transcoding._renditions({ original: admitted.original })[0]!;
  expect(observed.content).toEqual(expected);
  observed.content.fill(0);
  expect(transcoding._renditions({ original: admitted.original })[0]!.content).toEqual(expected);
});

test("validates the whole width and format request before changing state", async () => {
  const transcoding = new TranscodingConcept();
  const admitted = await transcoding.ingest({ subject: "validation", content: await still("png") });
  await transcoding.generateRenditions({ original: admitted.original, widths: [6], formats: ["webp"] });
  const before = transcoding._renditions({ original: admitted.original });

  for (const widths of [[0], [-1], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY], [Number.MAX_SAFE_INTEGER + 1], [6, 0]]) {
    await expect(transcoding.generateRenditions({ original: admitted.original, widths, formats: ["webp"] })).rejects.toThrow(InvalidWidths);
  }
  await expect(transcoding.generateRenditions({ original: admitted.original, widths: "6" as unknown as number[], formats: ["webp"] })).rejects.toThrow(InvalidWidths);
  await expect(transcoding.generateRenditions({ original: admitted.original, widths: [6], formats: ["jxl"] })).rejects.toThrow(UnsupportedFormat);
  await expect(transcoding.generateRenditions({ original: admitted.original, widths: [6], formats: ["JPG"] })).rejects.toThrow(UnsupportedFormat);
  await expect(transcoding.generateRenditions({ original: admitted.original, widths: [6], formats: [1 as unknown as string] })).rejects.toThrow(UnsupportedFormat);
  await expect(transcoding.generateRenditions({ original: admitted.original, widths: [6], formats: "webp" as unknown as string[] })).rejects.toThrow(UnsupportedFormat);
  expect(transcoding._renditions({ original: admitted.original })).toEqual(before);
});

test("preserves animated GIF frames, timing, and loop while skipping static formats", async () => {
  const content = await animation("gif");
  const transcoding = new TranscodingConcept();
  const admitted = await transcoding.ingest({ subject: "animation", content });
  expect(admitted).toMatchObject({ format: "gif", width: 8, height: 6, animated: true });

  expect(await transcoding.generateRenditions({
    original: admitted.original,
    widths: [8, 4, 20],
    formats: ["avif", "png", "webp", "gif", "original"],
  })).toEqual({ original: admitted.original, count: 4, derived: 3, changed: true });
  const renditions = transcoding._renditions({ original: admitted.original });
  expect(renditions.map(({ width, height, format, animated, order }) => ({ width, height, format, animated, order }))).toEqual([
    { width: 4, height: 3, format: "webp", animated: true, order: 0 },
    { width: 8, height: 6, format: "webp", animated: true, order: 1 },
    { width: 4, height: 3, format: "gif", animated: true, order: 2 },
    { width: 8, height: 6, format: "gif", animated: true, order: 3 },
  ]);
  for (const rendition of renditions) {
    expect(await sharp(rendition.content, { animated: true }).metadata()).toMatchObject({
      pages: 2,
      pageHeight: rendition.height,
      loop: 2,
      delay: [40, 80],
    });
  }
  expect(renditions.at(-1)!.content).toEqual(content);
  expect(renditions.map(({ fallback }) => fallback)).toEqual([false, false, false, true]);
  expect(await transcoding.generateRenditions({
    original: admitted.original,
    widths: [4, 8],
    formats: ["avif", "png", "webp", "original"],
  })).toEqual({ original: admitted.original, count: 4, derived: 3, changed: false });
});

test("failed rendering is atomic and refuses consistently", async () => {
  const content = new Uint8Array(await sharp({ create: { width: 70_000, height: 1, channels: 3, background: "red" } }).png().toBuffer());
  const transcoding = new TranscodingConcept();
  const admitted = await transcoding.ingest({ subject: "too-wide-for-gif", content });
  await transcoding.generateRenditions({ original: admitted.original, widths: [], formats: [] });
  const before = transcoding._renditions({ original: admitted.original });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await expect(transcoding.generateRenditions({ original: admitted.original, widths: [70_000], formats: ["gif"] })).rejects.toThrow(RenditionFailed);
    expect(transcoding._renditions({ original: admitted.original })).toEqual(before);
  }
});

test("replacement and removeSource remove every stale identity and preserve collision-safe identities", async () => {
  const firstContent = await still("png", 12, 8);
  const secondContent = await still("png", 13, 8);
  const transcoding = new TranscodingConcept();
  const first = await transcoding.ingest({ subject: "a:b", content: firstContent });
  await transcoding.generateRenditions({ original: first.original, widths: [6], formats: ["webp"] });
  const staleRendition = transcoding._renditions({ original: first.original })[0]!.rendition;

  const replacement = await transcoding.ingest({ subject: "a:b", content: secondContent });
  expect(replacement).toMatchObject({ changed: true, width: 13 });
  expect(replacement.original).not.toBe(first.original);
  expect(transcoding._renditions({ original: first.original })).toEqual([]);
  expect(transcoding._rendition({ rendition: staleRendition })).toEqual([]);
  await expect(transcoding.generateRenditions({ original: first.original, widths: [], formats: [] })).rejects.toThrow(OriginalNotFound);

  const other = await transcoding.ingest({ subject: "a", content: secondContent });
  expect(other.original).not.toBe(replacement.original);
  expect(transcoding.removeSource({ subject: "a:b" })).toEqual({ subject: "a:b", count: 1 });
  expect(transcoding._original({ subject: "a:b" })).toEqual([]);
  expect(transcoding.removeSource({ subject: "a:b" })).toEqual({ subject: "a:b", count: 0 });
  expect(() => transcoding.removeSource({ subject: "\ud800" })).toThrow(InvalidSubject);

  const restored = await transcoding.ingest({ subject: "a:b", content: secondContent });
  expect(restored.original).toBe(replacement.original);
  const equivalent = await new TranscodingConcept().ingest({ subject: "a:b", content: secondContent });
  expect(equivalent.original).toBe(replacement.original);
});

test("a failed replacement leaves the current original and renditions intact", async () => {
  const transcoding = new TranscodingConcept();
  const admitted = await transcoding.ingest({ subject: "atomic-admit", content: await still("png") });
  await transcoding.generateRenditions({ original: admitted.original, widths: [6], formats: ["webp"] });
  const before = transcoding._renditions({ original: admitted.original });
  const jpeg = await still("jpeg", 100, 100);

  await expect(transcoding.ingest({ subject: "atomic-admit", content: jpeg.slice(0, -1) })).rejects.toThrow(UnreadableImage);
  expect(transcoding._original({ subject: "atomic-admit" })).toMatchObject([{ original: admitted.original, digest: admitted.digest }]);
  expect(transcoding._renditions({ original: admitted.original })).toEqual(before);
});

test("registry maps every refusal to its normative message", async () => {
  expect(transcodingRegistration.refusals).toEqual({
    INVALID_SUBJECT: InvalidSubject,
    UNREADABLE_IMAGE: UnreadableImage,
    UNSUPPORTED_SOURCE_FORMAT: UnsupportedSourceFormat,
    ORIGINAL_NOT_FOUND: OriginalNotFound,
    INVALID_WIDTHS: InvalidWidths,
    UNSUPPORTED_FORMAT: UnsupportedFormat,
    RENDITION_FAILED: RenditionFailed,
  });
  expect(transcodingRegistration.specification.actions.flatMap(({ refusals }) => refusals.map(({ code, message }) => [code, message]))).toEqual([
    ["INVALID_SUBJECT", "An image subject must be well-formed text."],
    ["UNREADABLE_IMAGE", "These bytes are not a fully readable image."],
    ["UNSUPPORTED_SOURCE_FORMAT", "The source image format is not supported."],
    ["ORIGINAL_NOT_FOUND", "There is no such image."],
    ["INVALID_WIDTHS", "Widths must be positive safe integers."],
    ["UNSUPPORTED_FORMAT", "A rendition format is unsupported or unavailable."],
    ["RENDITION_FAILED", "A requested image rendition could not be produced."],
    ["INVALID_SUBJECT", "An image subject must be well-formed text."],
  ]);

  const concepts = conceptSet({ Transcoding: transcodingRegistration });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  const Transcoding = app.concepts.Transcoding;
  const validContent = await still("png");
  expect(await Transcoding.ingest({ subject: "\ud800", content: validContent })).toEqual({
    error: "INVALID_SUBJECT",
    detail: "An image subject must be well-formed text.",
  });
  expect(await Transcoding.generateRenditions({ original: "missing", widths: [], formats: [] })).toEqual({
    error: "ORIGINAL_NOT_FOUND",
    detail: "There is no such image.",
  });
  expect(await Transcoding.ingest({ subject: "broken", content: new Uint8Array([1, 2, 3]) })).toEqual({
    error: "UNREADABLE_IMAGE",
    detail: "These bytes are not a fully readable image.",
  });
  expect(await Transcoding.ingest({
    subject: "vector",
    content: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8"/></svg>'),
  })).toEqual({
    error: "UNSUPPORTED_SOURCE_FORMAT",
    detail: "The source image format is not supported.",
  });
  const admitted = await Transcoding.ingest({ subject: "valid", content: validContent }) as { original: string };
  expect(await Transcoding.generateRenditions({ original: admitted.original, widths: [0], formats: [] })).toEqual({
    error: "INVALID_WIDTHS",
    detail: "Widths must be positive safe integers.",
  });
  expect(await Transcoding.generateRenditions({ original: admitted.original, widths: [], formats: ["jxl"] })).toEqual({
    error: "UNSUPPORTED_FORMAT",
    detail: "A rendition format is unsupported or unavailable.",
  });

  const wideContent = new Uint8Array(await sharp({ create: { width: 70_000, height: 1, channels: 3, background: "red" } }).png().toBuffer());
  const wide = await Transcoding.ingest({ subject: "wide", content: wideContent }) as { original: string };
  expect(await Transcoding.generateRenditions({ original: wide.original, widths: [70_000], formats: ["gif"] })).toEqual({
    error: "RENDITION_FAILED",
    detail: "A requested image rendition could not be produced.",
  });
  await app.whenIdle();
});
