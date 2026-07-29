import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  type ComposedRecord,
  type ComposedValue,
  ComposingConcept,
  InvalidPath,
  InvalidValue,
  KeyConflicts,
} from "./composing.ts";
import { composing as composingRegistration } from "./registry.ts";

type Piece = { path: string[]; value: ComposedValue };

function permutations<T>(values: readonly T[]): T[][] {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]),
  );
}

function recordAt(composing: ComposingConcept, subject = "picnic", part = "plan"): ComposedRecord {
  return composing._record({ subject, part }).values;
}

test("its principle: separately known pieces form the same picnic plan in any order", () => {
  const pieces: Piece[] = [
    { path: ["venue", "name"], value: "Oak Park" },
    { path: ["contact", "phone"], value: "555-0100" },
    { path: ["capacity"], value: 80 },
  ];
  const expected = {
    capacity: 80,
    contact: { phone: "555-0100" },
    venue: { name: "Oak Park" },
  };

  for (const order of permutations(pieces)) {
    const composing = new ComposingConcept();
    for (const piece of order) composing.set({ subject: "picnic", part: "plan", ...piece });
    expect(recordAt(composing)).toEqual(expected);
    expect(JSON.stringify(recordAt(composing))).toBe(JSON.stringify(expected));
    expect(composing._keys({ subject: "picnic", part: "plan" })).toEqual([
      { path: ["capacity"] },
      { path: ["contact", "phone"] },
      { path: ["venue", "name"] },
    ]);
  }
});

test("refuses strict parent and descendant overlaps in both directions before changing state", () => {
  for (const parentValue of ["Ada", { name: "Ada" }, ["Ada"]] satisfies ComposedValue[]) {
    const parentFirst = new ComposingConcept();
    parentFirst.set({ subject: "s", part: "p", path: ["person"], value: parentValue });
    expect(() =>
      parentFirst.set({ subject: "s", part: "p", path: ["person", "name"], value: "Grace" }),
    ).toThrow(KeyConflicts);
    expect(recordAt(parentFirst, "s", "p")).toEqual({ person: parentValue });

    const childFirst = new ComposingConcept();
    childFirst.set({ subject: "s", part: "p", path: ["person", "name"], value: "Grace" });
    expect(() => childFirst.set({ subject: "s", part: "p", path: ["person"], value: parentValue })).toThrow(
      KeyConflicts,
    );
    expect(recordAt(childFirst, "s", "p")).toEqual({ person: { name: "Grace" } });
  }

  const composing = new ComposingConcept();
  composing.set({ subject: "s", part: "p", path: ["person"], value: { contact: { phone: "555-0100" } } });
  expect(() =>
    composing.set({ subject: "s", part: "p", path: ["person", "contact", "phone", "extension"], value: 4 }),
  ).toThrow(KeyConflicts);
  expect(() => composing._record({ subject: "s", part: "p" })).not.toThrow();
});

test("replaces an exact path without changing its deterministic position", () => {
  const composing = new ComposingConcept();
  expect(composing.set({ subject: "s", part: "p", path: ["b"], value: 1 })).toEqual({
    subject: "s",
    part: "p",
    path: ["b"],
  });
  composing.set({ subject: "s", part: "p", path: ["a"], value: 2 });
  composing.set({ subject: "s", part: "p", path: ["b"], value: { corrected: true } });

  expect(composing._keys({ subject: "s", part: "p" })).toEqual([{ path: ["a"] }, { path: ["b"] }]);
  expect(recordAt(composing, "s", "p")).toEqual({ a: 2, b: { corrected: true } });
  expect(composing._value({ subject: "s", part: "p", path: ["b"] })).toEqual([{ value: { corrected: true } }]);
});

