import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidRank,
  InvalidValues,
  LayeringConcept,
  NoSuchLayer,
  RankTaken,
  type LayerValues,
} from "../../../src/concepts/layering/layering.ts";
import { layering } from "../../../src/concepts/layering/registry.ts";

function one<T>(rows: T[]): T {
  expect(rows).toHaveLength(1);
  return rows[0]!;
}

function layerID(subject: string, rank: number): string {
  return `layer:${JSON.stringify([subject, Object.is(rank, -0) ? 0 : rank])}`;
}

function ownRecord(entries: ReadonlyArray<readonly [string, unknown]>): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
  }
  return record;
}

test("its principle: a deployment override refines tool defaults and remains explainable", () => {
  const layering = new LayeringConcept();
  layering.contribute({
    subject: "tool",
    rank: 10,
    values: { output: "preview", endpoint: { host: "localhost", protocol: "http" }, formats: ["html"] },
  });
  layering.contribute({
    subject: "tool",
    rank: 20,
    values: { output: "production", endpoint: { port: 443 }, formats: ["html", "xml"] },
  });

  expect(layering._resolved({ subject: "tool" })).toEqual({
    values: {
      output: "production",
      endpoint: { host: "localhost", protocol: "http", port: 443 },
      formats: ["html", "xml"],
    },
  });
  expect(layering._origin({ subject: "tool", path: ["output"] })).toEqual([
    { rank: 20, layer: layerID("tool", 20) },
  ]);
  expect(layering._origin({ subject: "tool", path: ["endpoint", "host"] })).toEqual([
    { rank: 10, layer: layerID("tool", 10) },
  ]);
  expect(layering._leafOrigins({ subject: "tool" })).toContainEqual({
    path: ["endpoint", "host"],
    rank: 10,
    layer: layerID("tool", 10),
  });

  layering.withdraw({ subject: "tool", rank: 20 });
  expect(layering._value({ subject: "tool", path: ["output"] })).toEqual([{ value: "preview" }]);
  expect(() => layering.contribute({ subject: "tool", rank: 10, values: {} })).toThrow(RankTaken);
});

test("rank order, not arrival order, determines resolution and layer listings", () => {
  const contributions = [
    { rank: -5, values: { profile: { base: true, name: "first" }, order: "low" } },
    { rank: 2.5, values: { profile: { name: "middle", details: { one: 1 } }, order: "middle" } },
    { rank: 100, values: { profile: { details: { two: 2 } }, order: "high" } },
  ];
  const first = new LayeringConcept();
  const second = new LayeringConcept();
  for (const contribution of [contributions[2]!, contributions[0]!, contributions[1]!]) {
    first.contribute({ subject: "s", ...contribution });
  }
  for (const contribution of contributions) second.contribute({ subject: "s", ...contribution });

  const expected = {
    values: {
      profile: { base: true, name: "middle", details: { one: 1, two: 2 } },
      order: "high",
    },
  };
  expect(first._resolved({ subject: "s" })).toEqual(expected);
  expect(second._resolved({ subject: "s" })).toEqual(expected);
  expect(first._layers({ subject: "s" })).toEqual(second._layers({ subject: "s" }));
  expect(first._layers({ subject: "s" }).map(({ rank }) => rank)).toEqual([-5, 2.5, 100]);
});

test("mappings merge deeply while sequences, scalars, and null replace whole values", () => {
  const layering = new LayeringConcept();
  layering.contribute({
    subject: "s",
    rank: 0,
    values: {
      profile: {
        contact: { email: "old@example.test", phone: "123" },
        labels: ["old", "kept only as a whole"],
        active: true,
        note: "present",
      },
      untouched: { value: 1 },
    },
  });
  layering.contribute({
    subject: "s",
    rank: 1,
    values: {
      profile: {
        contact: { email: "new@example.test" },
        labels: ["new"],
        active: null,
        note: { now: "a mapping" },
      },
    },
  });
  layering.contribute({ subject: "s", rank: 2, values: { untouched: "replaced" } });

  expect(layering._resolved({ subject: "s" })).toEqual({
    values: {
      profile: {
        contact: { email: "new@example.test", phone: "123" },
        labels: ["new"],
        active: null,
        note: { now: "a mapping" },
      },
      untouched: "replaced",
    },
  });
  expect(layering._value({ subject: "s", path: ["profile", "active"] })).toEqual([{ value: null }]);
  expect(layering._value({ subject: "s", path: ["profile", "labels", "0"] })).toEqual([]);
});

