import { expect, test } from "bun:test";
import {
  ConfiguringConcept,
  ConfigurationNotFound,
  MalformedConfiguration,
  UnsupportedNotation,
} from "./configuring.ts";

function one<T>(rows: T[]): T {
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

test("its principle: a settings document becomes a stable, ordered, addressable tree", () => {
  const source = `"site.title": literal
site:
  title: Ada's Notes
  "social.handle": "@ada"
defaults:
  - match: "**/*.md"
  - match: "**/*.html"
`;
  const configuring = new ConfiguringConcept();
  const loaded = configuring.load({ source, notation: "yaml" });

  expect(loaded.changed).toBe(true);
  expect(configuring._active()).toEqual([{ configuration: loaded.configuration, root: loaded.root }]);
  expect(configuring._entries({ node: loaded.root }).map(({ key }) => key)).toEqual([
    "site.title",
    "site",
    "defaults",
  ]);

  const literal = one(configuring._child({ node: loaded.root, key: "site.title" }));
  expect(literal).toMatchObject({ kind: "scalar", value: "literal" });
  expect(one(configuring._at({ node: loaded.root, path: ["site.title"] }))).toMatchObject({
    found: literal.child,
    value: "literal",
  });

  const site = one(configuring._child({ node: loaded.root, key: "site" }));
  const title = one(configuring._at({ node: loaded.root, path: ["site", "title"] }));
  expect(title).toMatchObject({ kind: "scalar", value: "Ada's Notes" });
  expect(one(configuring._at({ node: loaded.root, path: [] }))).toMatchObject({ found: loaded.root, kind: "mapping" });
  expect(configuring._scalar({ node: loaded.root, path: ["site", "title"], otherwise: "" })).toEqual([
    { value: "Ada's Notes" },
  ]);
  expect(configuring._record({ node: site.child })).toEqual([
    { values: { title: "Ada's Notes", "social.handle": "@ada" } },
  ]);

  const defaults = one(configuring._child({ node: loaded.root, key: "defaults" }));
  expect(configuring._values({ node: loaded.root, path: ["defaults"], otherwise: [] })).toEqual([
    { values: [{ match: "**/*.md" }, { match: "**/*.html" }] },
  ]);
  const rules = configuring._items({ node: defaults.child });
  expect(rules.map(({ index, value }) => ({ index, value }))).toEqual([
    { index: 0, value: { match: "**/*.md" } },
    { index: 1, value: { match: "**/*.html" } },
  ]);
  expect(configuring._where({ node: loaded.root })).toEqual([{ line: 1, column: 1 }]);
  expect(configuring._where({ node: title.found })).toEqual([{ line: 3, column: 10 }]);
});

test("scalar and container reads have explicit missing and wrong-kind fallbacks", () => {
  const configuring = new ConfiguringConcept();
  const loaded = configuring.load({
    source: "scalar: value\nmapping: { child: value }\nsequence: [one]\nnullish: null\n",
    notation: "yaml",
  });

  expect(configuring._scalar({ node: loaded.root, path: ["scalar"], otherwise: "fallback" })).toEqual([
    { value: "value" },
  ]);
  expect(configuring._scalar({ node: loaded.root, path: ["mapping"], otherwise: "fallback" })).toEqual([
    { value: "fallback" },
  ]);
  expect(configuring._scalar({ node: loaded.root, path: ["missing"], otherwise: false })).toEqual([
    { value: false },
  ]);
  expect(configuring._scalar({ node: loaded.root, path: ["nullish"], otherwise: "fallback" })).toEqual([
    { value: null },
  ]);

  expect(configuring._values({ node: loaded.root, path: ["mapping"], otherwise: [] })).toEqual([
    { values: { child: "value" } },
  ]);
  expect(configuring._values({ node: loaded.root, path: ["sequence"], otherwise: {} })).toEqual([
    { values: ["one"] },
  ]);
  expect(configuring._values({ node: loaded.root, path: ["scalar"], otherwise: [] })).toEqual([
    { values: [] },
  ]);
  expect(configuring._values({ node: loaded.root, path: ["missing"], otherwise: { defaulted: true } })).toEqual([
    { values: { defaulted: true } },
  ]);

  const scalar = one(configuring._child({ node: loaded.root, key: "scalar" }));
  const mapping = one(configuring._child({ node: loaded.root, key: "mapping" }));
  const sequence = one(configuring._child({ node: loaded.root, key: "sequence" }));
  expect(configuring._child({ node: loaded.root, key: "missing" })).toEqual([]);
  expect(configuring._child({ node: scalar.child, key: "anything" })).toEqual([]);
  expect(configuring._at({ node: loaded.root, path: ["missing"] })).toEqual([]);
  expect(configuring._at({ node: loaded.root, path: ["scalar", "anything"] })).toEqual([]);
  expect(configuring._record({ node: mapping.child })).toEqual([{ values: { child: "value" } }]);
  expect(configuring._record({ node: scalar.child })).toEqual([]);
  expect(configuring._entries({ node: sequence.child })).toEqual([]);
  expect(configuring._items({ node: mapping.child })).toEqual([]);
});

test("unknown and discarded nodes make every node query absent", () => {
  const configuring = new ConfiguringConcept();
  const loaded = configuring.load({ source: "known: value\n", notation: "yaml" });
  const unknown = "node:unknown";

  expect(configuring._child({ node: unknown, key: "known" })).toEqual([]);
  expect(configuring._at({ node: unknown, path: [] })).toEqual([]);
  expect(configuring._scalar({ node: unknown, path: [], otherwise: "fallback" })).toEqual([]);
  expect(configuring._values({ node: unknown, path: [], otherwise: [] })).toEqual([]);
  expect(configuring._entries({ node: unknown })).toEqual([]);
  expect(configuring._items({ node: unknown })).toEqual([]);
  expect(configuring._record({ node: unknown })).toEqual([]);
  expect(configuring._where({ node: unknown })).toEqual([]);

  configuring.discard({ configuration: loaded.configuration });
  expect(configuring._at({ node: loaded.root, path: [] })).toEqual([]);
  expect(configuring._scalar({ node: loaded.root, path: ["known"], otherwise: "fallback" })).toEqual([]);
  expect(configuring._where({ node: loaded.root })).toEqual([]);
});

test("aliases expand into independent trees with precise locations and cloned observations", () => {
  const source = `base: &base
  title: Ada
  tags: [one, two]
site: *base
word: &word hello
copy: *word
`;
  const configuring = new ConfiguringConcept();
  const loaded = configuring.load({ source, notation: "yaml" });
  const base = one(configuring._child({ node: loaded.root, key: "base" }));
  const site = one(configuring._child({ node: loaded.root, key: "site" }));

  expect(base.kind).toBe("mapping");
  expect(site).toMatchObject({ kind: "mapping", value: { title: "Ada", tags: ["one", "two"] } });
  expect(site.child).not.toBe(base.child);
  const title = one(configuring._at({ node: site.child, path: ["title"] }));
  expect(title.value).toBe("Ada");
  expect(configuring._where({ node: site.child })).toEqual([{ line: 4, column: 7 }]);
  expect(configuring._where({ node: title.found })).toEqual([{ line: 2, column: 10 }]);
  expect(configuring._scalar({ node: loaded.root, path: ["copy"], otherwise: "" })).toEqual([
    { value: "hello" },
  ]);

  const observed = site.value as { title: string; tags: string[] };
  observed.title = "changed";
  observed.tags.push("changed");
  const record = one(configuring._record({ node: site.child })).values as { title: string; tags: string[] };
  record.title = "also changed";
  const values = one(configuring._values({ node: loaded.root, path: ["site"], otherwise: {} })).values as {
    title: string;
    tags: string[];
  };
  values.tags.length = 0;
  const entry = configuring._entries({ node: site.child })[1]!.value as string[];
  entry.push("changed");
  const tags = one(configuring._at({ node: site.child, path: ["tags"] }));
  const item = configuring._items({ node: tags.found })[0]!;
  expect(item.value).toBe("one");
  expect(one(configuring._child({ node: loaded.root, key: "site" })).value).toEqual({
    title: "Ada",
    tags: ["one", "two"],
  });
});

test("identity and change are deterministic and content-addressed", () => {
  const source = "site: { title: Ada }\n";
  const reformatted = "site: { title: Ada } # comment\n";
  const configuring = new ConfiguringConcept();
  const first = configuring.load({ source, notation: "yaml" });

  expect(configuring.load({ source, notation: "yaml" })).toEqual({ ...first, changed: false });
  const second = configuring.load({ source: reformatted, notation: "yaml" });
  expect(second.changed).toBe(true);
  expect(second.configuration).not.toBe(first.configuration);
  expect(second.root).not.toBe(first.root);

  expect(configuring.load({ source, notation: "yaml" })).toEqual({ ...first, changed: true });
  const other = new ConfiguringConcept();
  const independent = other.load({ source, notation: "yaml" });
  expect(independent).toEqual(first);
  expect(other._entries({ node: independent.root })).toEqual(configuring._entries({ node: first.root }));

  configuring.discard({ configuration: second.configuration });
  expect(configuring._active()).toEqual([{ configuration: first.configuration, root: first.root }]);
  configuring.discard({ configuration: first.configuration });
  expect(configuring._active()).toEqual([]);
  expect(() => configuring.discard({ configuration: first.configuration })).toThrow(ConfigurationNotFound);
  expect(() => configuring.discard({ configuration: first.configuration })).toThrow("There is no such configuration.");
  expect(configuring.load({ source, notation: "yaml" })).toEqual(first);
});

test("invalid and unsupported loads preserve the active configuration", () => {
  const configuring = new ConfiguringConcept();
  const active = configuring.load({ source: "site: { title: Ada }\n", notation: "yaml" });
  const expected = [{ configuration: active.configuration, root: active.root }];

  expect(() => configuring.load({ source: "site: [", notation: "yaml" })).toThrow(MalformedConfiguration);
  expect(() => configuring.load({ source: "site: [", notation: "yaml" })).toThrow(
    "This configuration document cannot be parsed.",
  );
  expect(() => configuring.load({ source: "---\na: 1\n---\nb: 2\n", notation: "yaml" })).toThrow(
    MalformedConfiguration,
  );
  expect(() => configuring.load({ source: "loop: &loop [*loop]\n", notation: "yaml" })).toThrow(
    MalformedConfiguration,
  );
  expect(configuring._active()).toEqual(expected);

  expect(() => configuring.load({ source: "anything", notation: "toml" })).toThrow(UnsupportedNotation);
  expect(() => configuring.load({ source: "anything", notation: "toml" })).toThrow(
    "This configuration notation is not supported.",
  );
  expect(configuring._active()).toEqual(expected);
});

test("only YAML 1.2 Core tags and safe finite numbers are accepted", () => {
  const configuring = new ConfiguringConcept();
  const accepted = configuring.load({
    source: `%YAML 1.2
---
text: !!str 12
empty: !!null null
truth: !!bool true
integer: !!int 9007199254740991
float: !!float 1.5
plain: yes
largeFloat: 1e308
`,
    notation: "yaml",
  });
  expect(configuring._record({ node: accepted.root })).toEqual([
    {
      values: {
        text: "12",
        empty: null,
        truth: true,
        integer: Number.MAX_SAFE_INTEGER,
        float: 1.5,
        plain: "yes",
        largeFloat: 1e308,
      },
    },
  ]);

  const rejected = [
    "value: !widget abc\n",
    "value: !!timestamp 2026-07-29\n",
    "value: !!binary SGVsbG8=\n",
    "%YAML 1.1\n---\nvalue: yes\n",
    "%YAML 1.3\n---\nvalue: yes\n",
    "value: 9007199254740992\n",
    "value: -9007199254740992\n",
    "value: .nan\n",
    "value: .inf\n",
    "value: 1e400\n",
  ];
  for (const source of rejected) {
    expect(() => new ConfiguringConcept().load({ source, notation: "yaml" })).toThrow(MalformedConfiguration);
  }
});

test("mapping keys must be unique strings and are never coerced", () => {
  const configuring = new ConfiguringConcept();
  const accepted = configuring.load({
    source: `"": blank
"1": numeric text
"true": boolean text
"site.title": literal
"__proto__": safe
`,
    notation: "yaml",
  });
  expect(configuring._entries({ node: accepted.root }).map(({ key }) => key)).toEqual([
    "",
    "1",
    "true",
    "site.title",
    "__proto__",
  ]);
  expect(one(configuring._child({ node: accepted.root, key: "__proto__" })).value).toBe("safe");

  const rejected = [
    "same: first\nsame: second\n",
    "1: number\n",
    "true: boolean\n",
    "null: null\n",
    "? [one, two]\n: sequence\n",
    "name: &name site\n*name: value\n",
    "1: number\n\"1\": text\n",
  ];
  for (const source of rejected) {
    expect(() => new ConfiguringConcept().load({ source, notation: "yaml" })).toThrow(MalformedConfiguration);
  }
});

test("alias expansion has a deterministic safety limit", () => {
  const sourceWith = (count: number) => `value: &value okay
copies:
${Array.from({ length: count }, () => "  - *value").join("\n")}
`;
  expect(new ConfiguringConcept().load({ source: sourceWith(100), notation: "yaml" }).changed).toBe(true);
  expect(() => new ConfiguringConcept().load({ source: sourceWith(101), notation: "yaml" })).toThrow(
    MalformedConfiguration,
  );
});

test("empty, scalar, and sequence roots have defined query behavior", () => {
  const empty = new ConfiguringConcept();
  const emptyRoot = empty.load({ source: "", notation: "yaml" }).root;
  expect(empty._at({ node: emptyRoot, path: [] })).toEqual([{ found: emptyRoot, kind: "scalar", value: null }]);
  expect(empty._scalar({ node: emptyRoot, path: [], otherwise: "fallback" })).toEqual([{ value: null }]);
  expect(empty._values({ node: emptyRoot, path: [], otherwise: [] })).toEqual([{ values: [] }]);
  expect(empty._record({ node: emptyRoot })).toEqual([]);
  expect(empty._where({ node: emptyRoot })).toEqual([{ line: 1, column: 1 }]);

  const scalar = new ConfiguringConcept();
  const scalarRoot = scalar.load({ source: "Ada\n", notation: "yaml" }).root;
  expect(scalar._scalar({ node: scalarRoot, path: [], otherwise: "" })).toEqual([{ value: "Ada" }]);

  const sequence = new ConfiguringConcept();
  const sequenceRoot = sequence.load({ source: "- one\n- two\n", notation: "yaml" }).root;
  expect(sequence._values({ node: sequenceRoot, path: [], otherwise: [] })).toEqual([{ values: ["one", "two"] }]);
  expect(sequence._items({ node: sequenceRoot }).map(({ index, value }) => ({ index, value }))).toEqual([
    { index: 0, value: "one" },
    { index: 1, value: "two" },
  ]);
});
