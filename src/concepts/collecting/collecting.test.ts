import { expect, test } from "bun:test";
import {
  CollectingConcept,
  CollectionNotFound,
  InvalidCard,
  InvalidDirection,
  InvalidSortKey,
  InvalidText,
  NotIncluded,
  type NormalizedValue,
} from "./collecting.ts";
import { collecting } from "./registry.ts";

function declare(collecting: CollectingConcept, name = "favorites", direction = "asc") {
  return collecting.declare({ name, direction }).collection;
}

function add(
  collecting: CollectingConcept,
  collection: string,
  item: string,
  key: unknown,
  tiebreak = item,
  card: Record<string, unknown> = { label: item },
) {
  return collecting.include({ collection, item, key, tiebreak, card });
}

function items(collecting: CollectingConcept, collection: string): string[] {
  return collecting._items({ collection }).map(({ item }) => item);
}

test("declarations validate direction, report changes, retain entries, and keep stable identities", () => {
  const collecting = new CollectingConcept();
  const first = collecting.declare({ name: "scores", direction: "asc" });
  expect(first.changed).toBe(true);
  add(collecting, first.collection, "low", 1);
  add(collecting, first.collection, "high", 2);

  expect(collecting.declare({ name: "scores", direction: "asc" })).toEqual({ collection: first.collection, changed: false });
  expect(collecting.declare({ name: "scores", direction: "desc" })).toEqual({ collection: first.collection, changed: true });
  expect(items(collecting, first.collection)).toEqual(["high", "low"]);
  expect(collecting._named({ name: "scores" })).toEqual([{ collection: first.collection, direction: "desc" }]);
  expect(collecting._named({ name: "absent" })).toEqual([]);

  expect(() => collecting.declare({ name: "scores", direction: "sideways" })).toThrow(InvalidDirection);
  expect(collecting._named({ name: "scores" })[0]?.direction).toBe("desc");
});

test("inclusion compares normalized keys, tiebreaks, and cards and preserves entry identity", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  const first = add(collecting, collection, "one", { b: -0, a: [true] }, "label", { b: 2, a: { value: 1 } });
  expect(first.changed).toBe(true);

  const same = add(collecting, collection, "one", { a: [true], b: 0 }, "label", { a: { value: 1 }, b: 2 });
  expect(same).toEqual({ entry: first.entry, changed: false });
  expect(add(collecting, collection, "one", { a: [false], b: 0 }, "label", { a: { value: 1 }, b: 2 })).toEqual({ entry: first.entry, changed: true });
  expect(add(collecting, collection, "one", { a: [false], b: 0 }, "other", { a: { value: 1 }, b: 2 })).toEqual({ entry: first.entry, changed: true });
  expect(add(collecting, collection, "one", { a: [false], b: 0 }, "other", { a: { value: 2 }, b: 2 })).toEqual({ entry: first.entry, changed: true });

  collecting.exclude({ collection, item: "one" });
  expect(add(collecting, collection, "one", null).entry).toBe(first.entry);
});

test("ascending and descending order every supported value kind and leave missing keys last", () => {
  const collecting = new CollectingConcept();
  const ascending = declare(collecting, "ascending", "asc");
  const descending = declare(collecting, "descending", "desc");
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
    ["false-list", [false]],
    ["empty-record", {}],
    ["null-record", { a: null }],
    ["false-record", { a: false }],
    ["missing", undefined],
  ];
  for (const [item, key] of [...values].reverse()) {
    add(collecting, ascending, item, key);
    add(collecting, descending, item, key);
  }

  const expected = values.map(([item]) => item);
  expect(items(collecting, ascending)).toEqual(expected);
  expect(items(collecting, descending)).toEqual([...expected.slice(0, -1)].reverse().concat("missing"));
  expect(collecting._items({ collection: ascending }).at(-1)).toMatchObject({ item: "missing", key: undefined });
});

