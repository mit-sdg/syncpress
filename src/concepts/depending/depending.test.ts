import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import { DependingConcept, InvalidText, NotBuilding } from "./depending.ts";
import { depending as dependingRegistration } from "./registry.ts";

function finish(depending: DependingConcept, subject: string, inputs: readonly string[]) {
  const begun = depending.begin({ subject });
  const uses = inputs.map((input) => depending.use({ subject, input }).use);
  const settled = depending.settle({ subject });
  return { result: begun.result, uses, settled };
}

test("its principle: only related results become stale and a rebuild replaces its inputs", () => {
  const depending = new DependingConcept();
  const original = finish(depending, "summary", ["notes", "rates"]);

  expect(depending._state({ subject: "summary" })).toEqual({ state: "current" });
  expect(depending._current({ subject: "summary" })).toEqual([{ result: original.result }]);
  expect(depending.touch({ input: "unrelated" })).toEqual({ input: "unrelated", count: 0 });
  expect(depending.touch({ input: "notes" })).toEqual({ input: "notes", count: 1 });
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);
  expect(depending.touch({ input: "rates" })).toEqual({ input: "rates", count: 0 });
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);

  expect(depending.begin({ subject: "summary" })).toEqual({ result: original.result });
  expect(depending._uses({ subject: "summary" })).toEqual([]);
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);
  depending.use({ subject: "summary", input: "revised-notes" });
  depending.settle({ subject: "summary" });

  expect(depending._current({ subject: "summary" })).toEqual([{ result: original.result }]);
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);
  expect(depending.touch({ input: "notes" })).toEqual({ input: "notes", count: 0 });
  expect(depending.touch({ input: "revised-notes" })).toEqual({ input: "revised-notes", count: 1 });
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "revised-notes" }]);
});

test("touch is deterministic through diamonds, cycles, and already-stale intermediates", () => {
  const dependencies = new Map<string, string[]>([
    ["left", ["origin"]],
    ["right", ["origin"]],
    ["join", ["right", "left"]],
    ["tail", ["join"]],
    ["cycle-a", ["origin", "cycle-c"]],
    ["cycle-b", ["cycle-a"]],
    ["cycle-c", ["cycle-b"]],
  ]);
  const graphFor = (order: readonly string[]) => {
    const depending = new DependingConcept();
    for (const subject of order) finish(depending, subject, dependencies.get(subject)!);
    return depending;
  };

  const first = graphFor(["join", "right", "cycle-c", "tail", "left", "cycle-b", "cycle-a"]);
  const second = graphFor(["cycle-a", "cycle-b", "left", "tail", "cycle-c", "right", "join"]);
  expect(first.touch({ input: "origin" })).toEqual({ input: "origin", count: 7 });
  expect(second.touch({ input: "origin" })).toEqual({ input: "origin", count: 7 });

  const expected = [
    { subject: "cycle-a", reason: "origin" },
    { subject: "cycle-b", reason: "cycle-a" },
    { subject: "cycle-c", reason: "cycle-b" },
    { subject: "join", reason: "left" },
    { subject: "left", reason: "origin" },
    { subject: "right", reason: "origin" },
    { subject: "tail", reason: "join" },
  ];
  expect(first._stale()).toEqual(expected);
  expect(second._stale()).toEqual(expected);

  finish(first, "join", ["right", "left"]);
  finish(first, "tail", ["join"]);
  expect(first.touch({ input: "origin" })).toEqual({ input: "origin", count: 2 });
  expect(first._reason({ subject: "join" })).toEqual([{ reason: "left" }]);
  expect(first._reason({ subject: "tail" })).toEqual([{ reason: "join" }]);
});