test("paths use literal mapping-key segments and define every absence edge", () => {
  const special = ownRecord([
    ["", "empty"],
    ["a.b", "literal dot"],
    ["a", { b: "nested" }],
    ["__proto__", "proto value"],
    ["constructor", "constructor value"],
    ["prototype", "prototype value"],
    ["list", ["zero"]],
    ["scalar", "text"],
    ["nil", null],
    ["enabled", false],
  ]);
  const layering = new LayeringConcept();
  layering.contribute({ subject: "s", rank: 0, values: special });

  const expected = ownRecord([
    ["", "empty"],
    ["a.b", "literal dot"],
    ["a", { b: "nested" }],
    ["__proto__", "proto value"],
    ["constructor", "constructor value"],
    ["prototype", "prototype value"],
    ["list", ["zero"]],
    ["scalar", "text"],
    ["nil", null],
    ["enabled", false],
  ]) as LayerValues;
  expect(layering._value({ subject: "s", path: [] })).toEqual([{ value: expected }]);
  expect(layering._value({ subject: "s", path: ["a.b"] })).toEqual([{ value: "literal dot" }]);
  expect(layering._value({ subject: "s", path: ["a", "b"] })).toEqual([{ value: "nested" }]);
  expect(layering._value({ subject: "s", path: [""] })).toEqual([{ value: "empty" }]);
  expect(layering._value({ subject: "s", path: ["__proto__"] })).toEqual([{ value: "proto value" }]);
  expect(layering._value({ subject: "s", path: ["constructor"] })).toEqual([{ value: "constructor value" }]);
  expect(layering._value({ subject: "s", path: ["prototype"] })).toEqual([{ value: "prototype value" }]);
  expect(layering._value({ subject: "s", path: ["missing"] })).toEqual([]);
  expect(layering._value({ subject: "s", path: ["scalar", "child"] })).toEqual([]);
  expect(layering._value({ subject: "s", path: ["list", "0"] })).toEqual([]);
  expect(layering._value({ subject: "s", path: ["nil"] })).toEqual([{ value: null }]);
  expect(layering._flag({ subject: "s", path: ["enabled"], otherwise: true })).toEqual({ value: false });
  expect(layering._flag({ subject: "s", path: ["missing"], otherwise: true })).toEqual({ value: true });
  expect(layering._flag({ subject: "s", path: ["scalar"], otherwise: true })).toEqual({ value: true });
  expect(layering._origin({ subject: "s", path: [] })).toEqual([]);

  const sparse = new Array<string>(2);
  sparse[0] = "a";
  const decorated = ["a"];
  Object.defineProperty(decorated, "extra", { value: true, enumerable: true });
  const accessor = ["a"];
  Object.defineProperty(accessor, "0", { get: () => "a", enumerable: true });
  const subclass = new (class extends Array<string> {})("a");
  const reflectiveFailure = new Proxy(["a"], {
    getPrototypeOf() {
      throw new Error("not a readable path");
    },
  });
  const invalid = [null, "a", ["a", 1], sparse, decorated, accessor, subclass, reflectiveFailure];
  for (const path of invalid) {
    expect(layering._value({ subject: "s", path: path as string[] })).toEqual([]);
    expect(layering._flag({ subject: "s", path: path as string[], otherwise: true })).toEqual({ value: true });
    expect(layering._equal({ subject: "s", path: path as string[], value: "anything" })).toEqual({
      present: false,
      equal: false,
    });
    expect(layering._origin({ subject: "s", path: path as string[] })).toEqual([]);
  }

  expect(one(layering._value({ subject: "s", path: [] })).value as LayerValues).toHaveProperty("__proto__", "proto value");
  expect(({} as Record<string, unknown>)["proto value"]).toBeUndefined();
});

