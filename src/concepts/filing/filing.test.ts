import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncpressComputations } from "../../compositions/computations.ts";
import {
  FileNotFound,
  FilingConcept,
  InvalidEncoding,
  InvalidPath,
  InvalidSource,
  PathLeavesRoot,
  RootNotFound,
} from "./filing.ts";
import { filing } from "./registry.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (content: Uint8Array) => new TextDecoder().decode(content);

test("its principle: a complete host load atomically replaces one named tree", async () => {
  const directory = await mkdtemp(join(tmpdir(), "filing-load-"));
  const outside = await mkdtemp(join(tmpdir(), "filing-outside-"));
  try {
    await mkdir(join(directory, "posts"));
    await writeFile(join(directory, "posts", "page.md"), "first\n");
    await writeFile(join(directory, "picture.png"), "picture\n");
    const filing = new FilingConcept();

    const first = await filing.loadTree({ name: "content", directory });
    expect(first).toMatchObject({ status: "loaded", count: 2, changed: true });
    if (first.status !== "loaded") throw new Error(first.detail);
    const page = filing._at({ root: first.root, path: "posts/page.md" })[0]!.file;
    const picture = filing._at({ root: first.root, path: "picture.png" })[0]!.file;

    await writeFile(join(directory, "posts", "page.md"), "second\n");
    await rm(join(directory, "picture.png"));
    const second = await filing.loadTree({ name: "content", directory });
    expect(second).toMatchObject({ status: "loaded", root: first.root, count: 1, changed: true });
    expect(filing._at({ root: first.root, path: "posts/page.md" })[0]!.file).toBe(page);
    expect(filing._file({ file: picture })).toEqual([]);
    expect(filing._text({ file: page })).toEqual([{ text: "second\n" }]);

    await symlink(outside, join(directory, "linked"));
    expect(await filing.loadTree({ name: "content", directory })).toEqual({
      status: "problem",
      code: "ENTRY_UNSUPPORTED",
      detail: "Only directories and ordinary files may be loaded.",
    });
    expect(filing._text({ file: page })).toEqual([{ text: "second\n" }]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("loads one required host file as a singleton tree", async () => {
  const directory = await mkdtemp(join(tmpdir(), "filing-file-"));
  try {
    const source = join(directory, "site.yaml");
    await writeFile(source, "title: Ada\n");
    const filing = new FilingConcept();
    const loaded = await filing.loadFile({ name: "project", source, path: "site.yaml" });
    expect(loaded).toMatchObject({ status: "loaded", count: 1, changed: true });
    if (loaded.status !== "loaded") throw new Error(loaded.detail);
    expect(filing._text({ file: loaded.file })).toEqual([{ text: "title: Ada\n" }]);
    expect(await filing.loadFile({ name: "project", source: join(directory, "missing"), path: "site.yaml" })).toEqual({
      status: "problem",
      code: "FILE_MISSING",
      detail: "This required file is missing.",
    });
    await expect(filing.loadFile({ name: "", source, path: "site.yaml" })).rejects.toBeInstanceOf(InvalidSource);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("opens stable named roots and keeps collision-prone addresses isolated", () => {
  const filing = new FilingConcept();
  const firstRoot = filing.open({ name: "a:b" }).root;
  const secondRoot = filing.open({ name: "a" }).root;

  expect(filing.open({ name: "a:b" })).toEqual({ root: firstRoot });
  expect(firstRoot).not.toBe(secondRoot);
  expect(filing._root({ root: firstRoot })).toEqual([{ name: "a:b" }]);
  expect(filing._named({ name: "a" })).toEqual([{ root: secondRoot }]);
  expect(filing._root({ root: "root:missing" })).toEqual([]);
  expect(filing._named({ name: "missing" })).toEqual([]);

  // These two addresses produced the same delimiter-built ID in the old implementation.
  const first = filing.place({ root: firstRoot, path: "c", content: bytes("one") });
  const second = filing.place({ root: secondRoot, path: "b:c", content: bytes("two") });
  expect(first.file).not.toBe(second.file);
  expect(text(filing._file({ file: first.file })[0]!.content)).toBe("one");
  expect(text(filing._file({ file: second.file })[0]!.content)).toBe("two");
  expect(filing._at({ root: firstRoot, path: "c" })).toEqual([{ file: first.file, digest: first.digest }]);
  expect(filing._at({ root: secondRoot, path: "b:c" })).toEqual([{ file: second.file, digest: second.digest }]);
});

test("places copied bytes, reports exact changes, and preserves address identity", () => {
  const filing = new FilingConcept();
  const { root } = filing.open({ name: "content" });
  const empty = filing.place({ root, path: "empty.bin", content: new Uint8Array() });
  expect(empty.digest).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  expect(filing._file({ file: empty.file })[0]!.content).toEqual(new Uint8Array());
  expect(filing.place({ root, path: "empty.bin", content: new Uint8Array() }).changed).toBe(false);

  const input = Buffer.from("first");
  const first = filing.place({ root, path: "posts/page.md", content: input });

  expect(first).toEqual({
    file: first.file,
    digest: "a7937b64b8caa58f03721bb6bacf5c78cb235febe0e70b1b84cd99541461a08e",
    changed: true,
  });
  input.fill(0);
  const read = filing._file({ file: first.file })[0]!;
  expect(text(read.content)).toBe("first");
  expect(read).toMatchObject({ root, path: "posts/page.md", name: "page.md", digest: first.digest });

  read.content.fill(0);
  expect(text(filing._file({ file: first.file })[0]!.content)).toBe("first");

  const unchanged = filing.place({ root, path: "posts/page.md", content: bytes("first") });
  expect(unchanged).toEqual({ file: first.file, digest: first.digest, changed: false });

  const changed = filing.place({ root, path: "posts/page.md", content: bytes("second") });
  expect(changed).toEqual({
    file: first.file,
    digest: "16367aacb67a4a017c8da8ab95682ccb390863780f7114dda0a0e0c55644c7c4",
    changed: true,
  });
  expect(filing._at({ root, path: "posts/page.md" })).toEqual([{ file: first.file, digest: changed.digest }]);
  expect(filing._under({ root, prefix: "posts" })).toEqual([
    { file: first.file, path: "posts/page.md", digest: changed.digest },
  ]);
  expect(filing.discard({ file: first.file })).toEqual({ root, path: "posts/page.md", name: "page.md" });
  expect(filing._file({ file: first.file })).toEqual([]);
  expect(filing._at({ root, path: "posts/page.md" })).toEqual([]);
  expect(filing._under({ root, prefix: "posts" })).toEqual([]);
  expect(() => filing.discard({ file: first.file })).toThrow(FileNotFound);

  const replaced = filing.place({ root, path: "posts/page.md", content: bytes("second") });
  expect(replaced).toEqual({ file: first.file, digest: changed.digest, changed: true });
});

test("reads strict UTF-8 text without consuming a BOM or exposing mutable bytes", () => {
  const filing = new FilingConcept();
  const { root } = filing.open({ name: "content" });
  const supplied = Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes("Ada — café")]);
  const page = filing.place({ root, path: "page.md", content: supplied });

  supplied.fill(0);
  expect(filing._text({ file: page.file })).toEqual([{ text: "\uFEFFAda — café" }]);

  const observed = filing._file({ file: page.file })[0]!.content;
  observed.fill(0);
  expect(filing._text({ file: page.file })).toEqual([{ text: "\uFEFFAda — café" }]);

  const empty = filing.place({ root, path: "empty.txt", content: new Uint8Array() });
  expect(filing._text({ file: empty.file })).toEqual([{ text: "" }]);

  filing.discard({ file: page.file });
  expect(filing._text({ file: page.file })).toEqual([]);
  expect(filing._text({ file: "file:missing" })).toEqual([]);
  expect(filing._text({ file: "\ud800" })).toEqual([]);
  expect(filing._text({ file: 1 as unknown as string })).toEqual([]);
});

test("places canonical Base64 staging payloads as exact bytes", () => {
  const filing = new FilingConcept();
  const { root } = filing.open({ name: "content" });
  const bytes = Uint8Array.from([0, 1, 127, 128, 255]);
  const placed = filing.placeBase64({ root, path: "binary.bin", encoded: Buffer.from(bytes).toString("base64") });

  expect(filing._file({ file: placed.file })[0]?.content).toEqual(bytes);
  for (const encoded of ["not base64", "AA", 1]) {
    expect(() => filing.placeBase64({ root, path: "invalid.bin", encoded: encoded as string })).toThrow(InvalidEncoding);
  }
});

test("strict UTF-8 text reads reject every malformed sequence without changing bytes", () => {
  const filing = new FilingConcept();
  const { root } = filing.open({ name: "content" });
  const malformed = [
    [0x80],
    [0xc0, 0x80],
    [0xe2, 0x82],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
  ];

  for (const [index, sequence] of malformed.entries()) {
    const content = Uint8Array.from(sequence);
    const placed = filing.place({ root, path: `bad-${index}.txt`, content });
    expect(filing._text({ file: placed.file })).toEqual([]);
    expect(filing._file({ file: placed.file })[0]!.content).toEqual(content);
  }
});

test("refuses unknown roots, escaping paths, noncanonical paths, and non-byte content", () => {
  const filing = new FilingConcept();
  const { root } = filing.open({ name: "content" });

  expect(() => filing.place({ root: "root:missing", path: "../x", content: bytes("x") })).toThrow(RootNotFound);

  for (const path of ["/absolute", "../escape", "a/../../escape"]) {
    expect(() => filing.place({ root, path, content: bytes("x") })).toThrow(PathLeavesRoot);
  }

  for (const path of [
    "",
    ".",
    "./page.md",
    "a/../page.md",
    "a//page.md",
    "a/",
    "a\\page.md",
    "a/\u0000page.md",
    "cafe\u0301.md",
    "\ud800.md",
  ]) {
    expect(() => filing.place({ root, path, content: bytes("x") })).toThrow(InvalidPath);
  }

  expect(() =>
    filing.place({ root, path: "page.md", content: "not bytes" as unknown as Uint8Array }),
  ).toThrow(TypeError);
  expect(filing._under({ root, prefix: "" })).toEqual([]);

  for (const path of [".well-known", "café.md", "names/a:b", "names/hash#tag", "names/query?tag"]) {
    expect(filing.place({ root, path, content: bytes(path) }).changed).toBe(true);
  }
});

test("path helpers share one canonical directory grammar", () => {
  expect(syncpressComputations.joinPath({ prefix: "", name: "page.md" })).toBe("page.md");
  expect(syncpressComputations.joinPath({ prefix: "posts/design", name: "page.md" })).toBe("posts/design/page.md");
  expect(syncpressComputations.directoryPath({ path: "page.md" })).toBe("");
  expect(syncpressComputations.directoryPath({ path: "posts/design/page.md" })).toBe("posts/design");
  expect(syncpressComputations.relativePath({ path: "posts/design/page.md", prefix: "posts" })).toBe("design/page.md");
  expect(syncpressComputations.relativePath({ path: "other/page.md", prefix: "posts" })).toBeNull();

  for (const prefix of ["posts/", "./posts", "posts\\design"]) {
    expect(syncpressComputations.joinPath({ prefix, name: "page.md" })).toBeNull();
  }
  for (const name of ["", ".", "..", "nested/page.md", "bad\\name"]) {
    expect(syncpressComputations.joinPath({ prefix: "posts", name })).toBeNull();
  }
  for (const path of ["", "./page.md", "posts//page.md", "../page.md"]) {
    expect(syncpressComputations.directoryPath({ path })).toBeNull();
  }
});

test("lists directory descendants in deterministic UTF-8 byte order", () => {
  const first = new FilingConcept();
  const firstRoot = first.open({ name: "content" }).root;
  const paths = [
    "posts/\u{10000}.md",
    "posts/\ue000.md",
    "posts/z.md",
    "posts/a/deep.md",
    "posts/a.md",
    "postscript/other.md",
    "posts",
  ];
  for (const path of paths) first.place({ root: firstRoot, path, content: bytes(path) });

  const expected = ["posts/a.md", "posts/a/deep.md", "posts/z.md", "posts/\ue000.md", "posts/\u{10000}.md"];
  expect(first._under({ root: firstRoot, prefix: "posts" }).map(({ path }) => path)).toEqual(expected);
  expect(first._under({ root: firstRoot, prefix: "posts/" })).toEqual([]);
  expect(first._under({ root: "root:missing", prefix: "" })).toEqual([]);

  const second = new FilingConcept();
  const secondRoot = second.open({ name: "content" }).root;
  for (const path of [...paths].reverse()) second.place({ root: secondRoot, path, content: bytes(path) });
  expect(second._under({ root: secondRoot, prefix: "posts" }).map(({ path }) => path)).toEqual(expected);
  expect(secondRoot).toBe(firstRoot);
  expect(second._at({ root: secondRoot, path: "posts/a.md" })[0]!.file).toBe(
    first._at({ root: firstRoot, path: "posts/a.md" })[0]!.file,
  );
});

test("lists every held file by root in opening order and by path within a root", () => {
  const filing = new FilingConcept();
  const content = filing.open({ name: "content" }).root;
  const templates = filing.open({ name: "templates" }).root;
  expect(filing._files()).toEqual([]);

  const page = filing.place({ root: templates, path: "page.html", content: bytes("page") });
  const second = filing.place({ root: content, path: "posts/second.md", content: bytes("second") });
  const about = filing.place({ root: content, path: "about.md", content: bytes("about") });

  expect(filing._files()).toEqual([
    { file: about.file, root: content, path: "about.md" },
    { file: second.file, root: content, path: "posts/second.md" },
    { file: page.file, root: templates, path: "page.html" },
  ]);

  filing.discard({ file: second.file });
  expect(filing._files()).toEqual([
    { file: about.file, root: content, path: "about.md" },
    { file: page.file, root: templates, path: "page.html" },
  ]);
});

test("resolves URI references within one root and reports every other outcome", () => {
  const filing = new FilingConcept();
  const root = filing.open({ name: "content" }).root;
  const otherRoot = filing.open({ name: "other" }).root;
  const page = filing.place({ root, path: "posts/page.md", content: bytes("page") });
  const picture = filing.place({ root, path: "posts/picture one.png", content: bytes("image") });
  const shared = filing.place({ root, path: "shared.bin", content: bytes("shared") });
  const hash = filing.place({ root, path: "posts/hash#tag.txt", content: bytes("hash") });
  const colon = filing.place({ root, path: "posts/a:b.txt", content: bytes("colon") });
  const query = filing.place({ root, path: "posts/query?tag.txt", content: bytes("query") });
  filing.place({ root: otherRoot, path: "posts/picture one.png", content: bytes("other image") });

  expect(filing._resolve({ file: page.file, address: "./picture%20one.png?download=1#preview" })).toEqual([
    { target: picture.file, path: "posts/picture one.png" },
  ]);
  expect(filing._resolve({ file: page.file, address: "../shared.bin" })).toEqual([
    { target: shared.file, path: "shared.bin" },
  ]);
  expect(filing._resolve({ file: page.file, address: "./hash%23tag.txt" })).toEqual([
    { target: hash.file, path: "posts/hash#tag.txt" },
  ]);
  expect(filing._resolve({ file: page.file, address: "./a:b.txt" })).toEqual([
    { target: colon.file, path: "posts/a:b.txt" },
  ]);
  expect(filing._resolve({ file: page.file, address: "./query%3Ftag.txt" })).toEqual([
    { target: query.file, path: "posts/query?tag.txt" },
  ]);

  for (const address of ["", "?draft=1", "#section"]) {
    expect(filing._resolution({ file: page.file, address })).toEqual({ status: "found" });
    expect(filing._resolve({ file: page.file, address })).toEqual([{ target: page.file, path: "posts/page.md" }]);
  }

  expect(filing._resolution({ file: page.file, address: "./missing.png" })).toEqual({ status: "missing" });
  expect(filing._resolve({ file: page.file, address: "./missing.png" })).toEqual([]);

  for (const address of ["../../escape", "%2e%2e/%2e%2e/escape"]) {
    expect(filing._resolution({ file: page.file, address })).toEqual({ status: "outside" });
    expect(filing._resolve({ file: page.file, address })).toEqual([]);
  }
  for (const address of ["/absolute", "//example.test/file", "https://example.test/file", "mailto:ada@example.test"]) {
    expect(filing._resolution({ file: page.file, address })).toEqual({ status: "nonlocal" });
  }
  for (const address of ["./", ".", "..", "./bad%", "./bad%2Fname", "bad\\name"]) {
    expect(filing._resolution({ file: page.file, address })).toEqual({ status: "invalid" });
  }

  expect(filing._resolution({ file: "file:missing", address: "./x" })).toEqual({ status: "unknown-file" });
  expect(filing._resolve({ file: "file:missing", address: "./x" })).toEqual([]);
});

test("registry exposes all declared refusals with their normative messages", async () => {
  const concepts = conceptSet({ Filing: filing });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  const Filing = app.concepts.Filing;

  expect(await Filing.place({ root: "missing", path: "page.md", content: bytes("x") })).toEqual({
    error: "ROOT_NOT_FOUND",
    detail: "There is no such root.",
  });

  const opened = (await Filing.open({ name: "content" })) as { root: string };
  expect(await Filing.place({ root: opened.root, path: "/page.md", content: bytes("x") })).toEqual({
    error: "PATH_LEAVES_ROOT",
    detail: "A file path must stay inside its root.",
  });
  expect(await Filing.place({ root: opened.root, path: "./page.md", content: bytes("x") })).toEqual({
    error: "INVALID_PATH",
    detail: "A file path must use the canonical portable form.",
  });
  expect(await Filing.discard({ file: "missing" })).toEqual({
    error: "FILE_NOT_FOUND",
    detail: "There is no such file.",
  });
  await app.whenIdle();
});
