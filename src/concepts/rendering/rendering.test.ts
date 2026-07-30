import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidProfile,
  InvalidData,
  InvalidTemplate,
  InvalidText,
  RenderingConcept,
  RenderingNotFound,
  StageNotReady,
  UnknownSource,
} from "./rendering.ts";
import { rendering as registration } from "./registry.ts";

test("its principle: attempts select profiles and advance each stage once", () => {
  const rendering = new RenderingConcept();
  const markdown = rendering.begin({ subject: "page:post", path: "posts/post.md", data: {} });
  const html = rendering.begin({ subject: "page:about", path: "about.html", data: {} });
  const custom = rendering.begin({
    subject: "page:custom",
    path: "custom.txt",
    data: { build: { markup: "custom", template: "special.html" } },
  });

  expect(markdown.profile).toBe("markdown");
  expect(html.profile).toBe("verbatim");
  expect(custom.profile).toBe("custom");
  expect(markdown.template).toBe("page.html");
  expect(custom.template).toBe("special.html");
  expect(rendering.settleBody({ rendering: markdown.rendering })).toMatchObject({ transitioned: true });
  expect(rendering.settleBody({ rendering: markdown.rendering })).toMatchObject({ transitioned: false });
  expect(rendering.settleLayout({ rendering: markdown.rendering })).toMatchObject({ transitioned: true });
  expect(rendering.settleLayout({ rendering: markdown.rendering })).toMatchObject({ transitioned: false });
  expect(rendering.finish({ rendering: markdown.rendering })).toMatchObject({ transitioned: true });
  expect(rendering.finish({ rendering: markdown.rendering })).toMatchObject({ transitioned: false });
  expect(rendering._attempt({ rendering: markdown.rendering })).toEqual([
    { subject: "page:post", path: "posts/post.md", profile: "markdown", template: "page.html", stage: "completed" },
  ]);
});

test("a new attempt supersedes unfinished work and ignores its late completion", () => {
  const rendering = new RenderingConcept();
  const first = rendering.begin({ subject: "page:post", path: "post.md", data: {} });
  rendering.settleBody({ rendering: first.rendering });
  const second = rendering.begin({ subject: "page:post", path: "post.html", data: {} });

  expect(rendering._attempt({ rendering: first.rendering })).toEqual([
    { subject: "page:post", path: "post.md", profile: "markdown", template: "page.html", stage: "superseded" },
  ]);
  expect(rendering.settleLayout({ rendering: first.rendering })).toMatchObject({ transitioned: false });
  expect(rendering._latest({ subject: "page:post" })).toEqual([
    { rendering: second.rendering, path: "post.html", profile: "verbatim", template: "page.html", stage: "started" },
  ]);
});

test("out-of-order and unknown transitions refuse without changing state", () => {
  const rendering = new RenderingConcept();
  const attempt = rendering.begin({ subject: "page:post", path: "post.md", data: {} });

  expect(() => rendering.settleLayout({ rendering: attempt.rendering })).toThrow(StageNotReady);
  expect(() => rendering.finish({ rendering: attempt.rendering })).toThrow(StageNotReady);
  expect(() => rendering.settleBody({ rendering: "missing" })).toThrow(RenderingNotFound);
  expect(rendering._attempt({ rendering: attempt.rendering })[0]?.stage).toBe("started");
});

test("begin validates source and profile values before superseding current work", () => {
  const rendering = new RenderingConcept();
  const current = rendering.begin({ subject: "page:post", path: "post.md", data: {} });

  expect(() => rendering.begin({ subject: 1, path: "post.md", data: {} })).toThrow(InvalidText);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", data: null })).toThrow(InvalidData);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", data: { build: { markup: 1 } } })).toThrow(InvalidProfile);
  expect(() => rendering.begin({ subject: "page:post", path: "post.md", data: { build: { template: 1 } } })).toThrow(InvalidTemplate);
  expect(() => rendering.begin({ subject: "page:post", path: "post.txt", data: {} })).toThrow(UnknownSource);
  expect(rendering._latest({ subject: "page:post" })[0]).toMatchObject({
    rendering: current.rendering,
    stage: "started",
  });
});

test("queries retain attempts in start order and reject malformed identities", () => {
  const rendering = new RenderingConcept();
  const first = rendering.begin({ subject: "page:a", path: "a.md", data: {} });
  const second = rendering.begin({ subject: "page:b", path: "b.html", data: {} });

  expect(rendering._all().map(({ rendering: identity }) => identity)).toEqual([first.rendering, second.rendering]);
  expect(rendering._attempt({ rendering: null })).toEqual([]);
  expect(rendering._latest({ subject: null })).toEqual([]);
});

test("registry refusals, promises, and assembled outcomes match the specification", async () => {
  expect(registration.refusals).toEqual({
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
    { name: "_latest", inputs: ["subject"], promise: "optional" },
    { name: "_all", inputs: [], promise: "many" },
  ]);

  const concepts = conceptSet({ Rendering: registration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.Rendering.begin({ subject: "page", path: "page.txt", data: {} })).toEqual({
    error: "UNKNOWN_SOURCE",
    detail: "A page source must select a profile or use a supported extension.",
  });
  const attempt = (await app.concepts.Rendering.begin({ subject: "page", path: "page.md", data: {} })) as {
    rendering: string;
  };
  expect(await app.concepts.Rendering._attempt({ rendering: attempt.rendering })).toEqual([
    { subject: "page", path: "page.md", profile: "markdown", template: "page.html", stage: "started" },
  ]);
  await app.whenIdle();
});
