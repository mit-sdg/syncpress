import { expect, test } from "bun:test";
import {
  EmbeddingComplete,
  EmbeddingConcept,
  EmbeddingNotFound,
  InvalidAddress,
  InvalidAttributes,
  InvalidCount,
  InvalidDimension,
  InvalidFormat,
  InvalidOrder,
  InvalidText,
  InvalidWidth,
  MEDIA_TYPE_BY_FORMAT,
  OfferConflict,
} from "@concepts/embedding/embedding.ts";
import { embedding as registeredEmbedding } from "@concepts/embedding/registry.ts";

type Declaration = Parameters<EmbeddingConcept["declare"]>[0];
type Candidate = Parameters<EmbeddingConcept["provideCandidate"]>[0];

const baseDeclaration: Declaration = {
  subject: "reference",
  alternative: "Compiler pipeline",
  width: 1440,
  height: 900,
  expects: 0,
  original: "/assets/pipeline.png",
  originalFormat: "png",
  attributes: {},
};

function declare(concept: EmbeddingConcept, overrides: Partial<Declaration> = {}) {
  return concept.declare({ ...baseDeclaration, ...overrides });
}

function provideCandidate(concept: EmbeddingConcept, embedding: string, overrides: Partial<Candidate> = {}) {
  return concept.provideCandidate({ embedding, address: "/assets/pipeline-480.avif", format: "avif", width: 480, order: 0, ...overrides });
}

test("zero derived offers complete on declaration with a usable original fallback", () => {
  const concept = new EmbeddingConcept();
  const declaration = declare(concept, {
    subject: "tiny",
    alternative: "Tiny original",
    width: 32,
    height: 16,
    original: "/assets/tiny.png?raw=1&kind=original",
  });

  expect(declaration).toEqual({ embedding: 'embedding:"tiny"', changed: true, completed: true });
  expect(concept._embedding({ embedding: declaration.embedding })).toEqual([{
    subject: "tiny",
    original: "/assets/tiny.png?raw=1&kind=original",
    originalFormat: "png",
    expects: 0,
    arrived: 0,
    complete: true,
  }]);
  expect(concept._for({ subject: "tiny" })).toEqual([{
    embedding: declaration.embedding,
    original: "/assets/tiny.png?raw=1&kind=original",
    originalFormat: "png",
    expects: 0,
    arrived: 0,
    complete: true,
  }]);
  expect(concept._offers({ embedding: declaration.embedding })).toEqual([]);
  expect(concept._markup({ embedding: declaration.embedding })).toEqual([{
    markup: '<picture><img src="/assets/tiny.png?raw=1&amp;kind=original" width="32" height="16" alt="Tiny original" loading="lazy" decoding="async"></picture>',
  }]);

  expect(declare(concept, {
    subject: "tiny",
    alternative: "Tiny original",
    width: 32,
    height: 16,
    original: "/assets/tiny.png?raw=1&kind=original",
  })).toEqual({ embedding: declaration.embedding, changed: false, completed: false });
  expect(() => provideCandidate(concept, declaration.embedding, { width: 16 })).toThrow(EmbeddingComplete);
});

