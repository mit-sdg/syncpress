import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidProfile,
  InvalidAttempt,
  InvalidData,
  InvalidTemplate,
  InvalidText,
  RenderingConcept,
  RenderingNotFound,
  StageNotReady,
  StaleAttempt,
  UnknownSource,
} from "./rendering.ts";
import { rendering as registration } from "./registry.ts";

const attempts = { dependencyAttempt: 1, emissionAttempt: 1 } as const;

test("its principle: attempts select profiles and advance each stage once", () => {
  const rendering = new RenderingConcept();
  const markdown = rendering.begin({ subject: "page:post", path: "posts/post.md", data: {}, ...attempts });
  const html = rendering.begin({ subject: "page:about", path: "about.html", data: {}, ...attempts });
  const custom = rendering.begin({
    subject: "page:custom",
    path: "custom.txt",
    data: { build: { markup: "custom", template: "special.html" } },
    ...attempts,
  });

  expect(markdown.profile).toBe("markdown");
  expect(html.profile).toBe("verbatim");
  expect(custom.profile).toBe("custom");
  expect(markdown.template).toBe("page.html");
  expect(custom.template).toBe("special.html");
  expect(rendering.settleBody({ rendering: markdown.rendering })).toMatchObject({ transitioned: true });
  expect(rendering._active({ rendering: markdown.rendering })[0]?.stage).toBe("body-settled");
  expect(rendering.settleBody({ rendering: markdown.rendering })).toMatchObject({ transitioned: false });
  expect(rendering.settleLayout({ rendering: markdown.rendering })).toMatchObject({ transitioned: true });
  expect(rendering._active({ rendering: markdown.rendering })[0]?.stage).toBe("layout-settled");
  expect(rendering.settleLayout({ rendering: markdown.rendering })).toMatchObject({ transitioned: false });
  expect(rendering.finish({ rendering: markdown.rendering })).toMatchObject({ transitioned: true });
  expect(rendering._active({ rendering: markdown.rendering })).toEqual([]);
  expect(rendering.finish({ rendering: markdown.rendering })).toMatchObject({ transitioned: false });
  expect(rendering._attempt({ rendering: markdown.rendering })).toEqual([
    { subject: "page:post", path: "posts/post.md", profile: "markdown", template: "page.html", stage: "completed", ...attempts },
  ]);
});

test("a new attempt supersedes unfinished work and ignores its late completion", () => {
  const rendering = new RenderingConcept();
  const first = rendering.begin({ subject: "page:post", path: "post.md", data: {}, ...attempts });
  rendering.settleBody({ rendering: first.rendering });
  const replacementAttempts = { dependencyAttempt: 2, emissionAttempt: 2 } as const;
  const second = rendering.begin({ subject: "page:post", path: "post.html", data: {}, ...replacementAttempts });

  expect(rendering._attempt({ rendering: first.rendering })).toEqual([
    { subject: "page:post", path: "post.md", profile: "markdown", template: "page.html", stage: "superseded", ...attempts },
  ]);
  expect(rendering._active({ rendering: first.rendering })).toEqual([]);
  expect(rendering._active({ rendering: second.rendering })[0]?.stage).toBe("started");
  expect(rendering.settleLayout({ rendering: first.rendering })).toMatchObject({ transitioned: false });
  expect(rendering._latest({ subject: "page:post" })).toEqual([
    { rendering: second.rendering, path: "post.html", profile: "verbatim", template: "page.html", stage: "started", ...replacementAttempts },
  ]);
});

test("begin is idempotent for one exact pair and refuses stale or inconsistent pairs", () => {
  const rendering = new RenderingConcept();
  const first = rendering.begin({ subject: "page:post", path: "post.md", data: {}, ...attempts });

  expect(rendering.begin({ subject: "page:post", path: "post.md", data: {}, ...attempts })).toEqual(first);
  expect(rendering._all()).toHaveLength(1);
  expect(() => rendering.begin({
    subject: "page:post",
    path: "post.html",
    data: {},
    ...attempts,
  })).toThrow(StaleAttempt);
  expect(() => rendering.begin({
    subject: "page:post",
    path: "post.md",
    data: {},
    dependencyAttempt: 2,
    emissionAttempt: 1,
  })).toThrow(StaleAttempt);
  expect(rendering._latest({ subject: "page:post" })[0]?.rendering).toBe(first.rendering);
});

