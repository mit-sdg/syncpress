import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AttemptExhausted,
  DestinationNotDirected,
  DestinationUnavailable,
  EmittingConcept as StrictEmittingConcept,
  InvalidClaim,
  InvalidContent,
  InvalidDestination,
  InvalidMedium,
  InvalidPath,
  InvalidProducer,
  NotBegun,
  PathContested,
  PathLeavesDestination,
  ReconciliationFailed,
  StaleAttempt,
} from "./emitting.ts";
import { emitting as emittingRegistration } from "./registry.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (content: Uint8Array) => new TextDecoder().decode(content);

class EmittingConcept extends StrictEmittingConcept {
  readonly #open = new Map<string, number>();

  begin(input: { producer: string }) {
    const result = super.begin(input);
    this.#open.set(input.producer, result.attempt);
    return result;
  }

  intend(input: Parameters<StrictEmittingConcept["intend"]>[0]) {
    const attempt = input.attempt ?? this.#open.get(input.producer);
    return super.intend({ ...input, ...(attempt === undefined ? {} : { attempt }) });
  }

  commit(input: { producer: string; attempt?: unknown }) {
    const result = super.commit({ ...input, attempt: input.attempt ?? this.#open.get(input.producer) });
    this.#open.delete(input.producer);
    return result;
  }

  abort(input: { producer: string; attempt?: unknown }) {
    const result = super.abort({ ...input, attempt: input.attempt ?? this.#open.get(input.producer) });
    this.#open.delete(input.producer);
    return result;
  }
}

test("its principle: complete attempts preserve the last valid artifact set", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    await mkdir(destination);
    await writeFile(join(destination, "old.html"), bytes("stale"));

    const emitting = new EmittingConcept();
    expect(await emitting.direct({ destination })).toEqual({ destination, existing: 1 });
    expect(() => emitting.commit({ producer: "missing" })).toThrow(NotBegun);

    const sharedIntent = emitting.intend({
      producer: "shared",
      path: "styles.css",
      content: bytes("main {}"),
      medium: "text/css",
    });
    emitting.intend({ producer: "other", path: "styles.css", content: bytes("main {}"), medium: "text/css" });

    expect(emitting.begin({ producer: "bundle" })).toEqual({ producer: "bundle", attempt: 1 });
    const firstIndex = emitting.intend({
      producer: "bundle",
      path: "index.html",
      content: bytes("first"),
      medium: "text/html",
    });
    const stylesheet = emitting.intend({
      producer: "bundle",
      path: "a.css",
      content: bytes("body {}"),
      medium: "text/css",
    });

    expect(emitting._byProducer({ producer: "bundle" })).toEqual([]);
    expect(emitting._pending()).toEqual([{ path: "styles.css", digest: sharedIntent.digest }]);
    expect(emitting._orphans()).toEqual([{ path: "old.html" }]);
    expect(() =>
      emitting.intend({ producer: "contender", path: "index.html", content: bytes("different"), medium: "text/html" }),
    ).toThrow(PathContested);
    expect(emitting._producers({ path: "index.html" })).toEqual([{ producer: "bundle" }]);

    expect(emitting.commit({ producer: "bundle" })).toEqual({ producer: "bundle", dropped: 0 });
    expect(emitting._intent({ path: "index.html" })).toEqual([{ digest: firstIndex.digest, medium: "text/html" }]);
    expect(emitting._byProducer({ producer: "bundle" })).toEqual([
      { path: "a.css", digest: stylesheet.digest, medium: "text/css" },
      { path: "index.html", digest: firstIndex.digest, medium: "text/html" },
    ]);
    expect(emitting._producers({ path: "styles.css" })).toEqual([{ producer: "other" }, { producer: "shared" }]);
    expect(emitting._pending().map(({ path }) => path)).toEqual(["a.css", "index.html", "styles.css"]);

    expect(await emitting.reconcile()).toEqual({ written: 3, replaced: 0, kept: 0, removed: 1 });
    expect(text(await readFile(join(destination, "index.html")))).toBe("first");
    expect(emitting._pending()).toEqual([]);
    expect(emitting._orphans()).toEqual([]);

    expect(emitting.begin({ producer: "bundle" })).toEqual({ producer: "bundle", attempt: 2 });
    const secondIndex = emitting.intend({
      producer: "bundle",
      path: "index.html",
      content: bytes("second"),
      medium: "text/html",
    });

    expect(emitting._intent({ path: "index.html" })).toEqual([{ digest: firstIndex.digest, medium: "text/html" }]);
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 3, removed: 0 });
    expect(text(await readFile(join(destination, "index.html")))).toBe("first");

    expect(emitting.commit({ producer: "bundle" })).toEqual({ producer: "bundle", dropped: 1 });
    expect(emitting._pending()).toEqual([{ path: "index.html", digest: secondIndex.digest }]);
    expect(emitting._orphans()).toEqual([{ path: "a.css" }]);
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 1, kept: 1, removed: 1 });
    expect(text(await readFile(join(destination, "index.html")))).toBe("second");

