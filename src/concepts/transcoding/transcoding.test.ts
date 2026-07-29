import { expect, test } from "bun:test";
import sharp from "sharp";
import { OriginalNotFound, TranscodingConcept, UnreadableImage } from "./transcoding.ts";

async function png(width: number, height: number): Promise<Uint8Array> {
  return new Uint8Array(await sharp({ create: { width, height, channels: 3, background: { r: 38, g: 90, b: 147 } } }).png().toBuffer());
}

function animatedGif(): Uint8Array {
  return new Uint8Array([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 240, 0, 0, 255, 0, 0, 0, 255, 0, 33, 255, 11,
    ...new TextEncoder().encode("NETSCAPE2.0"), 3, 1, 0, 0, 0,
    33, 249, 4, 0, 10, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 68, 1, 0,
    33, 249, 4, 0, 10, 0, 0, 0, 44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 76, 1, 0, 59,
  ]);
}

test("its principle: images have stable, non-upscaled renditions", async () => {
  const transcoding = new TranscodingConcept();
  const content = await png(960, 640);
  const admitted = await transcoding.admit({ subject: "pipeline", content });

  expect(admitted).toMatchObject({ format: "png", width: 960, height: 640, animated: false, changed: true });
  expect(await transcoding.admit({ subject: "pipeline", content })).toMatchObject({ original: admitted.original, changed: false });
  await expect(transcoding.admit({ subject: "bad", content: new TextEncoder().encode("not an image") })).rejects.toThrow(UnreadableImage);
  await expect(transcoding.render({ original: "missing", widths: [], formats: [] })).rejects.toThrow(OriginalNotFound);

  const rendered = await transcoding.render({ original: admitted.original, widths: [480, 960, 1440], formats: ["avif", "original"] });
  const renditions = transcoding._renditions({ original: admitted.original });
  expect(rendered).toEqual({ original: admitted.original, count: 4, changed: true });
  expect(renditions.map(({ width, format, order }) => ({ width, format, order }))).toEqual([
    { width: 480, format: "avif", order: 0 },
    { width: 960, format: "avif", order: 1 },
    { width: 480, format: "png", order: 2 },
    { width: 960, format: "png", order: 3 },
  ]);
  expect((await sharp(renditions[0]!.content).metadata()).width).toBe(480);
  expect(renditions.every(({ name, width, format }) => name.endsWith(`-${width}.${format}`))).toBe(true);
  expect(await transcoding.render({ original: admitted.original, widths: [480, 960, 1440], formats: ["avif", "original"] })).toEqual({ original: admitted.original, count: 4, changed: false });

  const equivalent = new TranscodingConcept();
  const copied = await equivalent.admit({ subject: "another-pipeline", content });
  await equivalent.render({ original: copied.original, widths: [480, 960, 1440], formats: ["avif", "original"] });
  expect(equivalent._renditions({ original: copied.original }).map(({ name }) => name)).toEqual(renditions.map(({ name }) => name));

  const animated = await transcoding.admit({ subject: "animated", content: animatedGif() });
  expect(animated.animated).toBe(true);
  await transcoding.render({ original: animated.original, widths: [1], formats: ["avif", "original"] });
  const preserved = transcoding._renditions({ original: animated.original });
  expect(preserved.map(({ format }) => format)).toEqual(["gif"]);
  expect((await sharp(preserved[0]!.content, { animated: true }).metadata()).pages).toBe(2);
});
