import { expect, test } from "bun:test";
import { assembleSyncpress } from "@syncpress/assembly";

type ActionValue<T> = T extends { readonly error: string } ? never : T;

function value<T>(result: T): ActionValue<T> {
  if ("error" in (result as object)) throw new Error((result as { error: string }).error);
  return result as ActionValue<T>;
}

test("superseded template work cannot enter the replacement dependency attempt", async () => {
  const app = assembleSyncpress();
  const page = "page:post";
  const partial = value(await app.concepts.Templating.define({ name: "old", source: "old" }));
  const firstDependency = value(await app.concepts.DependencyTracking.beginAttempt({ subject: page }));
  const first = value(await app.concepts.RenderTracking.begin({
    subject: page,
    path: "post.md",
    profile: "markdown",
    template: "page.html",
    dependencyAttempt: firstDependency.attempt,
    emissionAttempt: 1,
  }));
  const secondDependency = value(await app.concepts.DependencyTracking.beginAttempt({ subject: page }));
  const second = value(await app.concepts.RenderTracking.begin({
    subject: page,
    path: "post.md",
    profile: "markdown",
    template: "page.html",
    dependencyAttempt: secondDependency.attempt,
    emissionAttempt: 2,
  }));

  await app.concepts.Templating.renderSource({
    subject: first.rendering,
    source: '{% render "old" %}',
    context: {},
    trusted: [],
    sourceName: "post.md",
    sourceLine: 1,
  });
  await app.whenIdle();
  expect(await app.concepts.DependencyTracking._uses({ subject: page })).toEqual([]);

  await app.concepts.Templating.renderSource({
    subject: second.rendering,
    source: '{% render "old" %}',
    context: {},
    trusted: [],
    sourceName: "post.md",
    sourceLine: 1,
  });
  await app.whenIdle();
  expect(await app.concepts.DependencyTracking._uses({ subject: page })).toEqual([{ input: partial.template }]);
});

test("superseded failures cannot recreate diagnostics for the replacement attempt", async () => {
  const app = assembleSyncpress();
  const root = value(await app.concepts.Filing.ensureRoot({ name: "content" }));
  const page = value(await app.concepts.Filing.putFile({
    root: root.root,
    path: "post.md",
    content: new TextEncoder().encode("post"),
  }));
  const first = value(await app.concepts.RenderTracking.begin({ subject: page.file, path: "post.md", profile: "markdown", template: "page.html", dependencyAttempt: 1, emissionAttempt: 1 }));
  const firstScan = value(await app.concepts.Referencing.scan({
    subject: first.rendering,
    part: "body",
    text: '<img src="https://example.com/old.png">',
  }));
  const firstReference = (await app.concepts.Referencing._references({ source: firstScan.source }))[0]!;
  const second = value(await app.concepts.RenderTracking.begin({ subject: page.file, path: "post.md", profile: "markdown", template: "page.html", dependencyAttempt: 2, emissionAttempt: 2 }));
  await app.concepts.Embedding.declare({
    subject: firstReference.reference,
    alternative: "old",
    width: 0,
    height: 1,
    expects: 0,
    original: "/old.png",
    originalFormat: "png",
    attributes: {},
  });
  await app.whenIdle();
  expect(await app.concepts.Diagnosing._all()).toEqual([]);

  const secondScan = value(await app.concepts.Referencing.scan({
    subject: second.rendering,
    part: "body",
    text: '<img src="https://example.com/new.png">',
  }));
  const secondReference = (await app.concepts.Referencing._references({ source: secondScan.source }))[0]!;
  await app.concepts.Embedding.declare({
    subject: secondReference.reference,
    alternative: "new",
    width: 0,
    height: 1,
    expects: 0,
    original: "/new.png",
    originalFormat: "png",
    attributes: {},
  });
  await app.whenIdle();
  expect(await app.concepts.Diagnosing._all()).toEqual([
    expect.objectContaining({ code: "INVALID_DIMENSION", source: "post.md" }),
  ]);
});

test("late reference completion cannot settle a superseded or replacement attempt", async () => {
  const app = assembleSyncpress();
  const page = "page:post";
  const first = value(await app.concepts.RenderTracking.begin({ subject: page, path: "post.md", profile: "markdown", template: "page.html", dependencyAttempt: 1, emissionAttempt: 1 }));
  const scanned = value(await app.concepts.Referencing.scan({
    subject: first.rendering,
    part: "body",
    text: '<a href="later">later</a>',
  }));
  const reference = (await app.concepts.Referencing._references({ source: scanned.source }))[0]!;
  const second = value(await app.concepts.RenderTracking.begin({ subject: page, path: "post.md", profile: "markdown", template: "page.html", dependencyAttempt: 2, emissionAttempt: 2 }));

  await app.concepts.Referencing.resolve({ reference: reference.reference, form: "address", value: "/later/" });
  await app.whenIdle();

  expect(await app.concepts.RenderTracking._attempt({ rendering: first.rendering })).toEqual([
    expect.objectContaining({ stage: "superseded" }),
  ]);
  expect(await app.concepts.RenderTracking._attempt({ rendering: second.rendering })).toEqual([
    expect.objectContaining({ stage: "started" }),
  ]);
});

test("rendering diagnostics fail first and clean up owner-local attempts at the flow frontier", async () => {
  const app = assembleSyncpress();
  const root = value(await app.concepts.Filing.ensureRoot({ name: "content" }));
  const page = value(await app.concepts.Filing.putFile({
    root: root.root,
    path: "post.md",
    content: new TextEncoder().encode("post"),
  }));
  const dependency = value(await app.concepts.DependencyTracking.beginAttempt({ subject: page.file }));
  const emission = value(await app.concepts.Emitting.beginAttempt({ producer: page.file }));
  const rendering = value(await app.concepts.RenderTracking.begin({
    subject: page.file,
    path: "post.md",
    profile: "markdown",
    template: "page.html",
    dependencyAttempt: dependency.attempt,
    emissionAttempt: emission.attempt,
  }));

  await app.concepts.Diagnosing.report({
    scope: "page-rendering",
    severity: "error",
    code: "TEST_FAILURE",
    message: "The rendering failed.",
    source: "post.md",
    line: undefined,
    column: undefined,
  });
  await app.whenIdle();

  expect(await app.concepts.RenderTracking._latest({ subject: page.file })).toEqual([
    expect.objectContaining({ rendering: rendering.rendering, stage: "failed", failure: "TEST_FAILURE" }),
  ]);
  expect(await app.concepts.Emitting._open({ producer: page.file })).toEqual([]);
  expect(await app.concepts.DependencyTracking._state({ subject: page.file })).toEqual({ state: "stale" });
});