test("keeps populated parts and collision-prone subject-part addresses independent", () => {
  const composing = new ComposingConcept();
  composing.set({ subject: "picnic", part: "plan", path: ["venue"], value: "Oak Park" });
  composing.set({ subject: "picnic", part: "shopping", path: ["fruit"], value: ["apples"] });
  composing.set({ subject: "other", part: "plan", path: ["venue"], value: "River Park" });

  const firstAddress = { subject: "a\u0000b", part: "c" };
  const secondAddress = { subject: "a", part: "b\u0000c" };
  composing.set({ ...firstAddress, path: ["value"], value: "first" });
  composing.set({ ...secondAddress, path: ["value"], value: "second" });

  expect(recordAt(composing)).toEqual({ venue: "Oak Park" });
  expect(recordAt(composing, "picnic", "shopping")).toEqual({ fruit: ["apples"] });
  expect(recordAt(composing, "other", "plan")).toEqual({ venue: "River Park" });
  expect(recordAt(composing, firstAddress.subject, firstAddress.part)).toEqual({ value: "first" });
  expect(recordAt(composing, secondAddress.subject, secondAddress.part)).toEqual({ value: "second" });
});

test("clears exactly one part and defines unknown query state", () => {
  const composing = new ComposingConcept();
  composing.set({ subject: "s", part: "first", path: ["a"], value: 1 });
  composing.set({ subject: "s", part: "first", path: ["b"], value: 2 });
  composing.set({ subject: "s", part: "second", path: ["a"], value: 3 });

  expect(composing.clear({ subject: "s", part: "first" })).toEqual({ subject: "s", part: "first", count: 2 });
  expect(composing._record({ subject: "s", part: "first" })).toEqual({ values: {} });
  expect(composing._keys({ subject: "s", part: "first" })).toEqual([]);
  expect(composing._value({ subject: "s", part: "first", path: ["a"] })).toEqual([]);
  expect(recordAt(composing, "s", "second")).toEqual({ a: 3 });
  expect(composing.clear({ subject: "s", part: "first" })).toEqual({ subject: "s", part: "first", count: 0 });
  expect(composing.clear({ subject: "unknown", part: "unknown" })).toEqual({
    subject: "unknown",
    part: "unknown",
    count: 0,
  });
  expect(composing._record({ subject: "unknown", part: "unknown" })).toEqual({ values: {} });
  expect(composing._keys({ subject: "unknown", part: "unknown" })).toEqual([]);
  expect(composing._value({ subject: "unknown", part: "unknown", path: [] })).toEqual([]);
});

test("copies paths and values on input and every query output", () => {
  const composing = new ComposingConcept();
  const path = ["details"];
  const value = { people: [{ name: "Rosa" }], open: true };
  composing.set({ subject: "s", part: "p", path, value });

  path[0] = "changed";
  value.people[0]!.name = "Changed";
  value.people.push({ name: "Added" });

  const fromValue = composing._value({ subject: "s", part: "p", path: ["details"] })[0]!.value as ComposedRecord;
  (fromValue.people as ComposedRecord[])[0]!.name = "Changed again";
  const fromRecord = recordAt(composing, "s", "p");
  ((fromRecord.details as ComposedRecord).people as ComposedRecord[]).push({ name: "Added again" });
  const keys = composing._keys({ subject: "s", part: "p" });
  keys[0]!.path[0] = "changed again";

  expect(composing._value({ subject: "s", part: "p", path: ["details"] })).toEqual([
    { value: { open: true, people: [{ name: "Rosa" }] } },
  ]);
  expect(recordAt(composing, "s", "p")).toEqual({ details: { open: true, people: [{ name: "Rosa" }] } });
  expect(composing._keys({ subject: "s", part: "p" })).toEqual([{ path: ["details"] }]);
});

