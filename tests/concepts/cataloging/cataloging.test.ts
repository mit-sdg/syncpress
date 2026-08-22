import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  CatalogingConcept,
  CatalogNotFound,
  InvalidCard,
  InvalidCondition,
  InvalidDirection,
  InvalidField,
  InvalidSelector,
  InvalidText,
  NotIncluded,
  type CatalogCondition,
  type NormalizedValue,
} from "@concepts/cataloging/cataloging.ts";
import { cataloging as catalogingRegistration } from "@concepts/cataloging/registry.ts";

function declare(
  cataloging: CatalogingConcept,
  name = "favorites",
  direction: "asc" | "desc" = "asc",
  sort: string | null = "data.score",
  condition: CatalogCondition | null = null,
) {
  return cataloging.declare({ name, selector: "**/*", direction, sort, condition }).catalog;
}

function index(
  cataloging: CatalogingConcept,
  catalog: string,
  item: string,
  value: unknown,
  tiebreak = item,
  extra: Record<string, unknown> = {},
) {
  return cataloging.index({ catalog, item, path: tiebreak, tiebreak, card: { data: { score: value }, ...extra } });
}

function items(cataloging: CatalogingConcept, catalog: string): string[] {
  return cataloging._entries({ catalog }).map(({ item }) => item);
}

test("its principle: policies admit complete cards, derive order, and reconcile re-indexing", () => {
  const cataloging = new CatalogingConcept();
  const newest = declare(cataloging, "newest", "desc", "data.date");
  const featured = declare(cataloging, "featured", "asc", "data.title", {
    test: "equals",
    field: "data.featured",
    value: true,
  });
  const first = { data: { title: "First", date: "2026-01-01", featured: true } };
  const second = { data: { title: "Second", date: "2026-02-01", featured: false } };

  expect(cataloging.index({ catalog: newest, item: "first", path: "first", tiebreak: "first", card: first })).toMatchObject({
    included: true,
    changed: true,
  });
  cataloging.index({ catalog: newest, item: "second", path: "second", tiebreak: "second", card: second });
  expect(items(cataloging, newest)).toEqual(["second", "first"]);
  expect(cataloging.index({ catalog: featured, item: "first", path: "first", tiebreak: "first", card: first })).toMatchObject({
    included: true,
    changed: true,
  });
  expect(cataloging.index({ catalog: featured, item: "second", path: "second", tiebreak: "second", card: second })).toMatchObject({
    included: false,
    changed: false,
  });
  expect(cataloging.index({
    catalog: featured,
    item: "first",
    path: "first",
    tiebreak: "first",
    card: { data: { ...first.data, featured: false } },
  })).toMatchObject({ included: false, changed: true });
  expect(items(cataloging, featured)).toEqual([]);
});

test("declarations validate complete policy, report changes, and retain stable identities", () => {
  const cataloging = new CatalogingConcept();
  const first = cataloging.declare({ name: "scores", selector: "**/*", direction: "asc", sort: "data.score", condition: null });
  index(cataloging, first.catalog, "low", 1);
  index(cataloging, first.catalog, "high", 2);

  expect(cataloging.declare({ name: "scores", selector: "**/*", direction: "asc", sort: "data.score", condition: null })).toEqual({
    catalog: first.catalog,
    changed: false,
  });
  expect(cataloging.declare({ name: "scores", selector: "**/*", direction: "desc", sort: "data.score", condition: null })).toEqual({
    catalog: first.catalog,
    changed: true,
  });
  expect(items(cataloging, first.catalog)).toEqual(["high", "low"]);
  expect(() => cataloging.declare({ name: "scores", selector: "**/*", direction: "sideways", sort: null, condition: null })).toThrow(
    InvalidDirection,
  );
  expect(() => cataloging.declare({ name: "scores", selector: "**/*", direction: "asc", sort: "data..score", condition: null })).toThrow(
    InvalidField,
  );
  expect(() => cataloging.declare({
    name: "scores",
    selector: "**/*",
    direction: "asc",
    sort: null,
    condition: { test: "exists", field: "data.score", value: true },
  })).toThrow(InvalidCondition);
  const accessor = Object.defineProperty({}, "field", { enumerable: true, get: () => "data.score" });
  const proxy = new Proxy({ test: "exists", field: "data.score" }, {});
  for (const condition of [accessor, proxy]) {
    expect(() => cataloging.declare({ name: "scores", selector: "**/*", direction: "asc", sort: null, condition })).toThrow(
      InvalidCondition,
    );
  }
  expect(cataloging._named({ name: "scores" })[0]?.direction).toBe("desc");
});

