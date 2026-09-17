import { expect, spyOn, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import sharp from "sharp";
import { RenditionCache } from "@concepts/transcoding/cache.ts";
import { TranscodingConcept, UnreadableImage } from "@concepts/transcoding/transcoding.ts";

const key = (text: string) => createHash("sha256").update(text).digest("hex");
const image = (width = 24) => sharp({ create: { width, height: 16, channels: 3, background: "red" } }).png().toBuffer();

async function cacheFiles(directory: string): Promise<string[]> {
  return (await readdir(directory, { recursive: true })).filter((path) => path.endsWith(".bin")).map((path) => join(directory, path));
}

async function temporary(run: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "syncpress-image-cache-test-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("rendition cache verifies identity, checksum, completeness, and size", async () => {
  await temporary(async (directory) => {
    const cache = new RenditionCache(directory);
    const first = key("first");
    const second = key("second");
    const content = Uint8Array.from([0, 255, 10, 128]);
    expect(await cache.read(first)).toBeUndefined();
    await cache.write(first, content);
    expect(await cache.read(first)).toEqual(Buffer.from(content));
    const [path] = await cacheFiles(directory);
    const valid = await readFile(path!);

    const corrupted = Buffer.from(valid);
    corrupted[corrupted.length - 1]! ^= 1;
    await writeFile(path!, corrupted);
    expect(await cache.read(first)).toBeUndefined();
    await writeFile(path!, valid.subarray(0, valid.length - 1));
    expect(await cache.read(first)).toBeUndefined();
    await writeFile(path!, valid);

    const moved = join(directory, second.slice(0, 2), `${second}.bin`);
    await mkdir(join(directory, second.slice(0, 2)), { recursive: true });
    await rename(path!, moved);
    expect(await cache.read(second)).toBeUndefined();
    await truncate(moved, 65 * 1024 * 1024);
    expect(await cache.read(second)).toBeUndefined();
    expect(await cache.read("../outside")).toBeUndefined();
  });
});

test("concurrent cache writers publish complete entries and clean temporary files", async () => {
  await temporary(async (directory) => {
    const identity = key("shared");
    const content = new Uint8Array(32 * 1024).fill(37);
    const caches = Array.from({ length: 6 }, () => new RenditionCache(directory));
    await Promise.all(caches.map((cache) => cache.write(identity, content)));
    expect(await caches[0]!.read(identity)).toEqual(Buffer.from(content));
    expect(await cacheFiles(directory)).toHaveLength(1);
    expect((await readdir(directory, { recursive: true })).some((path) => path.includes(".tmp-"))).toBe(false);
  });
});

test("fresh Transcoding instances reuse exact bytes without re-encoding and keep subject identities separate", async () => {
  await temporary(async (cacheDirectory) => {
    const content = await image();
    const encoder = spyOn(sharp.prototype, "webp");
    try {
      const first = new TranscodingConcept({ cacheDirectory });
      const source = await first.ingest({ subject: "first", content });
      await first.generateRenditions({ original: source.original, widths: [12, 6], formats: ["webp"] });
      const expected = first._renditions({ original: source.original });
      expect(encoder).toHaveBeenCalledTimes(2);

      const second = new TranscodingConcept({ cacheDirectory });
      const other = await second.ingest({ subject: "second", content });
      expect(await second.generateRenditions({ original: other.original, widths: [6, 12, 6], formats: ["original", "webp", "webp"] }))
        .toMatchObject({ changed: true, count: 5, derived: 4 });
      const actual = second._renditions({ original: other.original });
      expect(encoder).toHaveBeenCalledTimes(2);
      expect(actual.map(({ rendition, ...facts }) => facts)).toEqual(expected.map(({ rendition, ...facts }) => facts));
      expect(actual[0]!.rendition).not.toBe(expected[0]!.rendition);
      expect(actual.at(-1)!.content).toEqual(Uint8Array.from(content));
      actual[0]!.content.fill(0);
      expect(second._renditions({ original: other.original })[0]!.content).toEqual(expected[0]!.content);
      expect(await second.generateRenditions({ original: other.original, widths: [6, 12], formats: ["webp"] }))
        .toMatchObject({ changed: false });

      // Width, format, and source changes cannot borrow a different rendition.
      await second.generateRenditions({ original: other.original, widths: [9], formats: ["webp", "jpeg"] });
      expect(encoder).toHaveBeenCalledTimes(3);
      expect(second._renditions({ original: other.original }).map(({ format }) => format)).toEqual(["webp", "jpeg", "png", "png"]);
      const replacement = await second.ingest({ subject: "second", content: await image(30) });
      await second.generateRenditions({ original: replacement.original, widths: [9], formats: ["webp"] });
      expect(encoder).toHaveBeenCalledTimes(4);
    } finally {
      encoder.mockRestore();
    }
  });
});

test("corrupt and checksum-valid but invalid image cache entries are regenerated", async () => {
  await temporary(async (cacheDirectory) => {
    const content = await image();
    const build = async () => {
      const transcoding = new TranscodingConcept({ cacheDirectory });
      const source = await transcoding.ingest({ subject: "source", content });
      await transcoding.generateRenditions({ original: source.original, widths: [12], formats: ["webp"] });
      return transcoding._renditions({ original: source.original });
    };
    const expected = await build();
    const files = await cacheFiles(cacheDirectory);
    const cache = new RenditionCache(cacheDirectory);
    const encoder = spyOn(sharp.prototype, "webp");
    try {
      for (const path of files) await writeFile(path, "truncated");
      expect(await build()).toEqual(expected);
      expect(encoder).toHaveBeenCalledTimes(1);

      // Valid checksums alone do not admit wrong-format/wrong-size or undecodable images.
      for (const bad of [await image(7), Buffer.from("not an image")]) {
        for (const path of files) await cache.write(basename(path, ".bin"), bad);
        expect(await build()).toEqual(expected);
      }
      expect(encoder).toHaveBeenCalledTimes(3);
    } finally {
      encoder.mockRestore();
    }
  });
});

test("disabled or unavailable caches do not affect output or source validation", async () => {
  await temporary(async (directory) => {
    const blocked = join(directory, "not-a-directory");
    await writeFile(blocked, "occupied");
    const content = await image();
    const build = async (cacheDirectory: string | null) => {
      const transcoding = new TranscodingConcept({ cacheDirectory });
      const source = await transcoding.ingest({ subject: "source", content });
      await transcoding.generateRenditions({ original: source.original, widths: [12], formats: ["webp"] });
      const jpeg = await sharp(content).jpeg().toBuffer();
      await expect(transcoding.ingest({ subject: "source", content: jpeg.subarray(0, -1) })).rejects.toThrow(UnreadableImage);
      return transcoding._renditions({ original: source.original });
    };
    expect(await build(blocked)).toEqual(await build(null));
    expect(await readFile(blocked, "utf8")).toBe("occupied");
  });
});