    expect(emitting.retract({ producer: "shared" })).toEqual({ producer: "shared", count: 1 });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 2, removed: 0 });
    expect(emitting.retract({ producer: "bundle" })).toEqual({ producer: "bundle", count: 1 });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 1, removed: 1 });
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("attempts are replaceable stages with stable identities and exact retraction", () => {
  const emitting = new EmittingConcept();
  const oldAsset = emitting.intend({ producer: "owner", path: "asset", content: bytes("old"), medium: "x/test" });
  emitting.intend({ producer: "owner", path: "keep", content: bytes("keep"), medium: "x/test" });

  expect(emitting.begin({ producer: "owner" })).toEqual({ producer: "owner", attempt: 1 });
  const staged = emitting.intend({
    producer: "owner",
    path: "asset/child",
    content: bytes("unfinished"),
    medium: "x/test",
  });
  expect(staged.intent).not.toBe(oldAsset.intent);
  expect(emitting._byProducer({ producer: "owner" }).map(({ path }) => path)).toEqual(["asset", "keep"]);
  expect(() =>
    emitting.intend({ producer: "other", path: "asset/child/deeper", content: bytes("x"), medium: "x/test" }),
  ).toThrow(PathContested);
  expect(emitting._producers({ path: "asset/child/deeper" })).toEqual([{ producer: "owner" }]);

  expect(emitting.begin({ producer: "owner" })).toEqual({ producer: "owner", attempt: 2 });
  const replacement = emitting.intend({
    producer: "owner",
    path: "asset/child",
    content: bytes("finished"),
    medium: "x/test",
  });
  expect(replacement.intent).toBe(staged.intent);
  expect(emitting.commit({ producer: "owner" })).toEqual({ producer: "owner", dropped: 2 });
  expect(emitting._byProducer({ producer: "owner" }).map(({ path }) => path)).toEqual(["asset/child"]);
  expect(() => emitting.commit({ producer: "owner" })).toThrow(NotBegun);

  emitting.begin({ producer: "owner" });
  emitting.intend({ producer: "owner", path: "temporary", content: bytes("temp"), medium: "x/test" });
  expect(emitting.retract({ producer: "owner" })).toEqual({ producer: "owner", count: 2 });
  expect(emitting._attempt({ producer: "owner" })).toEqual([]);
  expect(emitting._byProducer({ producer: "owner" })).toEqual([]);

  const direct = emitting.intend({ producer: "direct", path: "one", content: bytes("1"), medium: "x/test" });
  expect(emitting.intend({ producer: "direct", path: "one", content: bytes("2"), medium: "x/test" }).intent).toBe(
    direct.intent,
  );
  expect(() => emitting.commit({ producer: "direct" })).toThrow(NotBegun);
  emitting.begin({ producer: "direct" });
  expect(emitting.commit({ producer: "direct" })).toEqual({ producer: "direct", dropped: 1 });
  expect(emitting._byProducer({ producer: "direct" })).toEqual([]);
});

test("logical claims prevent one transactional producer from silently overwriting another source", () => {
  const emitting = new EmittingConcept();
  emitting.begin({ producer: "page" });
  emitting.intend({ producer: "page", claim: "asset:a", path: "download.txt", content: bytes("first"), medium: "text/plain" });
  expect(() =>
    emitting.intend({ producer: "page", claim: "asset:b", path: "download.txt", content: bytes("second"), medium: "text/plain" }),
  ).toThrow(PathContested);
  expect(
    emitting.intend({ producer: "page", claim: "asset:a", path: "download.txt", content: bytes("replacement"), medium: "text/plain" }),
  ).toMatchObject({ path: "download.txt" });
  expect(() =>
    emitting.intend({ producer: "page", claim: "\ud800", path: "other.txt", content: bytes("x"), medium: "text/plain" }),
  ).toThrow(InvalidClaim);
});