test("equal keys and tiebreaks use item identity for arrival-independent total order", () => {
  const ordered = (arrival: string[], direction: "asc" | "desc") => {
    const collecting = new CollectingConcept();
    const collection = declare(collecting, "same", direction);
    for (const item of arrival) add(collecting, collection, item, { score: 1 }, "same");
    return items(collecting, collection);
  };

  for (const arrival of [
    ["b", "é", "a"],
    ["é", "a", "b"],
    ["a", "b", "é"],
  ]) {
    expect(ordered(arrival, "asc")).toEqual(["a", "b", "é"]);
    expect(ordered(arrival, "desc")).toEqual(["a", "b", "é"]);
  }
});

test("tiebreak text stays ascending in UTF-8 order for both directions", () => {
  for (const direction of ["asc", "desc"] as const) {
    const collecting = new CollectingConcept();
    const collection = declare(collecting, `ties-${direction}`, direction);
    add(collecting, collection, "accent", 1, "é");
    add(collecting, collection, "second", 1, "b");
    add(collecting, collection, "first", 1, "a");
    expect(items(collecting, collection)).toEqual(["first", "second", "accent"]);
  }
});

test("record comparison uses UTF-8 key order even for integer-like property names", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  add(collecting, collection, "two", { "2": null });
  add(collecting, collection, "ten", { "10": null });
  expect(items(collecting, collection)).toEqual(["ten", "two"]);
});

test("missing keys may be omitted or undefined and sort by tiebreak then item", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  collecting.include({ collection, item: "missing-b", tiebreak: "same", card: {} });
  collecting.include({ collection, item: "missing-a", key: undefined, tiebreak: "same", card: {} });
  add(collecting, collection, "present", null);

  expect(items(collecting, collection)).toEqual(["present", "missing-a", "missing-b"]);
  const missing = collecting._items({ collection }).slice(1);
  expect(missing.map(({ key }) => key)).toEqual([undefined, undefined]);
  expect(missing.every((entry) => Object.hasOwn(entry, "key"))).toBe(true);
});

test("catalog, membership, and positions are ordered, complete, and safe for arbitrary names", () => {
  const collecting = new CollectingConcept();
  const constructor = declare(collecting, "constructor");
  const proto = declare(collecting, "__proto__");
  const alpha = declare(collecting, "alpha");
  add(collecting, constructor, "shared", 2, "b", { label: "second" });
  add(collecting, constructor, "first", 1, "a", { label: "first" });
  add(collecting, proto, "shared", 1, "a", { label: "proto" });
  add(collecting, alpha, "shared", 1, "a", { label: "alpha" });

  expect(collecting._collections().map(({ name }) => name)).toEqual(["__proto__", "alpha", "constructor"]);
  expect(collecting._membership({ item: "shared" }).map(({ name }) => name)).toEqual(["__proto__", "alpha", "constructor"]);
  expect(collecting._position({ collection: constructor, item: "first" })).toEqual([{ index: 0 }]);
  expect(collecting._position({ collection: constructor, item: "absent" })).toEqual([]);

  const catalog = collecting._catalog().collections;
  expect(Object.hasOwn(catalog, "__proto__")).toBe(true);
  expect(Object.hasOwn(catalog, "constructor")).toBe(true);
  expect(Object.keys(catalog)).toEqual(["__proto__", "alpha", "constructor"]);
  expect(catalog["constructor"]).toEqual([{ label: "first" }, { label: "second" }]);
  expect(catalog["__proto__"]).toEqual([{ label: "proto" }]);
});

test("opaque identities do not collide for delimiter-like names and items", () => {
  const collecting = new CollectingConcept();
  const first = declare(collecting, "a:b");
  const second = declare(collecting, "a");
  const firstEntry = add(collecting, first, "c", 1);
  const secondEntry = add(collecting, second, "b:c", 1);
  const nul = declare(collecting, "a\u0000b");
  const nulEntry = add(collecting, nul, "c\u0000d", 1);

  expect(new Set([first, second, nul]).size).toBe(3);
  expect(new Set([firstEntry.entry, secondEntry.entry, nulEntry.entry]).size).toBe(3);
});

