import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidAttempt,
  InvalidText,
  RenderTrackingConcept,
  RenderingNotFound,
  StageNotReady,
  StaleAttempt,
} from "@concepts/render-tracking/render-tracking.ts";
import { renderTracking as registration } from "@concepts/render-tracking/registry.ts";

const attempts = { dependencyAttempt: 1, emissionAttempt: 1 } as const;
const markdown = { profile: "markdown", template: "page.html" } as const;
const verbatim = { profile: "verbatim", template: "page.html" } as const;

test("its principle: attempts retain selected policy and advance each stage once", () => {
  const rendering = new RenderTrackingConcept();
  const markdownAttempt = rendering.begin({ subject: "page:post", path: "posts/post.md", ...markdown, ...attempts });
  const html = rendering.begin({ subject: "page:about", path: "about.html", ...verbatim, ...attempts });
  const custom = rendering.begin({
    subject: "page:custom",
    path: "custom.txt",
    profile: "custom",
    template: "special.html",
    ...attempts,
  });

  expect(markdownAttempt.profile).toBe("markdown");
  expect(html.profile).toBe("verbatim");
  expect(custom.profile).toBe("custom");
  expect(markdownAttempt.template).toBe("page.html");
  expect(custom.template).toBe("special.html");
  expect(rendering.completeBody({ rendering: markdownAttempt.rendering })).toMatchObject({ transitioned: true });
  expect(rendering._active({ rendering: markdownAttempt.rendering })[0]?.stage).toBe("body-settled");
  expect(rendering.completeBody({ rendering: markdownAttempt.rendering })).toMatchObject({ transitioned: false });
  expect(rendering.completeLayout({ rendering: markdownAttempt.rendering })).toMatchObject({ transitioned: true });
  expect(rendering._active({ rendering: markdownAttempt.rendering })).toEqual([]);
  expect(rendering.completeLayout({ rendering: markdownAttempt.rendering })).toMatchObject({ transitioned: false });
  expect(rendering._attempt({ rendering: markdownAttempt.rendering })).toEqual([
    { subject: "page:post", path: "posts/post.md", profile: "markdown", template: "page.html", stage: "completed", failure: undefined, ...attempts },
  ]);
});

test("failure is one terminal transition", () => {
  const rendering = new RenderTrackingConcept();
  const attempt = rendering.begin({ subject: "page", path: "page.md", ...markdown, ...attempts });
  expect(rendering.fail({ rendering: attempt.rendering, reason: "TEMPLATE_NOT_FOUND" })).toMatchObject({ transitioned: true });
  expect(rendering.fail({ rendering: attempt.rendering, reason: "ANOTHER" })).toMatchObject({ transitioned: false });
  expect(rendering._active({ rendering: attempt.rendering })).toEqual([]);
  expect(rendering._attempt({ rendering: attempt.rendering })[0]).toMatchObject({ stage: "failed", failure: "TEMPLATE_NOT_FOUND" });
});

test("a new attempt supersedes unfinished work and ignores its late completion", () => {
  const rendering = new RenderTrackingConcept();
  const first = rendering.begin({ subject: "page:post", path: "post.md", ...markdown, ...attempts });
  rendering.completeBody({ rendering: first.rendering });
  const replacementAttempts = { dependencyAttempt: 2, emissionAttempt: 2 } as const;
  const second = rendering.begin({ subject: "page:post", path: "post.html", ...verbatim, ...replacementAttempts });

  expect(rendering._attempt({ rendering: first.rendering })).toEqual([
    { subject: "page:post", path: "post.md", profile: "markdown", template: "page.html", stage: "superseded", failure: undefined, ...attempts },
  ]);
  expect(rendering._active({ rendering: first.rendering })).toEqual([]);
  expect(rendering._active({ rendering: second.rendering })[0]?.stage).toBe("started");
  expect(rendering.completeLayout({ rendering: first.rendering })).toMatchObject({ transitioned: false });
  expect(rendering._latest({ subject: "page:post" })).toEqual([
    { rendering: second.rendering, path: "post.html", profile: "verbatim", template: "page.html", stage: "started", failure: undefined, ...replacementAttempts },
  ]);
});