test("aborting releases staged reservations without changing active or emitted artifacts", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    await mkdir(destination);

    const emitting = new EmittingConcept();
    await emitting.direct({ destination });
    emitting.intend({ producer: "owner", path: "current.bin", content: bytes("current"), medium: "x/test" });
    emitting.intend({ producer: "owner", path: "kept.bin", content: bytes("kept"), medium: "x/test" });
    await emitting.reconcile();

    const active = emitting._byProducer({ producer: "owner" });
    const currentBefore = await stat(join(destination, "current.bin"));
    const entriesBefore = await readdir(destination);
    expect(emitting.begin({ producer: "owner" })).toEqual({ producer: "owner", attempt: 1 });
    expect(emitting._open({ producer: "owner" })).toEqual([{ attempt: 1 }]);
    emitting.intend({ producer: "owner", path: "current.bin", content: bytes("replacement"), medium: "x/test" });
    emitting.intend({ producer: "owner", path: "reserved.bin", content: bytes("first"), medium: "x/test" });
    emitting.intend({ producer: "owner", path: "reserved.bin", content: bytes("second"), medium: "x/test" });

    expect(() =>
      emitting.intend({ producer: "other", path: "reserved.bin", content: bytes("other"), medium: "x/test" }),
    ).toThrow(PathContested);
    expect(emitting._producers({ path: "reserved.bin" })).toEqual([{ producer: "owner" }]);
    expect(emitting.abort({ producer: "owner" })).toEqual({ producer: "owner", discarded: 2 });

    expect(emitting._attempt({ producer: "owner" })).toEqual([{ attempt: 1 }]);
    expect(emitting._open({ producer: "owner" })).toEqual([]);
    expect(emitting._byProducer({ producer: "owner" })).toEqual(active);
    expect(emitting._producers({ path: "reserved.bin" })).toEqual([]);
    expect(emitting._pending()).toEqual([]);
    expect(emitting._orphans()).toEqual([]);
    expect(await readdir(destination)).toEqual(entriesBefore);
    expect(text(await readFile(join(destination, "current.bin")))).toBe("current");
    expect((await stat(join(destination, "current.bin"))).ino).toBe(currentBefore.ino);
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 2, removed: 0 });
    expect((await stat(join(destination, "current.bin"))).ino).toBe(currentBefore.ino);

    expect(() => emitting.abort({ producer: "owner" })).toThrow(NotBegun);
    expect(() => emitting.abort({ producer: "missing" })).toThrow(NotBegun);
    expect(() => emitting.abort({ producer: "\ud800" })).toThrow(InvalidProducer);
    expect(
      emitting.intend({ producer: "other", path: "reserved.bin", content: bytes("other"), medium: "x/test" }).path,
    ).toBe("reserved.bin");

    expect(emitting.begin({ producer: "owner" })).toEqual({ producer: "owner", attempt: 2 });
    emitting.intend({ producer: "owner", path: "next.bin", content: bytes("next"), medium: "x/test" });
    expect(emitting.abort({ producer: "owner" })).toEqual({ producer: "owner", discarded: 1 });
    expect(emitting.begin({ producer: "owner" })).toEqual({ producer: "owner", attempt: 3 });
    expect(emitting.abort({ producer: "owner" })).toEqual({ producer: "owner", discarded: 0 });
    expect(emitting._attempt({ producer: "owner" })).toEqual([{ attempt: 3 }]);
    expect(emitting._open({ producer: "owner" })).toEqual([]);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("validates portable paths and exact artifact values before changing ownership", () => {
  const emitting = new EmittingConcept();

  for (const path of ["/absolute", "../escape", "a/../../escape", "C:/escape"]) {
    expect(() => emitting.intend({ producer: "p", path, content: bytes("x"), medium: "x/test" })).toThrow(
      PathLeavesDestination,
    );
  }
  for (const path of [
    "",
    ".",
    "./file",
    "a/../file",
    "a//file",
    "a/",
    "a\\file",
    "a/\u0000file",
    "a/line\nfile",
    "cafe\u0301",
    "\ud800",
  ]) {
    expect(() => emitting.intend({ producer: "p", path, content: bytes("x"), medium: "x/test" })).toThrow(InvalidPath);
  }
  expect(() =>
    emitting.intend({ producer: "\ud800", path: "file", content: bytes("x"), medium: "x/test" }),
  ).toThrow(InvalidProducer);
  expect(() =>
    emitting.intend({ producer: "p", path: "file", content: { bytes: [] } as unknown as Uint8Array, medium: "x/test" }),
  ).toThrow(InvalidContent);
  expect(() =>
    emitting.intend({ producer: "p", path: "file", content: bytes("x"), medium: "\ud800" }),
  ).toThrow(InvalidMedium);
  expect(emitting._byProducer({ producer: "p" })).toEqual([]);

  const empty = emitting.intend({ producer: "zeta", path: ".well-known", content: "", medium: "z/type" });
  expect(empty.digest).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  expect(emitting.intend({ producer: "alpha", path: ".well-known", content: new Uint8Array(), medium: "a/type" })).toEqual({
    intent: expect.any(String),
    path: ".well-known",
    digest: empty.digest,
  });
  expect(emitting._intent({ path: ".well-known" })).toEqual([{ digest: empty.digest, medium: "a/type" }]);
  expect(emitting._producers({ path: ".well-known" })).toEqual([{ producer: "alpha" }, { producer: "zeta" }]);
  expect(() =>
    emitting.intend({ producer: "other", path: ".well-known", content: bytes("different"), medium: "x/test" }),
  ).toThrow(PathContested);
  expect(() =>
    emitting.intend({ producer: "other", path: ".well-known/child", content: bytes("x"), medium: "x/test" }),
  ).toThrow(PathContested);

  expect(emitting.intend({ producer: "names", path: "names/a:b", content: bytes("colon"), medium: "x/test" }).path).toBe(
    "names/a:b",
  );
  expect(emitting.intend({ producer: "names", path: "café", content: bytes("accent"), medium: "x/test" }).path).toBe(
    "café",
  );
  expect(emitting._intent({ path: "./invalid" })).toEqual([]);
  expect(emitting._producers({ path: "../invalid" })).toEqual([]);
  expect(emitting._attempt({ producer: "\ud800" })).toEqual([]);
});