test("keys and cards are cloned on input and every query output", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  const key = { ranks: [1, 2] };
  const card = { details: { labels: ["kept"] } };
  add(collecting, collection, "one", key, "one", card);

  key.ranks.push(3);
  card.details.labels[0] = "changed";
  const first = collecting._items({ collection })[0]!;
  expect(first.key).toEqual({ ranks: [1, 2] });
  expect(first.card).toEqual({ details: { labels: ["kept"] } });

  (first.key as { ranks: number[] }).ranks.push(4);
  (first.card.details as { labels: string[] }).labels[0] = "changed again";
  (collecting._catalog().collections.favorites as Record<string, unknown>[])[0]!.details = "changed in catalog";
  expect(collecting._items({ collection })[0]).toEqual({ item: "one", key: { ranks: [1, 2] }, card: { details: { labels: ["kept"] } } });
});

test("exclude, withdraw, and reset have exact lifecycle and count behavior", () => {
  const collecting = new CollectingConcept();
  const first = declare(collecting, "first");
  const second = declare(collecting, "second");
  const entry = add(collecting, first, "shared", 1);
  add(collecting, second, "shared", 1);
  add(collecting, second, "kept", 2);

  expect(collecting.exclude({ collection: first, item: "shared" })).toEqual({ entry: entry.entry });
  expect(() => collecting.exclude({ collection: first, item: "shared" })).toThrow(NotIncluded);
  expect(collecting.withdraw({ item: "shared" })).toEqual({ item: "shared", count: 1 });
  expect(collecting.withdraw({ item: "shared" })).toEqual({ item: "shared", count: 0 });
  expect(items(collecting, second)).toEqual(["kept"]);

  expect(collecting.reset()).toEqual({ count: 2 });
  expect(collecting.reset()).toEqual({ count: 0 });
  expect(collecting._collections()).toEqual([]);
  expect(Object.keys(collecting._catalog().collections)).toEqual([]);
  expect(collecting._items({ collection: second })).toEqual([]);
  expect(() => add(collecting, second, "late", 1)).toThrow(CollectionNotFound);
  expect(declare(collecting, "second")).toBe(second);
});

test("include refuses unsupported keys and cards without changing state", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const sparse = Array(1);
  const decorated = Object.assign([], { extra: true });
  const invalidKeys = [NaN, Infinity, -Infinity, 1n, new Date(), { value: undefined }, sparse, decorated, cyclic];
  for (const key of invalidKeys) expect(() => add(collecting, collection, `key-${String(key)}`, key)).toThrow(InvalidSortKey);

  expect(() => collecting.include({ collection, item: "array-card", key: 1, tiebreak: "a", card: [] as unknown as Record<string, unknown> })).toThrow(InvalidCard);
  expect(() => collecting.include({ collection, item: "invalid-card", key: 1, tiebreak: "b", card: { value: undefined } })).toThrow(InvalidCard);
  expect(() => collecting.include({ collection, item: "non-finite-card", key: 1, tiebreak: "c", card: { value: Infinity } })).toThrow(InvalidCard);
  expect(items(collecting, collection)).toEqual([]);
});

test("value validation rejects nonstandard arrays, proxies, and failing reflection", () => {
  class ArraySubclass extends Array<unknown> {}

  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  const subclass = new ArraySubclass(1, 2);
  const changedPrototype = [1, 2];
  Object.setPrototypeOf(changedPrototype, null);
  const forwardingProxy = new Proxy({ value: 1 }, {});
  const throwingProxy = new Proxy({}, { ownKeys: () => { throw new Error("ownKeys failed"); } });
  const revoked = Proxy.revocable({ value: 1 }, {});
  revoked.revoke();

  for (const key of [subclass, changedPrototype, forwardingProxy, throwingProxy, revoked.proxy]) {
    expect(() => add(collecting, collection, "invalid", key)).toThrow(InvalidSortKey);
  }
  expect(() => collecting.include({ collection, item: "array-subclass", key: 1, tiebreak: "a", card: { value: subclass } })).toThrow(InvalidCard);
  expect(() => collecting.include({ collection, item: "proxy", key: 1, tiebreak: "b", card: forwardingProxy })).toThrow(InvalidCard);
  expect(items(collecting, collection)).toEqual([]);
});