test("treats dots, empty segments, and prototype names as safe literal keys", () => {
  const composing = new ComposingConcept();
  composing.set({ subject: "s", part: "p", path: ["literal.with.dot"], value: "dot" });
  composing.set({ subject: "s", part: "p", path: ["", "value"], value: "empty" });
  composing.set({ subject: "s", part: "p", path: ["__proto__", "polluted"], value: "no" });
  composing.set({ subject: "s", part: "p", path: ["constructor", "prototype"], value: "literal" });

  const values = recordAt(composing, "s", "p");
  expect(values["literal.with.dot"]).toBe("dot");
  expect((values[""] as ComposedRecord).value).toBe("empty");
  expect(Object.hasOwn(values, "__proto__")).toBe(true);
  expect((values["__proto__"] as ComposedRecord).polluted).toBe("no");
  expect((values["constructor"] as unknown as ComposedRecord).prototype).toBe("literal");
  expect(({} as { polluted?: string }).polluted).toBeUndefined();

  const nested: ComposedRecord = {};
  Object.defineProperty(nested, "__proto__", {
    value: { safe: true },
    enumerable: true,
    configurable: true,
    writable: true,
  });
  composing.set({ subject: "s", part: "value", path: ["nested"], value: nested });
  const copied = recordAt(composing, "s", "value").nested as ComposedRecord;
  expect(Object.hasOwn(copied, "__proto__")).toBe(true);
  expect((copied.__proto__ as ComposedRecord).safe).toBe(true);
  expect(({} as { safe?: boolean }).safe).toBeUndefined();
});