test("copies binary input, removes stale entry kinds and empty directories, and never follows symlinks", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    const outside = join(temporary, "outside");
    await mkdir(destination);
    await mkdir(outside);
    await mkdir(join(destination, "empty", "deep"), { recursive: true });
    await symlink(outside, join(destination, "assets"));

    const emitting = new EmittingConcept();
    expect(await emitting.direct({ destination })).toEqual({ destination, existing: 1 });
    const input = Buffer.from([0, 255, 1, 128]);
    emitting.intend({ producer: "binary", path: "assets/blob.bin", content: input, medium: "application/octet-stream" });
    input.fill(7);

    expect(await emitting.reconcile()).toEqual({ written: 1, replaced: 0, kept: 0, removed: 1 });
    expect(await readFile(join(destination, "assets", "blob.bin"))).toEqual(Buffer.from([0, 255, 1, 128]));
    await expect(readFile(join(outside, "blob.bin"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readdir(destination)).toEqual(["assets"]);

    const binaryBefore = await stat(join(destination, "assets", "blob.bin"));
    emitting.intend({ producer: "text", path: "index.html", content: "café", medium: "text/html" });
    expect(await emitting.reconcile()).toEqual({ written: 1, replaced: 0, kept: 1, removed: 0 });
    expect(text(await readFile(join(destination, "index.html")))).toBe("café");
    const binaryAfter = await stat(join(destination, "assets", "blob.bin"));
    expect(binaryAfter.ino).toBe(binaryBefore.ino);
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 2, removed: 0 });
    expect((await readdir(temporary)).sort()).toEqual(["dist", "outside"]);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("inspection order is UTF-8 byte order and independent of insertion order", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    await mkdir(destination);
    for (const path of ["\u{10000}.old", "\ue000.old", "z.old"]) {
      await writeFile(join(destination, path), bytes(path));
    }

    const emitting = new EmittingConcept();
    await emitting.direct({ destination });
    const paths = ["\u{10000}.new", "\ue000.new", "z.new"];
    for (const path of paths) {
      emitting.intend({ producer: "owner", path, content: bytes(path), medium: "x/test" });
    }
    for (const producer of ["\u{10000}", "\ue000", "z"]) {
      emitting.intend({ producer, path: "shared", content: bytes("same"), medium: producer });
    }

    expect(emitting._byProducer({ producer: "owner" }).map(({ path }) => path)).toEqual([
      "z.new",
      "\ue000.new",
      "\u{10000}.new",
    ]);
    expect(emitting._producers({ path: "shared" })).toEqual([
      { producer: "z" },
      { producer: "\ue000" },
      { producer: "\u{10000}" },
    ]);
    expect(emitting._intent({ path: "shared" })[0]?.medium).toBe("z");
    expect(emitting._pending().map(({ path }) => path)).toEqual([
      "shared",
      "z.new",
      "\ue000.new",
      "\u{10000}.new",
    ]);
    expect(emitting._orphans()).toEqual([
      { path: "z.old" },
      { path: "\ue000.old" },
      { path: "\u{10000}.old" },
    ]);
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("directing is non-destructive and failed tree preparation leaves the destination untouched", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    const missing = join(temporary, "missing");
    const invalid = join(temporary, "not-a-directory");
    await mkdir(destination);
    await writeFile(join(destination, "keep.txt"), bytes("old"));
    await writeFile(invalid, bytes("file"));

    const undirected = new EmittingConcept();
    await expect(undirected.reconcile()).rejects.toBeInstanceOf(DestinationNotDirected);
    expect(await undirected.direct({ destination: missing })).toEqual({ destination: missing, existing: 0 });
    await expect(lstat(missing)).rejects.toMatchObject({ code: "ENOENT" });
    undirected.intend({ producer: "empty", path: "empty.bin", content: new Uint8Array(), medium: "application/octet-stream" });
    expect(await undirected.reconcile()).toEqual({ written: 1, replaced: 0, kept: 0, removed: 0 });
    expect(await readFile(join(missing, "empty.bin"))).toEqual(Buffer.alloc(0));

    const emitting = new EmittingConcept();
    await emitting.direct({ destination });
    await expect(emitting.direct({ destination: invalid })).rejects.toBeInstanceOf(InvalidDestination);
    emitting.intend({ producer: "short", path: "keep.txt", content: bytes("new"), medium: "text/plain" });
    emitting.intend({
      producer: "long",
      path: "x".repeat(300),
      content: bytes("cannot be staged"),
      medium: "text/plain",
    });

    await expect(emitting.reconcile()).rejects.toBeInstanceOf(ReconciliationFailed);
    expect(text(await readFile(join(destination, "keep.txt")))).toBe("old");
    expect((await readdir(temporary)).filter((name) => name.includes(".emitting-"))).toEqual([]);

    emitting.retract({ producer: "long" });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 1, kept: 0, removed: 0 });
    expect(text(await readFile(join(destination, "keep.txt")))).toBe("new");

    await expect(emitting.direct({ destination: join(temporary, "x".repeat(300)) })).rejects.toBeInstanceOf(
      DestinationUnavailable,
    );
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("stale attempts cannot stage, commit, or abort a replacement", () => {
  const emitting = new StrictEmittingConcept();
  const first = emitting.begin({ producer: "page" });
  const second = emitting.begin({ producer: "page" });

  expect(() => emitting.intend({ producer: "page", attempt: first.attempt, path: "old", content: "old", medium: "text/plain" })).toThrow(StaleAttempt);
  emitting.intend({ producer: "page", attempt: second.attempt, path: "new", content: "new", medium: "text/plain" });
  expect(() => emitting.commit({ producer: "page", attempt: first.attempt })).toThrow(StaleAttempt);
  expect(() => emitting.abort({ producer: "page", attempt: first.attempt })).toThrow(StaleAttempt);
  emitting.commit({ producer: "page", attempt: second.attempt });
  expect(emitting._byProducer({ producer: "page" })).toHaveLength(1);
});

test("reports where reconciliation stages one destination's work", () => {
  const emitting = new EmittingConcept();
  const { prefix } = emitting._staging({ destination: "/srv/site/dist" });
  expect(prefix).toBe("/srv/site/.dist.emitting-");
  expect(emitting._staging({ destination: "" })).toEqual({ prefix: "" });
});

test("registry exposes every refusal, query promise, and normative message", async () => {
  expect(emittingRegistration.refusals).toEqual({
    INVALID_CLAIM: InvalidClaim,
    INVALID_DESTINATION: InvalidDestination,
    DESTINATION_UNAVAILABLE: DestinationUnavailable,
    INVALID_PRODUCER: InvalidProducer,
    ATTEMPT_EXHAUSTED: AttemptExhausted,
    PATH_LEAVES_DESTINATION: PathLeavesDestination,
    INVALID_PATH: InvalidPath,
    INVALID_CONTENT: InvalidContent,
    INVALID_MEDIUM: InvalidMedium,
    PATH_CONTESTED: PathContested,
    NOT_BEGUN: NotBegun,
    STALE_ATTEMPT: StaleAttempt,
    DESTINATION_NOT_DIRECTED: DestinationNotDirected,
    RECONCILIATION_FAILED: ReconciliationFailed,
  });
  expect(emittingRegistration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
    ["_intent", "optional"],
    ["_producers", "many"],
    ["_byProducer", "many"],
    ["_attempt", "optional"],
    ["_open", "optional"],
    ["_pending", "many"],
    ["_orphans", "many"],
    ["_staging", "one"],
  ]);
  expect(emittingRegistration.specification.actions.map(({ name }) => name)).toEqual([
    "direct",
    "begin",
    "intend",
    "commit",
    "abort",
    "retract",
    "reconcile",
  ]);

  const concepts = conceptSet({ Emitting: emittingRegistration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  const Emitting = app.concepts.Emitting;
  const reconcile = Emitting.reconcile as unknown as (input: Record<string, never>) => Promise<unknown>;

  expect(await Emitting.direct({ destination: "" })).toEqual({
    error: "INVALID_DESTINATION",
    detail: "A destination must name a directory other than the filesystem root.",
  });
  expect(await Emitting.begin({ producer: "\ud800" })).toEqual({
    error: "INVALID_PRODUCER",
    detail: "A producer identity must be well-formed text.",
  });
  expect(await Emitting.intend({ producer: "one", claim: "\ud800", path: "x", content: bytes("x"), medium: "x/test" })).toEqual({
    error: "INVALID_CLAIM",
    detail: "An artifact claim identity must be well-formed text.",
  });
  expect(await Emitting.intend({ producer: "one", path: "../x", content: bytes("x"), medium: "x/test" })).toEqual({
    error: "PATH_LEAVES_DESTINATION",
    detail: "An artifact path must stay inside the destination.",
  });
  expect(await Emitting.intend({ producer: "one", path: "./x", content: bytes("x"), medium: "x/test" })).toEqual({
    error: "INVALID_PATH",
    detail: "An artifact path must use the canonical portable form.",
  });
  expect(
    await Emitting.intend({
      producer: "one",
      path: "x",
      content: null as unknown as Uint8Array,
      medium: "x/test",
    }),
  ).toEqual({
    error: "INVALID_CONTENT",
    detail: "Artifact content must be bytes or well-formed text.",
  });
  expect(await Emitting.intend({ producer: "one", path: "x", content: bytes("x"), medium: "\ud800" })).toEqual({
    error: "INVALID_MEDIUM",
    detail: "An artifact medium must be well-formed text.",
  });
  await Emitting.intend({ producer: "one", path: "x", content: bytes("x"), medium: "x/test" });
  expect(await Emitting.intend({ producer: "two", path: "x", content: bytes("y"), medium: "x/test" })).toEqual({
    error: "PATH_CONTESTED",
    detail: "This artifact path conflicts with another intended artifact.",
  });
  expect(await Emitting.commit({ producer: "one", attempt: 1 })).toEqual({
    error: "NOT_BEGUN",
    detail: "This producer has no open attempt.",
  });
  expect(await Emitting.abort({ producer: "\ud800", attempt: 1 })).toEqual({
    error: "INVALID_PRODUCER",
    detail: "A producer identity must be well-formed text.",
  });
  expect(await Emitting.abort({ producer: "one", attempt: 1 })).toEqual({
    error: "NOT_BEGUN",
    detail: "This producer has no open attempt.",
  });
  expect(await reconcile({})).toEqual({
    error: "DESTINATION_NOT_DIRECTED",
    detail: "No destination has been directed.",
  });
  await app.whenIdle();
});