test("value validation enforces record and list property rules", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => 1 });
  const hidden = Object.defineProperty({}, "value", { enumerable: false, value: 1 });
  const symbol = { [Symbol("value")]: 1 };
  const decorated = Object.assign([1], { extra: true });

  for (const key of [accessor, hidden, symbol, decorated]) {
    expect(() => add(collecting, collection, "invalid", key)).toThrow(InvalidSortKey);
  }
  expect(items(collecting, collection)).toEqual([]);
});

test("plain and null-prototype records normalize to the same structural value", () => {
  const collecting = new CollectingConcept();
  const collection = declare(collecting);
  const key = Object.create(null) as Record<string, unknown>;
  key.value = 1;
  const first = add(collecting, collection, "one", key);

  expect(add(collecting, collection, "one", { value: 1 })).toEqual({ entry: first.entry, changed: false });
  expect(collecting._items({ collection })[0]?.key).toEqual({ value: 1 });
});

test("actions require well-formed text while lookup queries safely reject other runtime values", () => {
  const collecting = new CollectingConcept();
  const malformed = "\ud800";
  const malformedRecord = Object.defineProperty({}, malformed, { enumerable: true, value: 1 });

  expect(() => collecting.declare({ name: 1, direction: "asc" })).toThrow(InvalidText);
  expect(() => collecting.declare({ name: malformed, direction: "asc" })).toThrow(InvalidText);
  const collection = declare(collecting);
  expect(() => collecting.include({ collection: 1, item: "one", key: 1, tiebreak: "one", card: {} })).toThrow(InvalidText);
  expect(() => collecting.include({ collection, item: 1, key: 1, tiebreak: "one", card: {} })).toThrow(InvalidText);
  expect(() => collecting.include({ collection, item: "one", key: 1, tiebreak: malformed, card: {} })).toThrow(InvalidText);
  expect(() => add(collecting, collection, "one", malformed)).toThrow(InvalidSortKey);
  expect(() => add(collecting, collection, "one", malformedRecord)).toThrow(InvalidSortKey);
  expect(() => collecting.include({ collection, item: "one", key: 1, tiebreak: "one", card: { malformed } })).toThrow(InvalidCard);
  expect(() => collecting.exclude({ collection, item: 1 })).toThrow(InvalidText);
  expect(() => collecting.withdraw({ item: 1 })).toThrow(InvalidText);

  expect(collecting._named({ name: 1 })).toEqual([]);
  expect(collecting._items({ collection: 1 })).toEqual([]);
  expect(collecting._membership({ item: 1 })).toEqual([]);
  expect(collecting._position({ collection, item: 1 })).toEqual([]);
  expect(collecting._collections()).toEqual([{ collection, name: "favorites", direction: "asc" }]);
});

test("refusals prioritize missing collections and registry mappings match the specification", () => {
  const collectingConcept = new CollectingConcept();
  expect(() => collectingConcept.include({ collection: "absent", item: "one", key: NaN, tiebreak: "one", card: { value: undefined } })).toThrow(CollectionNotFound);

  expect(collecting.refusals).toEqual({
    INVALID_TEXT: InvalidText,
    INVALID_DIRECTION: InvalidDirection,
    COLLECTION_NOT_FOUND: CollectionNotFound,
    INVALID_SORT_KEY: InvalidSortKey,
    INVALID_CARD: InvalidCard,
    NOT_INCLUDED: NotIncluded,
  });
  expect(collecting.specification.actions.flatMap(({ refusals }) => refusals.map(({ code, message }) => [code, message]))).toEqual([
    ["INVALID_TEXT", "Names, identities, and tiebreaks must be text."],
    ["INVALID_DIRECTION", "Direction must be asc or desc."],
    ["INVALID_TEXT", "Names, identities, and tiebreaks must be text."],
    ["COLLECTION_NOT_FOUND", "There is no such collection."],
    ["INVALID_SORT_KEY", "A sort key must be missing or a supported value."],
    ["INVALID_CARD", "A card must be a record of supported values."],
    ["INVALID_TEXT", "Names, identities, and tiebreaks must be text."],
    ["NOT_INCLUDED", "This item is not in that collection."],
    ["INVALID_TEXT", "Names, identities, and tiebreaks must be text."],
  ]);
});