test("provenance follows the resolved tree through merge, ancestor replacement, and withdrawal", () => {
  const layering = new LayeringConcept();
  layering.contribute({ subject: "s", rank: 0, values: { a: { b: "low", kept: "old" }, other: [1] } });
  layering.contribute({ subject: "s", rank: 1, values: { a: { b: "high" } } });

  expect(layering._origin({ subject: "s", path: ["a"] })).toEqual([{ rank: 0, layer: layerID("s", 0) }]);
  expect(layering._origin({ subject: "s", path: ["a", "b"] })).toEqual([{ rank: 1, layer: layerID("s", 1) }]);
  expect(layering._origin({ subject: "s", path: ["a", "kept"] })).toEqual([{ rank: 0, layer: layerID("s", 0) }]);
  expect(layering._origin({ subject: "s", path: ["other"] })).toEqual([{ rank: 0, layer: layerID("s", 0) }]);
  expect(layering._leafOrigins({ subject: "s" }).map(({ path }) => path)).toEqual([
    ["a", "b"],
    ["a", "kept"],
  ]);

  layering.contribute({ subject: "s", rank: 2, values: { a: null } });
  expect(layering._value({ subject: "s", path: ["a", "b"] })).toEqual([]);
  expect(layering._origin({ subject: "s", path: ["a"] })).toEqual([{ rank: 2, layer: layerID("s", 2) }]);
  expect(layering._origin({ subject: "s", path: ["a", "b"] })).toEqual([]);
  expect(layering._origin({ subject: "s", path: ["a", "kept"] })).toEqual([]);

  layering.contribute({ subject: "s", rank: 3, values: { a: { restored: true } } });
  expect(layering._resolved({ subject: "s" }).values.a).toEqual({ restored: true });
  expect(layering._origin({ subject: "s", path: ["a"] })).toEqual([{ rank: 3, layer: layerID("s", 3) }]);
  expect(layering._origin({ subject: "s", path: ["a", "restored"] })).toEqual([{ rank: 3, layer: layerID("s", 3) }]);
  expect(layering._origin({ subject: "s", path: ["a", "b"] })).toEqual([]);

  layering.withdraw({ subject: "s", rank: 3 });
  expect(layering._value({ subject: "s", path: ["a"] })).toEqual([{ value: null }]);
  expect(layering._origin({ subject: "s", path: ["a"] })).toEqual([{ rank: 2, layer: layerID("s", 2) }]);
  layering.withdraw({ subject: "s", rank: 2 });
  expect(layering._value({ subject: "s", path: ["a", "b"] })).toEqual([{ value: "high" }]);
  expect(layering._origin({ subject: "s", path: ["a"] })).toEqual([{ rank: 0, layer: layerID("s", 0) }]);
  expect(layering._origin({ subject: "s", path: ["a", "b"] })).toEqual([{ rank: 1, layer: layerID("s", 1) }]);
  layering.withdraw({ subject: "s", rank: 1 });
  expect(layering._origin({ subject: "s", path: ["a", "b"] })).toEqual([{ rank: 0, layer: layerID("s", 0) }]);
});

test("ranks are finite, normalize negative zero, and are validated before state changes", () => {
  const layering = new LayeringConcept();
  for (const rank of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expect(() => layering.contribute({ subject: "s", rank, values: {} })).toThrow(InvalidRank);
    expect(() => layering.contribute({ subject: "s", rank, values: {} })).toThrow("A layer rank must be a finite number.");
    expect(() => layering.withdraw({ subject: "s", rank })).toThrow(InvalidRank);
  }
  expect(layering._layers({ subject: "s" })).toEqual([]);

  const zero = layering.contribute({ subject: "s", rank: -0, values: { zero: true } });
  expect(zero.layer).toBe(layerID("s", 0));
  expect(layering._layers({ subject: "s" })[0]!.rank).toBe(0);
  expect(() => layering.contribute({ subject: "s", rank: 0, values: {} })).toThrow(RankTaken);

  expect(() => layering.contribute({ subject: "s", rank: Number.NaN, values: [] })).toThrow(InvalidRank);
  expect(() => layering.contribute({ subject: "s", rank: 0, values: [] })).toThrow(InvalidValues);
  expect(layering._resolved({ subject: "s" })).toEqual({ values: { zero: true } });
});

