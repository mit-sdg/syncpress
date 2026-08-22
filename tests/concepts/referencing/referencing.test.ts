import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { referencing as referencingRegistration } from "@concepts/referencing/registry.ts";
import {
  InvalidForm,
  InvalidText,
  OverlappingMarkup,
  ReferenceNotFound,
  ReferencingConcept,
  SourceFinished,
  UnrepresentableAddress,
} from "@concepts/referencing/referencing.ts";

test("discovers every supported HTML element and exposes structural roles and groups", () => {
  const referencing = new ReferencingConcept();
  const text = [
    '<a href="./about">About <em>us</em></a>',
    '<a href="./archive.zip" download>Archive</a>',
    '<area href="./map" alt="Map" download>',
    '<base href="/docs/">',
    '<link href="/site.css">',
    '<img src="./hero.png" srcset="./hero-small.png 1x, ./hero-large.png 2x" alt="Hero">',
    '<input TYPE="IMAGE" src="./go.png" alt="Go">',
    '<source src="./movie.mp4" srcset="./still-small.webp 480w, ./still-large.webp 960w">',
    '<audio src="./sound.mp3"></audio>',
    '<video src="./movie.mp4" poster="./poster.jpg"></video>',
    '<script src="./app.js"></script>',
    '<iframe src="./frame.html"></iframe>',
    '<embed src="./plugin.bin">',
    '<track src="./captions.vtt">',
    '<div href="ignored" src="ignored" srcset="ignored 1x" poster="ignored"></div>',
    '<input src="ignored">',
  ].join("\n");

  const scanned = referencing.scan({ subject: "page", part: "body", text });
  const references = referencing._references({ source: scanned.source });

  expect(scanned).toEqual({ source: scanned.source, count: 19, replaced: false, completed: false });
  expect(referencing._source({ source: scanned.source })).toEqual([{ subject: "page", part: "body" }]);
  expect(references.map(({ raw, kind, role, tag, attribute }) => ({ raw, kind, role, tag, attribute }))).toEqual([
    { raw: "./about", kind: "link", role: "hyperlink", tag: "a", attribute: "href" },
    { raw: "./archive.zip", kind: "download", role: "download", tag: "a", attribute: "href" },
    { raw: "./map", kind: "download", role: "download", tag: "area", attribute: "href" },
    { raw: "/docs/", kind: "link", role: "base", tag: "base", attribute: "href" },
    { raw: "/site.css", kind: "embed", role: "link-resource", tag: "link", attribute: "href" },
    { raw: "./hero.png", kind: "image", role: "image", tag: "img", attribute: "src" },
    { raw: "./hero-small.png", kind: "image", role: "image-candidate", tag: "img", attribute: "srcset" },
    { raw: "./hero-large.png", kind: "image", role: "image-candidate", tag: "img", attribute: "srcset" },
    { raw: "./go.png", kind: "image", role: "input-image", tag: "input", attribute: "src" },
    { raw: "./movie.mp4", kind: "embed", role: "media-source", tag: "source", attribute: "src" },
    { raw: "./still-small.webp", kind: "image", role: "source-candidate", tag: "source", attribute: "srcset" },
    { raw: "./still-large.webp", kind: "image", role: "source-candidate", tag: "source", attribute: "srcset" },
    { raw: "./sound.mp3", kind: "embed", role: "media", tag: "audio", attribute: "src" },
    { raw: "./movie.mp4", kind: "embed", role: "media", tag: "video", attribute: "src" },
    { raw: "./poster.jpg", kind: "embed", role: "poster", tag: "video", attribute: "poster" },
    { raw: "./app.js", kind: "embed", role: "script", tag: "script", attribute: "src" },
    { raw: "./frame.html", kind: "embed", role: "frame", tag: "iframe", attribute: "src" },
    { raw: "./plugin.bin", kind: "embed", role: "embedded-resource", tag: "embed", attribute: "src" },
    { raw: "./captions.vtt", kind: "embed", role: "track", tag: "track", attribute: "src" },
  ]);
  expect(references.map(({ label }) => label)).toEqual([
    "About us",
    "Archive",
    "Map",
    "",
    "",
    "Hero",
    "Hero",
    "Hero",
    "Go",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  expect(references[5]!.element).toBe(references[6]!.element);
  expect(references[6]!.element).toBe(references[7]!.element);
  expect(references[5]!.slot).not.toBe(references[6]!.slot);
  expect(references[6]!.slot).toBe(references[7]!.slot);
  expect(references.slice(6, 8).map(({ index }) => index)).toEqual([0, 1]);
  expect(references[9]!.element).toBe(references[10]!.element);
  expect(references[10]!.role).toBe("source-candidate");
  expect(referencing._reference({ reference: references[0]!.reference })[0]).toMatchObject({
    source: scanned.source,
    reference: references[0]!.reference,
    role: "hyperlink",
  });
});

test("exposes deterministic source-backed attributes only for primary image sources", () => {
  const referencing = new ReferencingConcept();
  const text = [
    '<img src="primary.png" TITLE="Primary &amp; image" sizes="100vw" CLASS="hero" crossorigin="anonymous" dir="rtl" fetchpriority="high" id="hero" lang="en" referrerpolicy="strict-origin" role="img" DATA-owner="Ada&#39;s" ARIA-label="Primary &amp; image" srcset="candidate.png 2x" width="640" height="400" alt="Primary" loading="eager" decoding="sync" style="display:block" onload="unsafe">',
    '<img srcset="set.png 2x" class="candidate">',
    '<input type="image" src="input.png" class="input">',
    '<source srcset="source.png 2x" class="source">',
    '<img src="filtered.png" class="kept" crossorigin="Anonymous" dir="sideways" fetchpriority="urgent" referrerpolicy="everything" data-="ignored" aria-1bad="ignored" width="1" alt="Filtered">',
    '<img src="bare.png" width="1" height="1" alt="Bare" loading="eager" decoding="sync">',
    '<img src="recovered.png" class="first" data-rank="first" class="ignored" data-rank="ignored" src="ignored.png">',
  ].join("");
  const scanned = referencing.scan({ subject: "page", part: "attributes", text });
  const references = referencing._references({ source: scanned.source });
  const primary = references.find(({ raw }) => raw === "primary.png")!;
  const filtered = references.find(({ raw }) => raw === "filtered.png")!;
  const bare = references.find(({ raw }) => raw === "bare.png")!;
  const recovered = references.find(({ raw }) => raw === "recovered.png")!;

  expect(Object.getPrototypeOf(primary.attributes!)).toBeNull();
  expect(Object.entries(primary.attributes!)).toEqual([
    ["alt", "Primary"],
    ["aria-label", "Primary & image"],
    ["class", "hero"],
    ["crossorigin", "anonymous"],
    ["data-owner", "Ada's"],
    ["decoding", "sync"],
    ["dir", "rtl"],
    ["fetchpriority", "high"],
    ["height", "400"],
    ["id", "hero"],
    ["lang", "en"],
    ["loading", "eager"],
    ["onload", "unsafe"],
    ["referrerpolicy", "strict-origin"],
    ["role", "img"],
    ["sizes", "100vw"],
    ["src", "primary.png"],
    ["srcset", "candidate.png 2x"],
    ["style", "display:block"],
    ["title", "Primary & image"],
    ["width", "640"],
  ]);
  expect(Object.entries(filtered.attributes!)).toEqual([
    ["alt", "Filtered"],
    ["aria-1bad", "ignored"],
    ["class", "kept"],
    ["crossorigin", "Anonymous"],
    ["data-", "ignored"],
    ["dir", "sideways"],
    ["fetchpriority", "urgent"],
    ["referrerpolicy", "everything"],
    ["src", "filtered.png"],
    ["width", "1"],
  ]);
  expect(Object.keys(bare.attributes!)).toEqual(["alt", "decoding", "height", "loading", "src", "width"]);
  expect(recovered.raw).toBe("recovered.png");
  expect(Object.entries(recovered.attributes!)).toEqual([
    ["class", "first"],
    ["data-rank", "first"],
    ["src", "recovered.png"],
  ]);
  for (const reference of references) expect(Object.hasOwn(reference, "attributes")).toBe(reference.role === "image");

  (primary.attributes as Record<string, string>).class = "changed";
  expect(referencing._reference({ reference: primary.reference })[0]!.attributes?.class).toBe("hero");
});

test("parses srcset URL tokens, entities, descriptors, and candidate source positions", () => {
  const referencing = new ReferencingConcept();
  const text = `<img
  srcset="one.png 1x,
          two&amp;.png 2x,
          images/a,b.png 3x,
          data:image/svg+xml,%3Csvg%3E 4x,
          bad.png nope,
          duplicate.png 1x 2x,
          zero.png 0w,
          padded.png 0320w,
          last.png 640w 320h"
  alt="Set">`;
  const scanned = referencing.scan({ subject: "page", part: "srcset", text });
  const references = referencing._references({ source: scanned.source });

  expect(references.map(({ raw, index, line, column }) => ({ raw, index, line, column }))).toEqual([
    { raw: "one.png", index: 0, line: 2, column: 11 },
    { raw: "two&.png", index: 1, line: 3, column: 11 },
    { raw: "images/a,b.png", index: 2, line: 4, column: 11 },
    { raw: "data:image/svg+xml,%3Csvg%3E", index: 3, line: 5, column: 11 },
    { raw: "padded.png", index: 4, line: 9, column: 11 },
    { raw: "last.png", index: 5, line: 10, column: 11 },
  ]);

  const encodedBreak = '<img srcset="one.png 1x,&#10;two.png 2x">';
  const second = referencing.scan({ subject: "page", part: "encoded-break", text: encodedBreak });
  const candidates = referencing._references({ source: second.source });
  expect(candidates.map(({ raw }) => raw)).toEqual(["one.png", "two.png"]);
  expect(candidates[1]).toMatchObject({ line: 1, column: encodedBreak.indexOf("two.png") + 1 });
});

test("serializes hostile address answers safely for quoted, unquoted, empty, valueless, and srcset attributes", () => {
  const referencing = new ReferencingConcept();
  const text = [
    "<a href='old&amp;x'>one</a>",
    '<img src=old alt="x">',
    "<script src></script>",
    "<a href = ></a>",
    "<img srcset='a.png 1x, b.png 2x'>",
  ].join("");
  const scanned = referencing.scan({ subject: "page", part: "safe", text });
  const references = referencing._references({ source: scanned.source });
  const values = ["old&x", `q\" '&<>`, `/app.js?x=\"&`, "/empty path?x='", `a\"&.png`, "b'<.png"];

  const outcomes = references.map((reference, index) =>
    referencing.resolve({ reference: reference.reference, form: "address", value: values[index]! }),
  );
  expect(outcomes.slice(0, -1).every(({ completed }) => !completed)).toBe(true);
  expect(outcomes.at(-1)).toMatchObject({ changed: true, completed: true });
  expect(referencing._finished({ subject: "page", part: "safe" })).toEqual([
    {
      source: scanned.source,
      text:
        '<a href="old&amp;x">one</a><img src="q&quot; &#39;&amp;&lt;&gt;" alt="x"><script src="/app.js?x=&quot;&amp;"></script><a href="/empty path?x=&#39;"></a><img srcset="a&quot;&amp;.png 1x, b&#39;&lt;.png 2x">',
    },
  ]);
});

test("refuses overlapping markup and trusts one non-overlapping whole-element replacement", () => {
  const referencing = new ReferencingConcept();
  const scanned = referencing.scan({
    subject: "page",
    part: "markup",
    text: '<a href="/outer"><img src="one.png" srcset="two.png 2x"></a><img src="three.png">',
  });
  const [outer, primary, candidate, separate] = referencing._references({ source: scanned.source });
  const innerMarkup = `<picture data-safe="'&"><img></picture>`;

  referencing.resolve({ reference: primary!.reference, form: "markup", value: innerMarkup });
  expect(() => referencing.resolve({ reference: candidate!.reference, form: "markup", value: "<other></other>" })).toThrow(OverlappingMarkup);
  expect(() => referencing.resolve({ reference: outer!.reference, form: "markup", value: "<outer></outer>" })).toThrow(OverlappingMarkup);
  expect(referencing._unanswered({ source: scanned.source }).map(({ reference }) => reference)).toContain(candidate!.reference);

  referencing.resolve({ reference: outer!.reference, form: "address", value: "/outer" });
  referencing.resolve({ reference: candidate!.reference, form: "address", value: "/two.png" });
  const completed = referencing.resolve({
    reference: separate!.reference,
    form: "markup",
    value: `<trusted data-x="'&"></trusted>`,
  });

  expect(completed.completed).toBe(true);
  expect(referencing._finished({ subject: "page", part: "markup" })[0]!.text).toBe(
    `<a href="/outer">${innerMarkup}</a><trusted data-x="'&"></trusted>`,
  );
});

test("makes completion terminal while keeping identical repeated answers idempotent", () => {
  const referencing = new ReferencingConcept();
  const empty = referencing.scan({ subject: "page", part: "empty", text: "<p>Nothing outward.</p>" });
  expect(empty).toEqual({ source: empty.source, count: 0, replaced: false, completed: true });
  expect(referencing._finished({ subject: "page", part: "empty" })).toEqual([
    { source: empty.source, text: "<p>Nothing outward.</p>" },
  ]);

  const scanned = referencing.scan({ subject: "page", part: "answers", text: '<a href="one">One</a><a href="two">Two</a>' });
  const [first, second] = referencing._references({ source: scanned.source });
  expect(scanned.completed).toBe(false);
  expect(referencing.resolve({ reference: first!.reference, form: "address", value: "/one" })).toMatchObject({
    changed: true,
    completed: false,
  });
  expect(referencing.resolve({ reference: first!.reference, form: "address", value: "/one" })).toMatchObject({
    changed: false,
    completed: false,
  });
  expect(referencing.resolve({ reference: second!.reference, form: "address", value: "/two" })).toMatchObject({
    changed: true,
    completed: true,
  });
  expect(referencing.resolve({ reference: first!.reference, form: "address", value: "/one" })).toMatchObject({
    changed: false,
    completed: false,
  });
  expect(() => referencing.resolve({ reference: first!.reference, form: "address", value: "/one-corrected" })).toThrow(SourceFinished);
  expect(() => referencing.resolve({ reference: first!.reference, form: "markup", value: "/one" })).toThrow(SourceFinished);
  expect(referencing._finished({ subject: "page", part: "answers" })[0]!.text).toBe(
    '<a href="/one">One</a><a href="/two">Two</a>',
  );
  expect(referencing._unanswered({ source: scanned.source })).toEqual([]);
});

test("rescans and drops atomically while keeping punctuation-heavy subjects and parts independent", () => {
  const referencing = new ReferencingConcept();
  const first = referencing.scan({ subject: "a:b", part: "c", text: '<a href="one">One</a>' });
  const second = referencing.scan({ subject: "a", part: "b:c", text: '<a href="two">Two</a>' });
  const oldReference = referencing._references({ source: first.source })[0]!.reference;

  expect(first.source).not.toBe(second.source);
  expect(referencing._source({ source: first.source })).toEqual([{ subject: "a:b", part: "c" }]);
  expect(referencing._source({ source: second.source })).toEqual([{ subject: "a", part: "b:c" }]);

  const replacement = referencing.scan({ subject: "a:b", part: "c", text: '<img src="new.png">' });
  const replacementReference = referencing._references({ source: replacement.source })[0]!.reference;
  expect(replacement).toMatchObject({ source: first.source, count: 1, replaced: true, completed: false });
  expect(replacementReference).not.toBe(oldReference);
  expect(() => referencing.resolve({ reference: oldReference, form: "address", value: "/old" })).toThrow(ReferenceNotFound);

  expect(referencing.drop({ subject: "a:b", part: "c" })).toEqual({ source: first.source, count: 1, dropped: true });
  expect(referencing._source({ source: first.source })).toEqual([]);
  expect(() => referencing.resolve({ reference: replacementReference, form: "address", value: "/new" })).toThrow(ReferenceNotFound);
  expect(referencing.drop({ subject: "a:b", part: "c" })).toEqual({ source: first.source, count: 0, dropped: false });

  const restored = referencing.scan({ subject: "a:b", part: "c", text: '<img src="new.png">' });
  expect(restored.source).toBe(first.source);
  expect(referencing._references({ source: restored.source })[0]!.reference).not.toBe(replacementReference);
  expect(referencing._references({ source: second.source })).toHaveLength(1);
});

test("uses HTML recovery without inventing references and rewrites source-backed malformed attributes", () => {
  const referencing = new ReferencingConcept();
  const text = "<div><a href=/one>One<img src='two.png' src=ignored><p><video poster=poster.jpg>";
  const scanned = referencing.scan({ subject: "page", part: "malformed", text });
  const references = referencing._references({ source: scanned.source });

  expect(references.map(({ raw, role }) => ({ raw, role }))).toEqual([
    { raw: "/one", role: "hyperlink" },
    { raw: "two.png", role: "image" },
    { raw: "poster.jpg", role: "poster" },
  ]);
  referencing.resolve({ reference: references[0]!.reference, form: "address", value: "/ONE" });
  referencing.resolve({ reference: references[1]!.reference, form: "address", value: "/two" });
  referencing.resolve({ reference: references[2]!.reference, form: "address", value: "/poster" });
  expect(referencing._finished({ subject: "page", part: "malformed" })[0]!.text).toBe(
    '<div><a href="/ONE">One<img src="/two" src=ignored><p><video poster="/poster">',
  );

  const template = referencing.scan({ subject: "page", part: "template", text: '<template><a href="inside">Inside</a></template>' });
  expect(referencing._references({ source: template.source })).toHaveLength(1);
});

test("validates action inputs and leaves queries total for invalid lookup values", () => {
  const referencing = new ReferencingConcept();
  expect(() => referencing.scan({ subject: 1 as unknown as string, part: "body", text: "" })).toThrow(InvalidText);
  expect(() => referencing.scan({ subject: "page", part: "body", text: "\uD800" })).toThrow(InvalidText);
  expect(() => referencing.drop({ subject: "page", part: null as unknown as string })).toThrow(InvalidText);
  expect(() => referencing.resolve({ reference: "missing", form: "other" as never, value: "x" })).toThrow(InvalidForm);
  expect(() => referencing.resolve({ reference: "missing", form: "address", value: 1 as unknown as string })).toThrow(InvalidText);
  expect(() => referencing.resolve({ reference: "missing", form: "address", value: "x" })).toThrow(ReferenceNotFound);

  const scalar = referencing.scan({ subject: "page", part: "scalar", text: '<a href="old">Old</a>' });
  const scalarReference = referencing._references({ source: scalar.source })[0]!;
  expect(() => referencing.resolve({ reference: scalarReference.reference, form: "address", value: "bad\0address" })).toThrow(
    UnrepresentableAddress,
  );
  const set = referencing.scan({ subject: "page", part: "set", text: '<img srcset="old.png 1x">' });
  const candidate = referencing._references({ source: set.source })[0]!;
  for (const value of ["", ",leading.png", "trailing.png,", "one.png 1x, injected.png"]) {
    expect(() => referencing.resolve({ reference: candidate.reference, form: "address", value })).toThrow(UnrepresentableAddress);
  }
  expect(referencing._unanswered({ source: scalar.source })).toHaveLength(1);
  expect(referencing._unanswered({ source: set.source })).toHaveLength(1);

  expect(referencing._source({ source: 1 as unknown as string })).toEqual([]);
  expect(referencing._reference({ reference: null as unknown as string })).toEqual([]);
  expect(referencing._references({ source: "\uD800" })).toEqual([]);
  expect(referencing._unanswered({ source: 1 as unknown as string })).toEqual([]);
  expect(referencing._finished({ subject: "page", part: 1 as unknown as string })).toEqual([]);
});

test("registry exposes every declared refusal with its normative message", async () => {
  expect(referencingRegistration.refusals).toEqual({
    INVALID_TEXT: InvalidText,
    INVALID_FORM: InvalidForm,
    REFERENCE_NOT_FOUND: ReferenceNotFound,
    SOURCE_FINISHED: SourceFinished,
    UNREPRESENTABLE_ADDRESS: UnrepresentableAddress,
    OVERLAPPING_MARKUP: OverlappingMarkup,
  });
  expect(
    referencingRegistration.specification.actions.flatMap(({ refusals }) =>
      refusals.map(({ code, message }) => [code, message]),
    ),
  ).toEqual([
    ["INVALID_TEXT", "Subjects, parts, identities, HTML, and answers must be well-formed text."],
    ["INVALID_TEXT", "Subjects, parts, identities, HTML, and answers must be well-formed text."],
    ["INVALID_FORM", "Answer form must be address or markup."],
    ["REFERENCE_NOT_FOUND", "There is no such reference."],
    ["SOURCE_FINISHED", "A finished source cannot accept a changed answer."],
    ["UNREPRESENTABLE_ADDRESS", "This address cannot be represented as one HTML reference."],
    ["OVERLAPPING_MARKUP", "A markup answer overlaps another markup answer."],
    ["INVALID_TEXT", "Subjects, parts, identities, HTML, and answers must be well-formed text."],
  ]);

  const set = conceptSet({ Referencing: referencingRegistration });
  const app = assemble({ conceptSet: set, instances: set.implementations(), composition: {} });
  expect(await app.concepts.Referencing.scan({ subject: 1 as unknown as string, part: "body", text: "" })).toEqual({
    error: "INVALID_TEXT",
    detail: "Subjects, parts, identities, HTML, and answers must be well-formed text.",
  });
  expect(await app.concepts.Referencing.resolve({ reference: "missing", form: "bad" as never, value: "x" })).toEqual({
    error: "INVALID_FORM",
    detail: "Answer form must be address or markup.",
  });
  expect(await app.concepts.Referencing.resolve({ reference: "missing", form: "address", value: "x" })).toEqual({
    error: "REFERENCE_NOT_FOUND",
    detail: "There is no such reference.",
  });
  await app.whenIdle();
});