test("begin is idempotent for one exact pair and refuses stale or inconsistent pairs", () => {
  const rendering = new RenderTrackingConcept();
  const first = rendering.begin({ subject: "page:post", path: "post.md", ...markdown, ...attempts });

  expect(rendering.begin({ subject: "page:post", path: "post.md", ...markdown, ...attempts })).toEqual(first);
  expect(rendering._all()).toHaveLength(1);
  expect(() => rendering.begin({
    subject: "page:post",
    path: "post.html",
    ...verbatim,
    ...attempts,
  })).toThrow(StaleAttempt);
  expect(() => rendering.begin({
    subject: "page:post",
    path: "post.md",
    ...markdown,
    dependencyAttempt: 2,
    emissionAttempt: 1,
  })).toThrow(StaleAttempt);
  expect(rendering._latest({ subject: "page:post" })[0]?.rendering).toBe(first.rendering);
});

test("out-of-order and unknown transitions refuse without changing state", () => {
  const rendering = new RenderTrackingConcept();
  const attempt = rendering.begin({ subject: "page:post", path: "post.md", ...markdown, ...attempts });

  expect(() => rendering.completeLayout({ rendering: attempt.rendering })).toThrow(StageNotReady);
  expect(() => rendering.completeBody({ rendering: "missing" })).toThrow(RenderingNotFound);
  expect(() => rendering.fail({ rendering: "missing", reason: "failure" })).toThrow(RenderingNotFound);
  expect(() => rendering.fail({ rendering: attempt.rendering, reason: 1 })).toThrow(InvalidText);
  expect(rendering._attempt({ rendering: attempt.rendering })[0]?.stage).toBe("started");
});

test("begin validates selected policy before superseding current work", () => {
  const rendering = new RenderTrackingConcept();
  const current = rendering.begin({ subject: "page:post", path: "post.md", ...markdown, ...attempts });

  expect(() => rendering.begin({ subject: 1, path: "post.md", ...markdown, ...attempts })).toThrow(InvalidText);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", profile: 1, template: "page.html", ...attempts })).toThrow(InvalidText);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", profile: "markdown", template: undefined, ...attempts })).toThrow(InvalidText);
  expect(rendering._latest({ subject: "page:post" })[0]).toMatchObject({
    rendering: current.rendering,
    stage: "started",
  });
});

test("queries retain attempts in start order and reject malformed identities", () => {
  const rendering = new RenderTrackingConcept();
  const first = rendering.begin({ subject: "page:a", path: "a.md", ...markdown, ...attempts });
  const second = rendering.begin({ subject: "page:b", path: "b.html", ...verbatim, ...attempts });

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
    RENDERING_NOT_FOUND: RenderingNotFound,
    STAGE_NOT_READY: StageNotReady,
  });
  expect(registration.specification.queries.map(({ name, inputs, promise }) => ({ name, inputs, promise }))).toEqual([
    { name: "_attempt", inputs: ["rendering"], promise: "optional" },
    { name: "_active", inputs: ["rendering"], promise: "optional" },
    { name: "_latest", inputs: ["subject"], promise: "optional" },
    { name: "_all", inputs: [], promise: "many" },
  ]);

  const concepts = conceptSet({ RenderTracking: registration });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.RenderTracking.begin({ subject: "page", path: "page.txt", profile: 1, template: "page.html", ...attempts })).toEqual({
    error: "INVALID_TEXT",
    detail: "Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text.",
  });
  const attempt = (await app.concepts.RenderTracking.begin({ subject: "page", path: "page.md", ...markdown, ...attempts })) as {
    rendering: string;
  };
  expect(await app.concepts.RenderTracking._attempt({ rendering: attempt.rendering })).toEqual([
    { subject: "page", path: "page.md", profile: "markdown", template: "page.html", stage: "started", failure: undefined, ...attempts },
  ]);
  await app.whenIdle();
});