test("only finite JSON-like mappings can be contributed and invalid inputs are atomic", () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const sparse = new Array(2);
  sparse[0] = "one";
  const decorated = ["one"];
  Object.defineProperty(decorated, "extra", { value: true, enumerable: true });
  let getterRead = false;
  const accessor: Record<string, unknown> = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterRead = true;
      return "not read";
    },
  });
  const symbolRecord = { okay: true } as Record<PropertyKey, unknown>;
  symbolRecord[Symbol("hidden")] = true;
  const hidden: Record<string, unknown> = {};
  Object.defineProperty(hidden, "value", { value: true, enumerable: false });
  const custom = Object.create({ inherited: true }) as Record<string, unknown>;
  custom.own = true;

  const invalidRoots: unknown[] = [null, true, 1, "record", [], new Date(), new Map(), new Set(), cyclic, accessor, symbolRecord, hidden, custom];
  const invalidNested: unknown[] = [undefined, 1n, Number.NaN, Number.POSITIVE_INFINITY, () => true, sparse, decorated];
  for (const values of invalidRoots) {
    expect(() => new LayeringConcept().contribute({ subject: "s", rank: 0, values })).toThrow(InvalidValues);
  }
  for (const value of invalidNested) {
    expect(() => new LayeringConcept().contribute({ subject: "s", rank: 0, values: { value } })).toThrow(
      InvalidValues,
    );
  }
  expect(getterRead).toBe(false);

  const layering = new LayeringConcept();
  layering.contribute({ subject: "s", rank: 0, values: { kept: true } });
  expect(() => layering.contribute({ subject: "s", rank: 1, values: { bad: undefined } })).toThrow(InvalidValues);
  expect(layering._resolved({ subject: "s" })).toEqual({ values: { kept: true } });
  expect(layering._layers({ subject: "s" })).toHaveLength(1);
});

test("contributions and every observation are deep clones with safe literal properties", () => {
  const shared = { label: "shared" };
  const nested = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(nested, "__proto__", { value: "safe", enumerable: true, configurable: true, writable: true });
  nested.items = ["one", { deep: true }];
  const input = { nested, left: shared, right: shared };
  const layering = new LayeringConcept();
  layering.contribute({ subject: "s", rank: 0, values: input });

  nested.items = [];
  shared.label = "changed";
  input.left = { label: "replaced" };

  const resolved = layering._resolved({ subject: "s" }).values as {
    nested: { __proto__: string; items: Array<string | { deep: boolean }> };
    left: { label: string };
    right: { label: string };
  };
  expect(resolved.nested.items).toEqual(["one", { deep: true }]);
  expect(Object.hasOwn(resolved.nested, "__proto__")).toBe(true);
  expect(resolved.nested.__proto__).toBe("safe");
  expect(resolved.left).toEqual({ label: "shared" });
  expect(resolved.right).toEqual({ label: "shared" });
  resolved.nested.items.length = 0;
  resolved.left.label = "observed change";
  expect(resolved.right.label).toBe("shared");

  const value = one(layering._value({ subject: "s", path: ["nested"] })).value as { items: unknown[] };
  value.items.push("changed");
  const layers = layering._layers({ subject: "s" });
  (layers[0]!.values.nested as LayerValues).items = [];
  expect(layering._resolved({ subject: "s" }).values).toEqual({
    nested: ownRecord([
      ["__proto__", "safe"],
      ["items", ["one", { deep: true }]],
    ]) as LayerValues,
    left: { label: "shared" },
    right: { label: "shared" },
  });

  const nullRoot = Object.create(null) as Record<string, unknown>;
  nullRoot.value = true;
  layering.contribute({ subject: "null-root", rank: 0, values: nullRoot });
  expect(Object.getPrototypeOf(layering._layers({ subject: "null-root" })[0]!.values)).toBeNull();
  expect(Object.getPrototypeOf(layering._resolved({ subject: "null-root" }).values)).toBe(Object.prototype);
});

