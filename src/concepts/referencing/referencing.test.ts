import { expect, test } from "bun:test";
import { ReferenceNotFound, ReferencingConcept } from "./referencing.ts";

test("its principle: references finish only after their target or element is answered", () => {
  const referencing = new ReferencingConcept();
  const scanned = referencing.scan({
    subject: "page",
    part: "body",
    text: '<p><a href="./about/">About</a><img src="./pipeline.png" alt="Pipeline"><a href="./example.zip">Download</a></p>',
  });
  const references = referencing._references({ source: scanned.source });

  expect(scanned.count).toBe(3);
  expect(referencing._source({ source: scanned.source })).toEqual({ subject: "page", part: "body" });
  expect(references.map(({ raw, kind, label }) => ({ raw, kind, label }))).toEqual([
    { raw: "./about/", kind: "link", label: "About" },
    { raw: "./pipeline.png", kind: "image", label: "Pipeline" },
    { raw: "./example.zip", kind: "link", label: "Download" },
  ]);
  expect(referencing._reference({ reference: references[0]!.reference })).toMatchObject({ source: scanned.source, raw: "./about/", line: 1, column: 7 });
  expect(referencing._unanswered({ source: scanned.source })).toHaveLength(3);
  expect(referencing._finished({ subject: "page", part: "body" })).toEqual([]);

  referencing.answer({ reference: references[0]!.reference, form: "address", value: "/about/" });
  referencing.answer({ reference: references[1]!.reference, form: "markup", value: '<picture><img src="/assets/pipeline.webp" alt="Pipeline"></picture>' });
  referencing.answer({ reference: references[2]!.reference, form: "address", value: "/example.zip" });
  expect(referencing._finished({ subject: "page", part: "body" })).toEqual([
    { source: scanned.source, text: '<p><a href="/about/">About</a><picture><img src="/assets/pipeline.webp" alt="Pipeline"></picture><a href="/example.zip">Download</a></p>' },
  ]);

  referencing.answer({ reference: references[0]!.reference, form: "address", value: "/about-us/" });
  expect(referencing._finished({ subject: "page", part: "body" })[0]!.text).toContain('href="/about-us/"');

  const replacement = referencing.scan({ subject: "page", part: "body", text: "<p>No references.</p>" });
  expect(replacement.count).toBe(0);
  expect(referencing._finished({ subject: "page", part: "body" })).toEqual([{ source: replacement.source, text: "<p>No references.</p>" }]);
  expect(() => referencing.answer({ reference: references[0]!.reference, form: "address", value: "/about/" })).toThrow(ReferenceNotFound);
  expect(referencing.drop({ subject: "page", part: "body" })).toEqual({ source: replacement.source });
  expect(referencing._finished({ subject: "page", part: "body" })).toEqual([]);
});

test("it scans source-located href, src, srcset, and poster targets", () => {
  const referencing = new ReferencingConcept();
  const text = `<picture>
  <source srcset="./small.png 480w, ./large.png 960w">
  <img src="./pipeline.png" alt="Pipeline">
</picture>
<video poster="./poster.jpg"></video>
<a href="./download.zip" download>Download</a>
<script src="/app.js"></script>`;
  const scanned = referencing.scan({ subject: "page", part: "layout", text });
  const references = referencing._references({ source: scanned.source });

  expect(references.map(({ raw, kind, label }) => ({ raw, kind, label }))).toEqual([
    { raw: "./small.png", kind: "image", label: "" },
    { raw: "./large.png", kind: "image", label: "" },
    { raw: "./pipeline.png", kind: "image", label: "Pipeline" },
    { raw: "./poster.jpg", kind: "embed", label: "" },
    { raw: "./download.zip", kind: "download", label: "Download" },
    { raw: "/app.js", kind: "embed", label: "" },
  ]);
  expect(references[0]).toMatchObject({ line: 2, column: 11 });

  for (const reference of references) {
    const value = reference.raw.startsWith("./") ? `/${reference.raw.slice(2)}` : reference.raw;
    referencing.answer({ reference: reference.reference, form: "address", value });
  }
  expect(referencing._finished({ subject: "page", part: "layout" })[0]!.text).toContain('srcset="/small.png 480w, /large.png 960w"');
  expect(referencing._finished({ subject: "page", part: "layout" })[0]!.text).toContain('poster="/poster.jpg"');
});
