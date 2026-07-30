import { expect, test } from "bun:test";
import { assembleSyncpress } from "../../src/assembly.ts";

type ActionValue<T> = T extends { readonly error: string } ? never : T;

function value<T>(result: T): ActionValue<T> {
  if ("error" in (result as object)) throw new Error((result as { error: string }).error);
  return result as ActionValue<T>;
}

test("superseded template work cannot enter the replacement dependency attempt", async () => {
  const app = assembleSyncpress();
  const page = "page:post";
  const partial = value(await app.concepts.Templating.define({ name: "old", source: "old" }));
  const first = value(await app.concepts.Rendering.begin({ subject: page, path: "post.md", data: {} }));
  await app.concepts.Depending.begin({ subject: page });
  const second = value(await app.concepts.Rendering.begin({ subject: page, path: "post.md", data: {} }));
  await app.concepts.Depending.begin({ subject: page });

  await app.concepts.Templating.fill({
    subject: first.rendering,
    source: '{% render "old" %}',
    context: {},
    trusted: [],
    sourceName: "post.md",
    sourceLine: 1,
  });
  await app.whenIdle();
  expect(await app.concepts.Depending._uses({ subject: page })).toEqual([]);

  await app.concepts.Templating.fill({
    subject: second.rendering,
    source: '{% render "old" %}',
    context: {},
    trusted: [],
    sourceName: "post.md",
    sourceLine: 1,
  });
  await app.whenIdle();
  expect(await app.concepts.Depending._uses({ subject: page })).toEqual([{ input: partial.template }]);
});

test("superseded failures cannot recreate diagnostics for the replacement attempt", async () => {
  const app = assembleSyncpress();
  const root = value(await app.concepts.Filing.open({ name: "content" }));
  const page = value(await app.concepts.Filing.place({
    root: root.root,
    path: "post.md",
    content: new TextEncoder().encode("post"),
  }));
  const first = value(await app.concepts.Rendering.begin({ subject: page.file, path: "post.md", data: {} }));
  const firstScan = value(await app.concepts.Referencing.scan({
    subject: first.rendering,
    part: "body",
    text: '<img src="https://example.com/old.png">',
  }));
  const firstReference = (await app.concepts.Referencing._references({ source: firstScan.source }))[0]!;
  const second = value(await app.concepts.Rendering.begin({ subject: page.file, path: "post.md", data: {} }));
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
  const first = value(await app.concepts.Rendering.begin({ subject: page, path: "post.md", data: {} }));
  const scanned = value(await app.concepts.Referencing.scan({
    subject: first.rendering,
    part: "body",
    text: '<a href="later">later</a>',
  }));
  const reference = (await app.concepts.Referencing._references({ source: scanned.source }))[0]!;
  const second = value(await app.concepts.Rendering.begin({ subject: page, path: "post.md", data: {} }));

  await app.concepts.Referencing.answer({ reference: reference.reference, form: "address", value: "/later/" });
  await app.whenIdle();

  expect(await app.concepts.Rendering._attempt({ rendering: first.rendering })).toEqual([
    expect.objectContaining({ stage: "superseded" }),
  ]);
  expect(await app.concepts.Rendering._attempt({ rendering: second.rendering })).toEqual([
    expect.objectContaining({ stage: "started" }),
  ]);
});