test("_equal is structural and generic; containment is not a Layering operation", () => {
  const layering = new LayeringConcept();
  layering.contribute({
    subject: "s",
    rank: 0,
    values: { scalar: -0, nil: null, sequence: [1, { a: true }], mapping: { first: 1, second: 2 } },
  });

  expect(layering._equal({ subject: "s", path: ["scalar"], value: 0 })).toEqual({ present: true, equal: true });
  expect(layering._equal({ subject: "s", path: ["nil"], value: null })).toEqual({ present: true, equal: true });
  expect(layering._equal({ subject: "s", path: ["sequence"], value: [1, { a: true }] })).toEqual({
    present: true,
    equal: true,
  });
  expect(layering._equal({ subject: "s", path: ["sequence"], value: [{ a: true }, 1] })).toEqual({
    present: true,
    equal: false,
  });
  const reverseOrder = Object.create(null) as Record<string, unknown>;
  reverseOrder.second = 2;
  reverseOrder.first = 1;
  expect(layering._equal({ subject: "s", path: ["mapping"], value: reverseOrder })).toEqual({
    present: true,
    equal: true,
  });
  expect(layering._equal({ subject: "s", path: ["mapping"], value: { first: 1 } })).toEqual({
    present: true,
    equal: false,
  });
  expect(layering._equal({ subject: "s", path: ["missing"], value: null })).toEqual({
    present: false,
    equal: false,
  });
  expect(layering._equal({ subject: "s", path: ["scalar"], value: Number.NaN })).toEqual({
    present: true,
    equal: false,
  });
  expect("_holds" in layering).toBe(false);
});

test("clear reports exact counts, withdrawal refuses absence, and identities are stable and collision-safe", () => {
  const layering = new LayeringConcept();
  const subjectsAndRanks: Array<[string, number]> = [
    ["a:b", 1],
    ["a", 12],
    ['a"b', -2.5],
  ];
  const identities = subjectsAndRanks.map(([subject, rank]) => layering.contribute({ subject, rank, values: { rank } }).layer);
  expect(new Set(identities).size).toBe(identities.length);
  identities.forEach((identity, index) => expect(identity).toBe(layerID(...subjectsAndRanks[index]!)));

  const first = layering.contribute({ subject: "clear", rank: 0, values: { first: true } });
  layering.contribute({ subject: "clear", rank: 1, values: { second: true } });
  expect(layering.clear({ subject: "clear" })).toEqual({ subject: "clear", count: 2 });
  expect(layering.clear({ subject: "clear" })).toEqual({ subject: "clear", count: 0 });
  expect(layering._resolved({ subject: "clear" })).toEqual({ values: {} });
  expect(layering._layers({ subject: "clear" })).toEqual([]);
  expect(layering._value({ subject: "clear", path: [] })).toEqual([{ value: {} }]);
  expect(layering._origin({ subject: "clear", path: ["first"] })).toEqual([]);
  expect(() => layering.withdraw({ subject: "clear", rank: 0 })).toThrow(NoSuchLayer);
  expect(() => layering.withdraw({ subject: "clear", rank: 0 })).toThrow("This record has no contribution at this rank.");
  expect(layering.contribute({ subject: "clear", rank: 0, values: {} }).layer).toBe(first.layer);
  expect(new LayeringConcept().contribute({ subject: "clear", rank: 0, values: {} }).layer).toBe(first.layer);
});

test("registry exposes every declared refusal with its normative message", async () => {
  const concepts = conceptSet({ Layering: layering });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  const Layering = app.concepts.Layering;

  expect(await Layering.contribute({ subject: "s", rank: Number.NaN, values: {} })).toEqual({
    error: "INVALID_RANK",
    detail: "A layer rank must be a finite number.",
  });
  expect(await Layering.contribute({ subject: "s", rank: 0, values: [] })).toEqual({
    error: "INVALID_VALUES",
    detail: "A layer contribution must be a finite JSON-like record.",
  });
  expect(await Layering.contribute({ subject: "s", rank: 0, values: { valid: true } })).toEqual({
    layer: layerID("s", 0),
  });
  expect(await Layering.contribute({ subject: "s", rank: 0, values: {} })).toEqual({
    error: "RANK_TAKEN",
    detail: "This record already has a contribution at this rank.",
  });
  expect(await Layering.withdraw({ subject: "s", rank: 1 })).toEqual({
    error: "NO_SUCH_LAYER",
    detail: "This record has no contribution at this rank.",
  });
  await app.whenIdle();
});