test("selectors atomically admit, remove, and re-evaluate retained cards", () => {
  const cataloging = new CatalogingConcept();
  const declared = cataloging.declare({
    name: "posts",
    selector: "posts/**",
    direction: "asc",
    sort: null,
    condition: null,
  });
  expect(cataloging.index({
    catalog: declared.catalog,
    item: "post",
    path: "posts/one.md",
    tiebreak: "posts/one.md",
    card: { title: "Post" },
  })).toMatchObject({ included: true, changed: true });
  expect(cataloging.index({
    catalog: declared.catalog,
    item: "page",
    path: "about.md",
    tiebreak: "about.md",
    card: { title: "About" },
  })).toMatchObject({ included: false, changed: false });

  expect(cataloging.declare({
    name: "posts",
    selector: "notes/**",
    direction: "asc",
    sort: null,
    condition: null,
  })).toEqual({ catalog: declared.catalog, changed: true });
  expect(cataloging._entries({ catalog: declared.catalog })).toEqual([]);
  expect(() => cataloging.declare({
    name: "posts",
    selector: "posts/**{",
    direction: "asc",
    sort: null,
    condition: null,
  })).toThrow(InvalidSelector);
  expect(cataloging._named({ name: "posts" })[0]?.selector).toBe("notes/**");
});

test("equals, contains, and exists use safe own-property field traversal", () => {
  const cataloging = new CatalogingConcept();
  const policies: Array<[string, CatalogCondition, boolean]> = [
    ["equals", { test: "equals", field: "data.metadata", value: { first: 1, second: 2 } }, true],
    ["contains-list", { test: "contains", field: "data.topics", value: { name: "semantics" } }, true],
    ["contains-text", { test: "contains", field: "data.title", value: "Design" }, true],
    ["exists", { test: "exists", field: "data.empty" }, true],
    ["missing", { test: "exists", field: "data.missing" }, false],
  ];
  const card = {
    data: {
      metadata: { second: 2, first: 1 },
      topics: ["compilers", { name: "semantics" }],
      title: "Compiler Design",
      empty: null,
    },
  };

  for (const [name, condition, included] of policies) {
    const catalog = declare(cataloging, name, "asc", null, condition);
    expect(cataloging.index({ catalog, item: "page", path: "page", tiebreak: "page", card }).included).toBe(included);
  }
});

test("ascending and descending order every value kind and leave missing fields last", () => {
  const cataloging = new CatalogingConcept();
  const ascending = declare(cataloging, "ascending");
  const descending = declare(cataloging, "descending", "desc");
  const values: [string, NormalizedValue | undefined][] = [
    ["null", null],
    ["false", false],
    ["true", true],
    ["negative", -2],
    ["positive", 4],
    ["text-a", "a"],
    ["text-accent", "é"],
    ["empty-list", []],
    ["null-list", [null]],
    ["empty-record", {}],
    ["null-record", { a: null }],
    ["missing", undefined],
  ];
  for (const [item, value] of [...values].reverse()) {
    const card = value === undefined ? { data: {} } : { data: { score: value } };
    cataloging.index({ catalog: ascending, item, path: item, tiebreak: item, card });
    cataloging.index({ catalog: descending, item, path: item, tiebreak: item, card });
  }

  const expected = values.map(([item]) => item);
  expect(items(cataloging, ascending)).toEqual(expected);
  expect(items(cataloging, descending)).toEqual([...expected.slice(0, -1)].reverse().concat("missing"));
});

test("tiebreak and item identity make order arrival-independent in both directions", () => {
  for (const direction of ["asc", "desc"] as const) {
    const cataloging = new CatalogingConcept();
    const catalog = declare(cataloging, direction, direction);
    index(cataloging, catalog, "é", 1, "same");
    index(cataloging, catalog, "b", 1, "same");
    index(cataloging, catalog, "a", 1, "same");
    expect(items(cataloging, catalog)).toEqual(["a", "b", "é"]);
  }
});