test("building results are invalidated and stale reasons survive retry and settlement", () => {
  const depending = new DependingConcept();
  const begun = depending.begin({ subject: "unfinished" });
  depending.use({ subject: "unfinished", input: "source" });

  expect(depending.touch({ input: "source" })).toEqual({ input: "source", count: 1 });
  expect(depending._state({ subject: "unfinished" })).toEqual({ state: "stale" });
  expect(depending._current({ subject: "unfinished" })).toEqual([]);
  expect(() => depending.settle({ subject: "unfinished" })).toThrow(NotBuilding);

  expect(depending.begin({ subject: "unfinished" })).toEqual(begun);
  expect(depending._state({ subject: "unfinished" })).toEqual({ state: "building" });
  expect(depending._reason({ subject: "unfinished" })).toEqual([{ reason: "source" }]);
  depending.use({ subject: "unfinished", input: "source" });
  depending.settle({ subject: "unfinished" });
  expect(depending._reason({ subject: "unfinished" })).toEqual([{ reason: "source" }]);

  depending.begin({ subject: "unfinished" });
  expect(depending._reason({ subject: "unfinished" })).toEqual([]);
  depending.settle({ subject: "unfinished" });
  expect(() => depending.settle({ subject: "unfinished" })).toThrow(NotBuilding);
});

test("result and use identities are stable, collision-safe, and keyed by their facts", () => {
  const depending = new DependingConcept();
  const first = depending.begin({ subject: "a:b" });
  const firstUse = depending.use({ subject: "a:b", input: "c" });
  expect(depending.use({ subject: "a:b", input: "c" })).toEqual(firstUse);
  depending.settle({ subject: "a:b" });

  const second = depending.begin({ subject: "a" });
  const secondUse = depending.use({ subject: "a", input: "b:c" });
  depending.settle({ subject: "a" });

  expect(first.result).toBe(`result:${JSON.stringify("a:b")}`);
  expect(firstUse.use).toBe(`use:${JSON.stringify([first.result, "c"])}`);
  expect(firstUse.use).not.toBe(secondUse.use);
  expect(first.result).not.toBe(second.result);

  depending.begin({ subject: "a:b" });
  const changedUse = depending.use({ subject: "a:b", input: "different" });
  expect(changedUse.use).not.toBe(firstUse.use);
  expect(depending._uses({ subject: "a:b" })).toEqual([{ input: "different" }]);
  depending.begin({ subject: "a:b" });
  expect(depending.use({ subject: "a:b", input: "c" })).toEqual(firstUse);
  depending.settle({ subject: "a:b" });

  expect(depending.drop({ subject: "a:b" })).toEqual(first);
  expect(depending.begin({ subject: "a:b" })).toEqual(first);
  const another = new DependingConcept();
  expect(another.begin({ subject: "a:b" })).toEqual(first);
  expect(another.use({ subject: "a:b", input: "c" })).toEqual(firstUse);
});

test("many queries and equal-length invalidation paths use UTF-8 byte order", () => {
  const depending = new DependingConcept();
  const subjects = ["z", "\ue000", "\u{10000}"];
  for (const subject of [...subjects].reverse()) finish(depending, subject, ["origin"]);
  expect(depending._dependents({ input: "origin" })).toEqual(subjects.map((subject) => ({ subject })));

  depending.begin({ subject: "ordered-inputs" });
  for (const input of [...subjects].reverse()) depending.use({ subject: "ordered-inputs", input });
  depending.settle({ subject: "ordered-inputs" });
  expect(depending._uses({ subject: "ordered-inputs" })).toEqual(subjects.map((input) => ({ input })));
  depending.drop({ subject: "ordered-inputs" });

  finish(depending, "diamond", ["\u{10000}", "\ue000"]);
  expect(depending.touch({ input: "origin" }).count).toBe(4);
  expect(depending._reason({ subject: "diamond" })).toEqual([{ reason: "\ue000" }]);
  expect(depending._stale().map(({ subject }) => subject)).toEqual(["diamond", ...subjects]);
});