test("out-of-order offers complete once and produce exact escaped responsive markup", () => {
  const concept = new EmbeddingConcept();
  const attributes = {
    title: 'A "diagram"',
    sizes: "(max-width: 600px) 100vw, 50vw",
    class: "hero & wide",
    "data-caption": "<caption>",
  };
  const declaration = declare(concept, {
    alternative: 'Compiler "pipeline" & <stages> \'quoted\'',
    expects: 5,
    original: "/assets/pipeline.png?raw=1&mode=full",
    attributes,
  });
  attributes.title = "changed after declaration";

  const offered = [
    provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline-960.png", format: "png", width: 960, order: 5 }),
    provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline-960.webp", format: "webp", width: 960, order: 3 }),
    provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline-960.avif", format: "avif", width: 960, order: 1 }),
    provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline-480.webp", format: "webp", width: 480, order: 2 }),
  ];
  expect(offered.every(({ changed, completed }) => changed && !completed)).toBe(true);
  expect(concept._markup({ embedding: declaration.embedding })).toEqual([]);

  const completed = provideCandidate(concept, declaration.embedding, {
    address: "/assets/pipeline-480.avif?quality=80&fast=1",
    format: "avif",
    width: 480,
    order: 0,
  });
  expect(completed).toMatchObject({ embedding: declaration.embedding, arrived: 5, changed: true, completed: true });
  expect(concept._offers({ embedding: declaration.embedding }).map(({ address, format, width, order }) => ({ address, format, width, order }))).toEqual([
    { address: "/assets/pipeline-480.avif?quality=80&fast=1", format: "avif", width: 480, order: 0 },
    { address: "/assets/pipeline-960.avif", format: "avif", width: 960, order: 1 },
    { address: "/assets/pipeline-480.webp", format: "webp", width: 480, order: 2 },
    { address: "/assets/pipeline-960.webp", format: "webp", width: 960, order: 3 },
    { address: "/assets/pipeline-960.png", format: "png", width: 960, order: 5 },
  ]);

  const markup = '<picture><source type="image/avif" srcset="/assets/pipeline-480.avif?quality=80&amp;fast=1 480w, /assets/pipeline-960.avif 960w" sizes="(max-width: 600px) 100vw, 50vw"><source type="image/webp" srcset="/assets/pipeline-480.webp 480w, /assets/pipeline-960.webp 960w" sizes="(max-width: 600px) 100vw, 50vw"><img src="/assets/pipeline.png?raw=1&amp;mode=full" srcset="/assets/pipeline-960.png 960w, /assets/pipeline.png?raw=1&amp;mode=full 1440w" width="1440" height="900" alt="Compiler &quot;pipeline&quot; &amp; &lt;stages&gt; &#39;quoted&#39;" loading="lazy" decoding="async" class="hero &amp; wide" data-caption="&lt;caption&gt;" sizes="(max-width: 600px) 100vw, 50vw" title="A &quot;diagram&quot;"></picture>';
  expect(concept._markup({ embedding: declaration.embedding })).toEqual([{ markup }]);
});

test("format-order ties and arrival order are deterministic while the declared format remains fallback", () => {
  const candidates: Omit<Candidate, "embedding">[] = [
    { address: "/assets/wide-800.webp", format: "webp", width: 800, order: 0 },
    { address: "/assets/wide-800.avif", format: "avif", width: 800, order: 0 },
    { address: "/assets/wide-400.webp", format: "webp", width: 400, order: 0 },
    { address: "/assets/wide-400.avif", format: "avif", width: 400, order: 0 },
    { address: "/assets/wide-400.jpeg", format: "jpeg", width: 400, order: 0 },
  ];
  const render = (arrival: number[]) => {
    const concept = new EmbeddingConcept();
    const declaration = declare(concept, {
      subject: `arrival-${arrival.join("")}`,
      width: 1000,
      height: 500,
      expects: candidates.length,
      original: "/assets/wide.jpeg",
      originalFormat: "jpeg",
    });
    for (const index of arrival) concept.provideCandidate({ embedding: declaration.embedding, ...candidates[index]! });
    return concept._markup({ embedding: declaration.embedding })[0]!.markup.replaceAll(`arrival-${arrival.join("")}`, "arrival");
  };

  const forward = render([0, 1, 2, 3, 4]);
  const reverse = render([4, 3, 2, 1, 0]);
  expect(reverse).toBe(forward);
  expect(forward).toBe('<picture><source type="image/avif" srcset="/assets/wide-400.avif 400w, /assets/wide-800.avif 800w"><source type="image/webp" srcset="/assets/wide-400.webp 400w, /assets/wide-800.webp 800w"><img src="/assets/wide.jpeg" srcset="/assets/wide-400.jpeg 400w, /assets/wide.jpeg 1000w" width="1000" height="500" alt="Compiler pipeline" loading="lazy" decoding="async"></picture>');
});

