import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { DocumentParsingConcept, DocumentNotFound, MalformedAttributes } from "@concepts/document-parsing/document-parsing.ts";
import { documentParsing } from "@concepts/document-parsing/registry.ts";

function one<T>(rows: T[]): T {
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

test("its principle: YAML details and the exact authored body stay together but read separately", () => {
  const documentParsing = new DocumentParsingConcept();
  const parsed = documentParsing.parseDocument({
    subject: "post",
    text: "---\ntitle: Compiler Design\ntopics: [compilers, semantics]\n---\n# Notes\n",
  });

  expect(parsed).toEqual({
    document: 'document:"post"',
    attributes: { title: "Compiler Design", topics: ["compilers", "semantics"] },
    body: "# Notes\n",
  });
  expect(documentParsing._document({ subject: "post" })).toEqual([
    { ...parsed, bodyLine: 5 },
  ]);

  const revised = documentParsing.parseDocument({ subject: "post", text: "---\ntitle: Revised\n---\nNew body" });
  expect(revised.document).toBe(parsed.document);
  expect(documentParsing._document({ subject: "post" })).toEqual([{ ...revised, bodyLine: 4 }]);
  expect(documentParsing._all()).toEqual([{ document: parsed.document, subject: "post" }]);
});

test("text without an exact opening fence is entirely body at line one", () => {
  for (const text of [
    "",
    "No heading\nSecond line",
    "\n---\ntitle: after a blank\n---\nbody",
    " ---\ntitle: indented\n---\nbody",
    "--- \ntitle: trailing space\n---\nbody",
    "--- # comment\ntitle: commented\n---\nbody",
    "\ufeff---\ntitle: after a BOM\n---\nbody",
    "---\rtitle: lone CR\r---\rbody",
  ]) {
    const documentParsing = new DocumentParsingConcept();
    const parsed = documentParsing.parseDocument({ subject: "plain", text });
    expect(parsed.attributes).toEqual({});
    expect(parsed.body).toBe(text);
    expect(one(documentParsing._document({ subject: "plain" })).bodyLine).toBe(1);
  }
});

test("LF and CRLF fences preserve body text and produce exact one-based body lines", () => {
  const crlf = new DocumentParsingConcept();
  const parsed = crlf.parseDocument({
    subject: "crlf",
    text: "---\r\ntitle: Ada\r\nsummary: Notes\r\n---\r\n\r\nBody\r\n",
  });
  expect(parsed).toMatchObject({ attributes: { title: "Ada", summary: "Notes" }, body: "\r\nBody\r\n" });
  expect(one(crlf._document({ subject: "crlf" })).bodyLine).toBe(5);

  const mixed = new DocumentParsingConcept();
  mixed.parseDocument({ subject: "mixed", text: "---\r\ntitle: Ada\n---\r\nBody" });
  expect(one(mixed._document({ subject: "mixed" }))).toMatchObject({ body: "Body", bodyLine: 4 });

  const atEnd = new DocumentParsingConcept();
  atEnd.parseDocument({ subject: "at-end", text: "---\ntitle: Ada\n---" });
  expect(one(atEnd._document({ subject: "at-end" }))).toMatchObject({ body: "", bodyLine: 4 });

  const afterEnding = new DocumentParsingConcept();
  afterEnding.parseDocument({ subject: "after-ending", text: "---\ntitle: Ada\n---\n" });
  expect(one(afterEnding._document({ subject: "after-ending" }))).toMatchObject({ body: "", bodyLine: 4 });
});

test("only an exact column-zero closing fence closes the header", () => {
  const documentParsing = new DocumentParsingConcept();
  const parsed = documentParsing.parseDocument({
    subject: "scalar",
    text: "---\ndescription: |\n  first\n  ---\n  still metadata\n---\nbody",
  });
  expect(parsed.attributes).toEqual({ description: "first\n---\nstill metadata\n" });
  expect(parsed.body).toBe("body");
  expect(one(documentParsing._document({ subject: "scalar" })).bodyLine).toBe(7);

  for (const text of [
    "---\ntitle: Ada\n ---\nbody",
    "---\ntitle: Ada\n--- \nbody",
    "---\ntitle: Ada\n--- # comment\nbody",
    "---\ntitle: Ada\n...\nbody",
  ]) {
    expect(() => new DocumentParsingConcept().parseDocument({ subject: "unclosed", text })).toThrow(MalformedAttributes);
  }
});

test("malformed and unclosed front matter refuse with the normative error", () => {
  for (const text of [
    "---",
    "---\ntitle: Ada",
    "---\ntitle: [\n---\nbody",
    "---\ntitle: !widget Ada\n---\nbody",
  ]) {
    const documentParsing = new DocumentParsingConcept();
    expect(() => documentParsing.parseDocument({ subject: "broken", text })).toThrow(MalformedAttributes);
    expect(() => documentParsing.parseDocument({ subject: "broken", text })).toThrow(
      "The attributes at the top of this document cannot be parsed.",
    );
    expect(documentParsing._document({ subject: "broken" })).toEqual([]);
  }
});

test("failed replacements are atomic and preserve the previous valid document", () => {
  const documentParsing = new DocumentParsingConcept();
  const valid = documentParsing.parseDocument({ subject: "post", text: "---\ntitle: Valid\n---\nOld body" });
  const before = documentParsing._document({ subject: "post" });

  expect(() => documentParsing.parseDocument({ subject: "post", text: "---\ntitle: [\n---\nNew body" })).toThrow(
    MalformedAttributes,
  );
  expect(documentParsing._document({ subject: "post" })).toEqual(before);
  expect(() => documentParsing.parseDocument({ subject: "post", text: "---\ntitle: Unclosed" })).toThrow(MalformedAttributes);
  expect(documentParsing._document({ subject: "post" })).toEqual(before);
  expect(documentParsing._all()).toEqual([{ document: valid.document, subject: "post" }]);
});

test("empty headers are empty mappings and every non-empty root must be a mapping", () => {
  for (const text of ["---\n---\nbody", "---\n# only a comment\n---\nbody", "---\r\n# comment\r\n---\r\nbody"]) {
    expect(new DocumentParsingConcept().parseDocument({ subject: "empty", text }).attributes).toEqual({});
  }

  for (const source of ["null", "Ada", "[one, two]", "- one\n- two", "!!set {one: null}"]) {
    expect(() => new DocumentParsingConcept().parseDocument({ subject: "root", text: `---\n${source}\n---\nbody` })).toThrow(
      MalformedAttributes,
    );
  }

  expect(new DocumentParsingConcept().parseDocument({ subject: "map", text: "---\n!!map { title: Ada }\n---\nbody" }).attributes).toEqual({
    title: "Ada",
  });
});

test("YAML 1.2 Core tags and safe finite numbers form the complete scalar subset", () => {
  const accepted = new DocumentParsingConcept().parseDocument({
    subject: "values",
    text: `---
text: !!str 12
empty: !!null null
truth: !!bool true
integer: !!int 9007199254740991
negative: -9007199254740991
float: !!float 1.5
largeFloat: 1e308
plain: yes
date: 2026-07-29
sequence: !!seq [one, false, null, 2]
mapping: !!map { nested: value }
---
body`,
  });
  expect(accepted.attributes).toEqual({
    text: "12",
    empty: null,
    truth: true,
    integer: Number.MAX_SAFE_INTEGER,
    negative: Number.MIN_SAFE_INTEGER,
    float: 1.5,
    largeFloat: 1e308,
    plain: "yes",
    date: "2026-07-29",
    sequence: ["one", false, null, 2],
    mapping: { nested: "value" },
  });

  const rejected = [
    "value: !widget abc",
    "value: !!timestamp 2026-07-29",
    "value: !!binary SGVsbG8=",
    "value: !!set {one: null}",
    "value: 9007199254740992",
    "value: -9007199254740992",
    "value: .nan",
    "value: .inf",
    "value: 1e400",
  ];
  for (const source of rejected) {
    expect(() => new DocumentParsingConcept().parseDocument({ subject: "value", text: `---\n${source}\n---\nbody` })).toThrow(
      MalformedAttributes,
    );
  }
});

test("mapping keys are unique literal strings and special names stay safe own properties", () => {
  const accepted = new DocumentParsingConcept().parseDocument({
    subject: "keys",
    text: `---
"": blank
"1": numeric text
"true": boolean text
"__proto__": safe
"constructor": ordinary
---
body`,
  }).attributes;
  expect(accepted[""]).toBe("blank");
  expect(accepted["1"]).toBe("numeric text");
  expect(accepted.true).toBe("boolean text");
  expect(Object.getOwnPropertyDescriptor(accepted, "constructor")?.value).toBe("ordinary");
  expect(Object.getPrototypeOf(accepted)).toBe(Object.prototype);
  expect(Object.hasOwn(accepted, "__proto__")).toBe(true);
  expect(accepted.__proto__).toBe("safe");
  expect(({} as Record<string, unknown>).safe).toBeUndefined();

  const rejected = [
    "same: first\nsame: second",
    "1: number",
    "true: boolean",
    "null: null",
    "? [one, two]\n: sequence",
    "name: &name title\n*name: value",
  ];
  for (const source of rejected) {
    expect(() => new DocumentParsingConcept().parseDocument({ subject: "keys", text: `---\n${source}\n---\nbody` })).toThrow(
      MalformedAttributes,
    );
  }
});

test("aliases expand independently with a deterministic safety limit", () => {
  const documentParsing = new DocumentParsingConcept();
  const parsed = documentParsing.parseDocument({
    subject: "aliases",
    text: `---
base: &base
  title: Ada
  topics: [one, two]
copy: *base
word: &word hello
words: [*word, *word]
---
body`,
  });
  const attributes = parsed.attributes as {
    base: { title: string; topics: string[] };
    copy: { title: string; topics: string[] };
    words: string[];
  };
  attributes.copy.title = "Changed";
  attributes.copy.topics.push("three");
  expect(attributes.base).toEqual({ title: "Ada", topics: ["one", "two"] });
  expect(attributes.words).toEqual(["hello", "hello"]);

  const sourceWith = (count: number) => `---
value: &value okay
copies:
${Array.from({ length: count }, () => "  - *value").join("\n")}
---
body`;
  expect(new DocumentParsingConcept().parseDocument({ subject: "limit", text: sourceWith(100) }).attributes).toBeDefined();
  expect(() => new DocumentParsingConcept().parseDocument({ subject: "limit", text: sourceWith(101) })).toThrow(
    MalformedAttributes,
  );
  expect(() =>
    new DocumentParsingConcept().parseDocument({ subject: "cycle", text: "---\nloop: &loop [*loop]\n---\nbody" }),
  ).toThrow(MalformedAttributes);
});

test("action and query observations are deep clones of stored attributes", () => {
  const documentParsing = new DocumentParsingConcept();
  const parsed = documentParsing.parseDocument({
    subject: "clone",
    text: "---\npage:\n  title: Ada\n  topics: [one, two]\n---\nbody",
  });
  const returned = parsed.attributes as { page: { title: string; topics: string[] } };
  returned.page.title = "Changed";
  returned.page.topics.push("three");

  const observed = one(documentParsing._document({ subject: "clone" }));
  expect(observed.attributes).toEqual({ page: { title: "Ada", topics: ["one", "two"] } });
  const queried = observed.attributes as { page: { title: string; topics: string[] } };
  queried.page.title = "Changed again";
  queried.page.topics.length = 0;
  expect(one(documentParsing._document({ subject: "clone" })).attributes).toEqual({
    page: { title: "Ada", topics: ["one", "two"] },
  });
});

test("identities are stable and collision-safe, and listings have one specified order", () => {
  const subjects = ["z", "a", "A", "a:b", 'a"b', "ä"];
  const documentParsing = new DocumentParsingConcept();
  for (const subject of [...subjects].reverse()) documentParsing.parseDocument({ subject, text: subject });

  const listed = documentParsing._all();
  expect(listed.map(({ subject }) => subject)).toEqual([...subjects].sort());
  expect(new Set(listed.map(({ document }) => document).values()).size).toBe(subjects.length);
  for (const { document, subject } of listed) expect(document).toBe(`document:${JSON.stringify(subject)}`);

  const first = documentParsing.parseDocument({ subject: "stable", text: "first" });
  const replaced = documentParsing.parseDocument({ subject: "stable", text: "second" });
  expect(replaced.document).toBe(first.document);
  documentParsing.removeDocument({ subject: "stable" });
  expect(documentParsing.parseDocument({ subject: "stable", text: "third" }).document).toBe(first.document);
  expect(new DocumentParsingConcept().parseDocument({ subject: "stable", text: "independent" }).document).toBe(first.document);
});

test("forget removes exactly one document and refuses an absent subject", () => {
  const documentParsing = new DocumentParsingConcept();
  const parsed = documentParsing.parseDocument({ subject: "post", text: "body" });
  documentParsing.parseDocument({ subject: "other", text: "other" });

  expect(documentParsing.removeDocument({ subject: "post" })).toEqual({ document: parsed.document });
  expect(documentParsing._document({ subject: "post" })).toEqual([]);
  expect(documentParsing._all().map(({ subject }) => subject)).toEqual(["other"]);
  expect(() => documentParsing.removeDocument({ subject: "post" })).toThrow(DocumentNotFound);
  expect(() => documentParsing.removeDocument({ subject: "post" })).toThrow("There is no document for this subject.");
});

test("registry exposes both declared refusals with their normative messages", async () => {
  const concepts = conceptSet({ DocumentParsing: documentParsing });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  const DocumentParsing = app.concepts.DocumentParsing;

  expect(await DocumentParsing.parseDocument({ subject: "broken", text: "---\ntitle: [\n---\nbody" })).toEqual({
    error: "MALFORMED_ATTRIBUTES",
    detail: "The attributes at the top of this document cannot be parsed.",
  });
  expect(await DocumentParsing.removeDocument({ subject: "missing" })).toEqual({
    error: "DOCUMENT_NOT_FOUND",
    detail: "There is no document for this subject.",
  });
  await app.whenIdle();
});