test("unknown subjects are virtual stale results and inputs need no corresponding result", () => {
  const depending = new DependingConcept();
  expect(depending._state({ subject: "missing" })).toEqual({ state: "stale" });
  expect(depending._current({ subject: "missing" })).toEqual([]);
  expect(depending._reason({ subject: "missing" })).toEqual([]);
  expect(depending._uses({ subject: "missing" })).toEqual([]);
  expect(depending._stale()).toEqual([]);
  expect(depending.touch({ input: "missing" })).toEqual({ input: "missing", count: 0 });
  expect(() => depending.use({ subject: "missing", input: "anything" })).toThrow(NotBuilding);
  expect(() => depending.settle({ subject: "missing" })).toThrow(NotBuilding);

  const expectedMissing = { result: `result:${JSON.stringify("unrecorded-input")}` };
  expect(depending.drop({ subject: "unrecorded-input" })).toEqual(expectedMissing);
  expect(depending._stale()).toEqual([]);

  finish(depending, "consumer", ["unrecorded-input"]);
  expect(depending._dependents({ input: "unrecorded-input" })).toEqual([{ subject: "consumer" }]);
  expect(depending.drop({ subject: "unrecorded-input" })).toEqual(expectedMissing);
  expect(depending._current({ subject: "consumer" })).toHaveLength(1);
  expect(depending.touch({ input: "unrecorded-input" })).toEqual({ input: "unrecorded-input", count: 1 });
  depending.drop({ subject: "consumer" });
  expect(depending._dependents({ input: "unrecorded-input" })).toEqual([]);

  const upstream = finish(depending, "upstream", ["source"]);
  finish(depending, "downstream", ["upstream"]);
  expect(depending.drop({ subject: "upstream" })).toEqual({ result: upstream.result });
  expect(depending._dependents({ input: "source" })).toEqual([]);
  expect(depending._dependents({ input: "upstream" })).toEqual([{ subject: "downstream" }]);
  expect(depending._current({ subject: "downstream" })).toHaveLength(1);
  expect(depending.touch({ input: "upstream" })).toEqual({ input: "upstream", count: 1 });
});

test("actions reject malformed runtime text atomically and lookup queries stay total", () => {
  const depending = new DependingConcept();
  depending.begin({ subject: "kept" });
  depending.use({ subject: "kept", input: "valid" });
  const invalid = [1, null, undefined, "\ud800"];

  for (const value of invalid) {
    expect(() => depending.begin({ subject: value })).toThrow(InvalidText);
    expect(() => depending.use({ subject: value, input: "input" })).toThrow(InvalidText);
    expect(() => depending.use({ subject: "kept", input: value })).toThrow(InvalidText);
    expect(() => depending.settle({ subject: value })).toThrow(InvalidText);
    expect(() => depending.touch({ input: value })).toThrow(InvalidText);
    expect(() => depending.drop({ subject: value })).toThrow(InvalidText);
    expect(depending._state({ subject: value })).toEqual({ state: "stale" });
    expect(depending._current({ subject: value })).toEqual([]);
    expect(depending._reason({ subject: value })).toEqual([]);
    expect(depending._uses({ subject: value })).toEqual([]);
    expect(depending._dependents({ input: value })).toEqual([]);
  }

  expect(depending._state({ subject: "kept" })).toEqual({ state: "building" });
  expect(depending._uses({ subject: "kept" })).toEqual([{ input: "valid" }]);
  expect(() => depending.touch({ input: "\ud800" })).toThrow("Subjects and inputs must be well-formed text.");
});

test("the registry exposes every refusal with its normative message", async () => {
  expect(dependingRegistration.refusals).toEqual({ INVALID_TEXT: InvalidText, NOT_BUILDING: NotBuilding });
  expect(
    dependingRegistration.specification.actions.flatMap(({ refusals }) =>
      refusals.map(({ code, message }) => [code, message]),
    ),
  ).toEqual([
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["NOT_BUILDING", "This result is not being computed."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["NOT_BUILDING", "This result is not being computed."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
  ]);

  const concepts = conceptSet({ Depending: dependingRegistration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.Depending.begin({ subject: 1 })).toEqual({
    error: "INVALID_TEXT",
    detail: "Subjects and inputs must be well-formed text.",
  });
  expect(await app.concepts.Depending.use({ subject: "missing", input: "input" })).toEqual({
    error: "NOT_BUILDING",
    detail: "This result is not being computed.",
  });
  await app.whenIdle();
});