test("out-of-order and unknown transitions refuse without changing state", () => {
  const rendering = new RenderingConcept();
  const attempt = rendering.begin({ subject: "page:post", path: "post.md", data: {}, ...attempts });

  expect(() => rendering.settleLayout({ rendering: attempt.rendering })).toThrow(StageNotReady);
  expect(() => rendering.finish({ rendering: attempt.rendering })).toThrow(StageNotReady);
  expect(() => rendering.settleBody({ rendering: "missing" })).toThrow(RenderingNotFound);
  expect(rendering._attempt({ rendering: attempt.rendering })[0]?.stage).toBe("started");
});

test("begin validates source and profile values before superseding current work", () => {
  const rendering = new RenderingConcept();
  const current = rendering.begin({ subject: "page:post", path: "post.md", data: {}, ...attempts });

  expect(() => rendering.begin({ subject: 1, path: "post.md", data: {}, ...attempts })).toThrow(InvalidText);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", data: null, ...attempts })).toThrow(InvalidData);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", data: { build: { markup: 1 } }, ...attempts })).toThrow(InvalidProfile);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", data: { build: { template: 1 } }, ...attempts })).toThrow(InvalidTemplate);
  expect(() => rendering.begin({ subject: "page:post", path: "post.txt", data: {}, ...attempts })).toThrow(UnknownSource);
  expect(rendering._latest({ subject: "page:post" })[0]).toMatchObject({
    rendering: current.rendering,
    stage: "started",
  });
});

test("queries retain attempts in start order and reject malformed identities", () => {
  const rendering = new RenderingConcept();
  const first = rendering.begin({ subject: "page:a", path: "a.md", data: {}, ...attempts });
  const second = rendering.begin({ subject: "page:b", path: "b.html", data: {}, ...attempts });

  expect(rendering._all().map(({ rendering: identity }) => identity)).toEqual([first.rendering, second.rendering]);
  expect(rendering._attempt({ rendering: null })).toEqual([]);
  expect(rendering._active({ rendering: null })).toEqual([]);
  expect(rendering._active({ rendering: "missing" })).toEqual([]);
  expect(rendering._latest({ subject: null })).toEqual([]);
});

test("registry refusals, promises, and assembled outcomes match the specification", async () => {
  expect(registration.refusals).toEqual({
    INVALID_ATTEMPT: InvalidAttempt,
    STALE_ATTEMPT: StaleAttempt,
    INVALID_TEXT: InvalidText,
    INVALID_DATA: InvalidData,
    INVALID_PROFILE: InvalidProfile,
    INVALID_TEMPLATE: InvalidTemplate,
    UNKNOWN_SOURCE: UnknownSource,
    RENDERING_NOT_FOUND: RenderingNotFound,
    STAGE_NOT_READY: StageNotReady,
  });
  expect(registration.specification.queries).toEqual([
    { name: "_attempt", inputs: ["rendering"], promise: "optional" },
    { name: "_active", inputs: ["rendering"], promise: "optional" },
    { name: "_latest", inputs: ["subject"], promise: "optional" },
    { name: "_all", inputs: [], promise: "many" },
  ]);

  const concepts = conceptSet({ Rendering: registration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.Rendering.begin({ subject: "page", path: "page.txt", data: {}, ...attempts })).toEqual({
    error: "UNKNOWN_SOURCE",
    detail: "A page source must select a profile or use a supported extension.",
  });
  const attempt = (await app.concepts.Rendering.begin({ subject: "page", path: "page.md", data: {}, ...attempts })) as {
    rendering: string;
  };
  expect(await app.concepts.Rendering._attempt({ rendering: attempt.rendering })).toEqual([
    { subject: "page", path: "page.md", profile: "markdown", template: "page.html", stage: "started", ...attempts },
  ]);
  await app.whenIdle();
});