test("identical, corrected, conflicting, final, and excess offers have exact transition behavior", () => {
  const concept = new EmbeddingConcept();
  const declaration = declare(concept, { expects: 2 });
  const first = provideCandidate(concept, declaration.embedding);
  expect(first).toMatchObject({ arrived: 1, changed: true, completed: false });

  expect(provideCandidate(concept, declaration.embedding)).toEqual({ ...first, changed: false, completed: false });
  const corrected = provideCandidate(concept, declaration.embedding, { order: 7 });
  expect(corrected).toEqual({ ...first, changed: true, completed: false });
  expect(corrected.offer).toBe(first.offer);
  expect(() => provideCandidate(concept, declaration.embedding, { address: "/assets/other-480.avif", order: 8 })).toThrow(OfferConflict);
  expect(() => provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline.png", format: "webp", width: 600, order: 8 })).toThrow(OfferConflict);
  expect(() => provideCandidate(concept, declaration.embedding, { address: "/assets/other.png", format: "png", width: 1440, order: 8 })).toThrow(OfferConflict);
  expect(concept._embedding({ embedding: declaration.embedding })[0]).toMatchObject({ arrived: 1, complete: false });

  const final = provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline-960.png", format: "png", width: 960, order: 8 });
  expect(final).toMatchObject({ arrived: 2, changed: true, completed: true });
  const completedMarkup = concept._markup({ embedding: declaration.embedding });
  expect(provideCandidate(concept, declaration.embedding, { address: "/assets/pipeline-960.png", format: "png", width: 960, order: 8 })).toEqual({
    ...final,
    changed: false,
    completed: false,
  });
  expect(() => provideCandidate(concept, declaration.embedding, { order: 9 })).toThrow(EmbeddingComplete);
  expect(() => provideCandidate(concept, declaration.embedding, { address: "/assets/excess.webp", format: "webp", width: 960, order: 9 })).toThrow(EmbeddingComplete);
  expect(concept._markup({ embedding: declaration.embedding })).toEqual(completedMarkup);
  expect(concept._embedding({ embedding: declaration.embedding })[0]).toMatchObject({ arrived: 2, complete: true });
});

test("redeclaration, withdrawal, and recreation have stable identities and exact lifecycle", () => {
  const concept = new EmbeddingConcept();
  const declaration = declare(concept, { subject: "a:b", expects: 1 });
  const offered = provideCandidate(concept, declaration.embedding);
  expect(declaration.embedding).toBe('embedding:"a:b"');
  expect(offered.offer).toBe(`offer:${JSON.stringify([declaration.embedding, "/assets/pipeline-480.avif"])}`);

  expect(declare(concept, { subject: "a:b", expects: 1 })).toEqual({ embedding: declaration.embedding, changed: false, completed: false });
  expect(concept._offers({ embedding: declaration.embedding })).toHaveLength(1);
  expect(declare(concept, { subject: "a:b", expects: 1, alternative: "Changed" })).toEqual({
    embedding: declaration.embedding,
    changed: true,
    completed: false,
  });
  expect(concept._offers({ embedding: declaration.embedding })).toEqual([]);
  expect(concept._markup({ embedding: declaration.embedding })).toEqual([]);
  const replacement = provideCandidate(concept, declaration.embedding);
  expect(replacement.offer).toBe(offered.offer);
  expect(replacement.completed).toBe(true);

  expect(concept.withdraw({ subject: "a:b" })).toEqual({ embedding: declaration.embedding, count: 1 });
  expect(concept._embedding({ embedding: declaration.embedding })).toEqual([]);
  expect(concept._for({ subject: "a:b" })).toEqual([]);
  expect(concept._offers({ embedding: declaration.embedding })).toEqual([]);
  expect(concept._markup({ embedding: declaration.embedding })).toEqual([]);
  expect(() => provideCandidate(concept, declaration.embedding)).toThrow(EmbeddingNotFound);
  expect(() => concept.withdraw({ subject: 1 })).toThrow(InvalidText);
  expect(() => concept.withdraw({ subject: "a:b" })).toThrow(EmbeddingNotFound);

  const recreated = declare(concept, { subject: "a:b", alternative: "Changed" });
  expect(recreated).toEqual({ embedding: declaration.embedding, changed: true, completed: true });
});

test("declarations validate every field before changing state", () => {
  const malformed = "\ud800";
  for (const [field, values, ErrorType] of [
    ["subject", [1, malformed], InvalidText],
    ["alternative", [1, malformed, "null\u0000text"], InvalidText],
    ["width", [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"], InvalidDimension],
    ["height", [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1"], InvalidDimension],
    ["expects", [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0"], InvalidCount],
  ] as const) {
    for (const value of values) expect(() => declare(new EmbeddingConcept(), { [field]: value })).toThrow(ErrorType);
  }

  for (const original of ["", "relative.png", "//host/image.png", "/white space.png", "/comma,image.png", "/line\nbreak.png", "/control\u0085.png", "/back\\slash.png", '/quote".png', "/angle<.png", "/bad%escape.png", "/bad%2G.png", malformed]) {
    expect(() => declare(new EmbeddingConcept(), { original })).toThrow(InvalidAddress);
  }
  for (const originalFormat of ["jpg", "PNG", "svg", 'png\" onerror=\"alert(1)', 1, malformed]) {
    expect(() => declare(new EmbeddingConcept(), { originalFormat })).toThrow(InvalidFormat);
  }

  const accessor = Object.defineProperty({}, "title", { enumerable: true, get: () => "unsafe" });
  const hidden = Object.defineProperty({}, "title", { enumerable: false, value: "hidden" });
  const symbol = { [Symbol("title")]: "unsafe" };
  const invalidAttributes = [
    null,
    [],
    new Date(),
    new Proxy({ title: "unsafe" }, {}),
    accessor,
    hidden,
    symbol,
    { title: 1 },
    { title: malformed },
    { title: "null\u0000text" },
  ];
  for (const attributes of invalidAttributes) expect(() => declare(new EmbeddingConcept(), { attributes })).toThrow(InvalidAttributes);

  for (const attributes of [
    { Title: "uppercase" },
    { onload: "alert(1)" },
    { style: "background:url(unsafe)" },
    { src: "/override.png" },
    { loading: "eager" },
    { crossorigin: "unsafe" },
    { dir: "sideways" },
    { fetchpriority: "urgent" },
    { referrerpolicy: "everything" },
  ]) {
    const filtered = new EmbeddingConcept();
    const declaration = declare(filtered, { attributes });
    expect(filtered._markup({ embedding: declaration.embedding })[0]!.markup).not.toContain(Object.values(attributes)[0]!);
  }

  const concept = new EmbeddingConcept();
  const original = declare(concept, { subject: "kept" });
  expect(() => declare(concept, { subject: "kept", original: "unsafe" })).toThrow(InvalidAddress);
  expect(concept._embedding({ embedding: original.embedding })[0]).toMatchObject({ original: "/assets/pipeline.png", complete: true });
});

test("offers validate identity, address, format, width, and order without changing state", () => {
  const concept = new EmbeddingConcept();
  const declaration = declare(concept, { expects: 1 });
  expect(() => concept.provideCandidate({ embedding: 1, address: "/x.png", format: "png", width: 1, order: 0 })).toThrow(InvalidText);
  expect(() => concept.provideCandidate({ embedding: "missing", address: "unsafe", format: "svg", width: 0, order: -1 })).toThrow(EmbeddingNotFound);

  for (const address of ["relative.png", "//host/x.png", "/x y.png", "/x,y.png", '/x\" onerror=\"alert(1)']) {
    expect(() => provideCandidate(concept, declaration.embedding, { address })).toThrow(InvalidAddress);
  }
  for (const format of ["jpg", "SVG", 'x\" onerror=\"alert(1)', 1]) {
    expect(() => provideCandidate(concept, declaration.embedding, { format })).toThrow(InvalidFormat);
  }
  for (const width of [0, -1, 1.5, 1441, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "480"]) {
    expect(() => provideCandidate(concept, declaration.embedding, { width })).toThrow(InvalidWidth);
  }
  for (const order of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0"]) {
    expect(() => provideCandidate(concept, declaration.embedding, { order })).toThrow(InvalidOrder);
  }
  expect(concept._offers({ embedding: declaration.embedding })).toEqual([]);
  expect(concept._embedding({ embedding: declaration.embedding })[0]).toMatchObject({ arrived: 0, complete: false });

  expect(provideCandidate(concept, declaration.embedding, { order: -0 })).toMatchObject({ arrived: 1, changed: true, completed: true });
  expect(concept._offers({ embedding: declaration.embedding })[0]!.order).toBe(0);
});

test("approved authored attributes are canonical, cloned, escaped, and source-owned attributes are replaced", () => {
  const attributes = Object.assign(Object.create(null) as Record<string, string>, {
    role: "img",
    lang: "en",
    id: "pipeline",
    dir: "ltr",
    crossorigin: "anonymous",
    fetchpriority: "high",
    referrerpolicy: "strict-origin",
    "aria-label": 'A & B "quoted" <safe>',
    "data-owner": "Ada's",
  });
  const concept = new EmbeddingConcept();
  const declaration = declare(concept, {
    subject: "attributes",
    alternative: 'A & B "quoted" <safe> \'too\'',
    original: "/assets/image.png?left=1&right=2",
    attributes,
  });
  attributes.role = "changed";

  expect(concept._markup({ embedding: declaration.embedding })[0]!.markup).toBe(
    '<picture><img src="/assets/image.png?left=1&amp;right=2" width="1440" height="900" alt="A &amp; B &quot;quoted&quot; &lt;safe&gt; &#39;too&#39;" loading="lazy" decoding="async" aria-label="A &amp; B &quot;quoted&quot; &lt;safe&gt;" crossorigin="anonymous" data-owner="Ada&#39;s" dir="ltr" fetchpriority="high" id="pipeline" lang="en" referrerpolicy="strict-origin" role="img"></picture>',
  );
});

test("lookup queries reject invalid and unknown identities without sentinel rows", () => {
  const concept = new EmbeddingConcept();
  const malformed = "\ud800";
  expect(concept._embedding({ embedding: 1 })).toEqual([]);
  expect(concept._embedding({ embedding: malformed })).toEqual([]);
  expect(concept._embedding({ embedding: "missing" })).toEqual([]);
  expect(concept._for({ subject: 1 })).toEqual([]);
  expect(concept._for({ subject: malformed })).toEqual([]);
  expect(concept._for({ subject: "missing" })).toEqual([]);
  expect(concept._offers({ embedding: 1 })).toEqual([]);
  expect(concept._offers({ embedding: "missing" })).toEqual([]);
  expect(concept._markup({ embedding: 1 })).toEqual([]);
  expect(concept._markup({ embedding: "missing" })).toEqual([]);
});

test("canonical media types and every declared refusal are registered", () => {
  expect(MEDIA_TYPE_BY_FORMAT).toEqual({
    avif: "image/avif",
    gif: "image/gif",
    heif: "image/heif",
    jpeg: "image/jpeg",
    jxl: "image/jxl",
    png: "image/png",
    tiff: "image/tiff",
    webp: "image/webp",
  });
  expect(registeredEmbedding.refusals).toEqual({
    INVALID_TEXT: InvalidText,
    INVALID_DIMENSION: InvalidDimension,
    INVALID_COUNT: InvalidCount,
    INVALID_ADDRESS: InvalidAddress,
    INVALID_FORMAT: InvalidFormat,
    INVALID_ATTRIBUTES: InvalidAttributes,
    EMBEDDING_NOT_FOUND: EmbeddingNotFound,
    INVALID_WIDTH: InvalidWidth,
    INVALID_ORDER: InvalidOrder,
    EMBEDDING_COMPLETE: EmbeddingComplete,
    OFFER_CONFLICT: OfferConflict,
  });
  expect(registeredEmbedding.specification.actions.flatMap(({ refusals }) => refusals.map(({ code, message }) => [code, message]))).toEqual([
    ["INVALID_TEXT", "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."],
    ["INVALID_DIMENSION", "Intrinsic width and height must be positive safe integers."],
    ["INVALID_COUNT", "Expected offer count must be a nonnegative safe integer."],
    ["INVALID_ADDRESS", "Image addresses must be safe site-absolute srcset addresses."],
    ["INVALID_FORMAT", "Image format must be one of the canonical supported formats."],
    ["INVALID_ATTRIBUTES", "Image attributes must be a plain record of text attributes."],
    ["INVALID_TEXT", "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."],
    ["EMBEDDING_NOT_FOUND", "There is no such embedding."],
    ["INVALID_ADDRESS", "Image addresses must be safe site-absolute srcset addresses."],
    ["INVALID_FORMAT", "Image format must be one of the canonical supported formats."],
    ["INVALID_WIDTH", "Offer width must be a positive safe integer no greater than the intrinsic width."],
    ["INVALID_ORDER", "Offer order must be a nonnegative safe integer."],
    ["EMBEDDING_COMPLETE", "A completed embedding cannot accept a changed or additional offer."],
    ["OFFER_CONFLICT", "An address or format-width candidate is already used by this embedding."],
    ["INVALID_TEXT", "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."],
    ["EMBEDDING_NOT_FOUND", "There is no such embedding."],
  ]);
});