test("accepts only finite acyclic plain JSON-like values and leaves replacements atomic", () => {
  const composing = new ComposingConcept();
  composing.set({ subject: "s", part: "p", path: ["kept"], value: "original" });

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const sparse = new Array(2);
  sparse[0] = "present";
  const decorated = ["value"] as unknown[] & { extra?: string };
  decorated.extra = "no";
  const hiddenDecoration = ["value"];
  Object.defineProperty(hiddenDecoration, "extra", { value: "no" });
  const accessor = Object.defineProperty({}, "value", { enumerable: true, get: () => "no" });
  const symbolProperty = { value: "yes", [Symbol("extra")]: "no" };
  const customPrototype = Object.create({ inherited: true }) as Record<string, unknown>;
  customPrototype.value = "no";
  class ValueArray extends Array<ComposedValue> {}
  const subclass = new ValueArray("no");
  const replacedArrayPrototype = ["no"];
  Object.setPrototypeOf(replacedArrayPrototype, Object.create(Array.prototype));

  const throwingArrayPrototype = new Proxy(["no"], {
    getPrototypeOf() {
      throw new Error("must not escape");
    },
  });
  const throwingArrayKeys = new Proxy(["no"], {
    ownKeys() {
      throw new Error("must not escape");
    },
  });
  const throwingArrayDescriptor = new Proxy(["no"], {
    getOwnPropertyDescriptor(target, key) {
      if (key === "0") throw new Error("must not escape");
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const throwingRecordKeys = new Proxy({ value: "no" }, {
    ownKeys() {
      throw new Error("must not escape");
    },
  });
  const revoked = Proxy.revocable(["no"], {});
  revoked.revoke();

  for (const value of [
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    Symbol("value"),
    () => "value",
    new Date(),
    new Map(),
    cyclic,
    sparse,
    decorated,
    hiddenDecoration,
    subclass,
    replacedArrayPrototype,
    accessor,
    symbolProperty,
    customPrototype,
    throwingArrayPrototype,
    throwingArrayKeys,
    throwingArrayDescriptor,
    throwingRecordKeys,
    revoked.proxy,
  ]) {
    expect(() =>
      composing.set({ subject: "s", part: "p", path: ["kept"], value: value as ComposedValue }),
    ).toThrow(InvalidValue);
    expect(composing._value({ subject: "s", part: "p", path: ["kept"] })).toEqual([{ value: "original" }]);
  }

  const shared = { value: "shared" };
  composing.set({ subject: "s", part: "p", path: ["shared"], value: [shared, shared] });
  const sharedCopy = composing._value({ subject: "s", part: "p", path: ["shared"] })[0]!.value as ComposedRecord[];
  expect(sharedCopy).toEqual([{ value: "shared" }, { value: "shared" }]);
  expect(sharedCopy[0]).not.toBe(sharedCopy[1]);

  const withoutPrototype = Object.create(null) as ComposedRecord;
  withoutPrototype.value = "plain";
  composing.set({ subject: "s", part: "p", path: ["plain"], value: withoutPrototype });
  const plainCopy = composing._value({ subject: "s", part: "p", path: ["plain"] })[0]!.value as ComposedRecord;
  expect(Object.getPrototypeOf(plainCopy)).toBeNull();
  expect(plainCopy.value).toBe("plain");
});

test("refuses malformed set paths while invalid query paths are absent", () => {
  const composing = new ComposingConcept();
  const sparse = new Array(1);
  const accessor = Object.defineProperty([], "0", { enumerable: true, get: () => "hidden" });
  for (const path of [[], "not-an-array", ["valid", 1], sparse, accessor] as unknown[]) {
    expect(() =>
      composing.set({ subject: "s", part: "p", path: path as string[], value: "value" }),
    ).toThrow(InvalidPath);
    expect(composing._value({ subject: "s", part: "p", path: path as string[] })).toEqual([]);
  }
  expect(composing._record({ subject: "s", part: "p" })).toEqual({ values: {} });
});

test("refuses decorated, nonstandard, and reflectively unsafe path arrays atomically", () => {
  const composing = new ComposingConcept();
  composing.set({ subject: "s", part: "p", path: ["kept"], value: "original" });

  const enumerableExtra = ["extra"] as string[] & { extra?: string };
  enumerableExtra.extra = "no";
  const hiddenExtra = ["hidden"];
  Object.defineProperty(hiddenExtra, "extra", { value: "no" });
  const symbolExtra = ["symbol"];
  Object.defineProperty(symbolExtra, Symbol("extra"), { value: "no" });
  class PathArray extends Array<string> {}
  const subclass = new PathArray("subclass");
  const replacedPrototype = ["prototype"];
  Object.setPrototypeOf(replacedPrototype, Object.create(Array.prototype));

  const throwingPrototype = new Proxy(["prototype"], {
    getPrototypeOf() {
      throw new Error("must not escape");
    },
  });
  const throwingKeys = new Proxy(["keys"], {
    ownKeys() {
      throw new Error("must not escape");
    },
  });
  const throwingDescriptor = new Proxy(["descriptor"], {
    getOwnPropertyDescriptor(target, key) {
      if (key === "0") throw new Error("must not escape");
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const revoked = Proxy.revocable(["revoked"], {});
  revoked.revoke();

  for (const path of [
    enumerableExtra,
    hiddenExtra,
    symbolExtra,
    subclass,
    replacedPrototype,
    throwingPrototype,
    throwingKeys,
    throwingDescriptor,
    revoked.proxy,
  ]) {
    expect(() => composing.set({ subject: "s", part: "p", path, value: "replacement" })).toThrow(InvalidPath);
    expect(composing._value({ subject: "s", part: "p", path: ["kept"] })).toEqual([{ value: "original" }]);
    expect(composing._value({ subject: "s", part: "p", path })).toEqual([]);
  }
  expect(composing._keys({ subject: "s", part: "p" })).toEqual([{ path: ["kept"] }]);
});

test("registry exposes every refusal with its normative message", async () => {
  const concepts = conceptSet({ Composing: composingRegistration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  const Composing = app.concepts.Composing;

  expect(await Composing.set({ subject: "s", part: "p", path: [], value: "value" })).toEqual({
    error: "INVALID_PATH",
    detail: "A path must contain one or more string segments.",
  });
  expect(
    await Composing.set({ subject: "s", part: "p", path: ["bad"], value: Number.NaN as ComposedValue }),
  ).toEqual({
    error: "INVALID_VALUE",
    detail: "A value must be a finite JSON-like value.",
  });
  await Composing.set({ subject: "s", part: "p", path: ["person"], value: { name: "Rosa" } });
  expect(await Composing.set({ subject: "s", part: "p", path: ["person", "name"], value: "Ada" })).toEqual({
    error: "KEY_CONFLICTS",
    detail: "This path overlaps another entry.",
  });
  await app.whenIdle();
});