test("records normalize, inputs and query results clone, and arbitrary catalog names stay safe", () => {
  const cataloging = new CatalogingConcept();
  const constructor = declare(cataloging, "constructor");
  const proto = declare(cataloging, "__proto__");
  const score = { ranks: [1, 2] };
  const card = { data: { score }, details: { labels: ["kept"] } };
  cataloging.index({ catalog: constructor, item: "one", path: "one", tiebreak: "one", card });
  cataloging.index({ catalog: proto, item: "two", path: "two", tiebreak: "two", card: { data: { score: 1 } } });
  score.ranks.push(3);
  card.details.labels[0] = "changed";

  const observed = cataloging._entries({ catalog: constructor })[0]!.card;
  expect(observed).toEqual({ data: { score: { ranks: [1, 2] } }, details: { labels: ["kept"] } });
  (observed.details as { labels: string[] }).labels.push("changed");
  expect(cataloging._entries({ catalog: constructor })[0]!.card).toEqual({
    data: { score: { ranks: [1, 2] } },
    details: { labels: ["kept"] },
  });
  const record = cataloging._record().catalogs;
  expect(Object.keys(record)).toEqual(["__proto__", "constructor"]);
  expect(Object.hasOwn(record, "__proto__")).toBe(true);
});

test("invalid cards, proxies, cycles, and malformed text refuse atomically", () => {
  const cataloging = new CatalogingConcept();
  const catalog = declare(cataloging);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const sparse = Array(1);
  const decorated = Object.assign([], { extra: true });
  const proxy = new Proxy({ value: 1 }, {});
  for (const card of [[], { value: undefined }, { value: Infinity }, cyclic, { sparse }, { decorated }, proxy]) {
    expect(() => cataloging.index({ catalog, item: "invalid", path: "invalid", tiebreak: "invalid", card })).toThrow(InvalidCard);
  }
  expect(items(cataloging, catalog)).toEqual([]);
  expect(() => cataloging.index({ catalog: 1, item: "one", path: "one", tiebreak: "one", card: {} })).toThrow(InvalidText);
  expect(() => cataloging.withdraw({ item: "\ud800" })).toThrow(InvalidText);
});

test("unindex, catalog removal, withdrawal, reset, membership, and positions cover the complete lifecycle", () => {
  const cataloging = new CatalogingConcept();
  const first = declare(cataloging, "first", "asc", null);
  const second = declare(cataloging, "second", "asc", null);
  const entry = index(cataloging, first, "shared", 1).entry;
  index(cataloging, second, "shared", 1);
  index(cataloging, second, "kept", 2);

  expect(cataloging._membership({ item: "shared" }).map(({ name }) => name)).toEqual(["first", "second"]);
  expect(cataloging._position({ catalog: first, item: "shared" })).toEqual([{ index: 0 }]);
  expect(cataloging.unindex({ catalog: first, item: "shared" })).toEqual({ entry });
  expect(() => cataloging.unindex({ catalog: first, item: "shared" })).toThrow(NotIncluded);
  expect(cataloging.removeCatalog({ name: "first" })).toEqual({ catalog: first, count: 0 });
  expect(() => cataloging.removeCatalog({ name: "first" })).toThrow(CatalogNotFound);
  expect(cataloging.withdraw({ item: "shared" })).toEqual({ item: "shared", count: 1 });
  expect(cataloging.withdraw({ item: "shared" })).toEqual({ item: "shared", count: 0 });
  expect(cataloging.reset()).toEqual({ count: 1 });
  expect(cataloging.reset()).toEqual({ count: 0 });
  expect(cataloging._catalogs()).toEqual([]);
  expect(() => index(cataloging, second, "late", 1)).toThrow(CatalogNotFound);
  expect(declare(cataloging, "second", "asc", null)).toBe(second);
});

test("registry exposes every declared refusal with its normative message", async () => {
  const concepts = conceptSet({ Cataloging: catalogingRegistration });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  const Cataloging = app.concepts.Cataloging;

  expect(await Cataloging.declare({ name: "pages", selector: "**/*", direction: "sideways", sort: null, condition: null })).toEqual({
    error: "INVALID_DIRECTION",
    detail: "Direction must be asc or desc.",
  });
  expect(await Cataloging.declare({ name: "pages", selector: "**/*", direction: "asc", sort: "data..date", condition: null })).toEqual({
    error: "INVALID_FIELD",
    detail: "A configured field must use dotted ASCII segments.",
  });
  expect(catalogingRegistration.refusals).toEqual({
    INVALID_TEXT: InvalidText,
    INVALID_DIRECTION: InvalidDirection,
    INVALID_SELECTOR: InvalidSelector,
    CATALOG_NOT_FOUND: CatalogNotFound,
    INVALID_FIELD: InvalidField,
    INVALID_CONDITION: InvalidCondition,
    INVALID_CARD: InvalidCard,
    NOT_INCLUDED: NotIncluded,
  });
  await app.whenIdle();
});
