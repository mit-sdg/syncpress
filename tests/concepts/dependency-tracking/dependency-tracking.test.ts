import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  AttemptExhausted,
  DependencyTrackingConcept as StrictDependencyTrackingConcept,
  InvalidText,
  NotBuilding,
  StaleAttempt,
} from "@concepts/dependency-tracking/dependency-tracking.ts";
import { dependencyTracking as dependencyTrackingRegistration } from "@concepts/dependency-tracking/registry.ts";

class DependencyTrackingConcept extends StrictDependencyTrackingConcept {
  recordDependency(input: { subject: unknown; attempt?: unknown; input: unknown }) {
    const attempt = input.attempt ?? this._attempt({ subject: input.subject })[0]?.attempt;
    return super.recordDependency({ ...input, attempt });
  }

  settleAttempt(input: { subject: unknown; attempt?: unknown }) {
    const attempt = input.attempt ?? this._attempt({ subject: input.subject })[0]?.attempt;
    return super.settleAttempt({ ...input, attempt });
  }

  abandonAttempt(input: { subject: unknown; attempt?: unknown }) {
    const attempt = input.attempt ?? this._attempt({ subject: input.subject })[0]?.attempt;
    return super.abandonAttempt({ ...input, attempt });
  }
}

function finish(depending: DependencyTrackingConcept, subject: string, inputs: readonly string[]) {
  const begun = depending.beginAttempt({ subject });
  const uses = inputs.map((input) => depending.recordDependency({ subject, input }).use);
  const settled = depending.settleAttempt({ subject });
  return { result: begun.result, uses, settled };
}

test("its principle: only related results become stale and settlement replaces retained inputs", () => {
  const depending = new DependencyTrackingConcept();
  const original = finish(depending, "summary", ["notes", "rates"]);

  expect(depending._state({ subject: "summary" })).toEqual({ state: "current" });
  expect(depending._current({ subject: "summary" })).toEqual([{ result: original.result }]);
  expect(depending.invalidate({ input: "unrelated" })).toEqual({ input: "unrelated", count: 0 });
  expect(depending.invalidate({ input: "notes" })).toEqual({ input: "notes", count: 1 });
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);
  expect(depending.invalidate({ input: "rates" })).toEqual({ input: "rates", count: 0 });
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);

  expect(depending.beginAttempt({ subject: "summary" })).toEqual({ result: original.result, attempt: 2 });
  expect(depending._uses({ subject: "summary" })).toEqual([{ input: "notes" }, { input: "rates" }]);
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);
  depending.recordDependency({ subject: "summary", input: "revised-notes" });
  expect(depending._uses({ subject: "summary" })).toEqual([{ input: "notes" }, { input: "rates" }]);
  depending.settleAttempt({ subject: "summary" });

  expect(depending._current({ subject: "summary" })).toEqual([{ result: original.result }]);
  expect(depending._uses({ subject: "summary" })).toEqual([{ input: "revised-notes" }]);
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "notes" }]);
  expect(depending.invalidate({ input: "notes" })).toEqual({ input: "notes", count: 0 });
  expect(depending.invalidate({ input: "revised-notes" })).toEqual({ input: "revised-notes", count: 1 });
  expect(depending._reason({ subject: "summary" })).toEqual([{ reason: "revised-notes" }]);
});

test("an incomplete replacement retains its last settled dependency graph", () => {
  const depending = new DependencyTrackingConcept();
  finish(depending, "page", ["source", "template"]);

  depending.beginAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "discarded-template" });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "source" }, { input: "template" }]);
  expect(depending._dependents({ input: "source" })).toEqual([{ subject: "page" }]);
  expect(depending._dependents({ input: "discarded-template" })).toEqual([]);

  expect(depending.invalidate({ input: "source" })).toEqual({ input: "source", count: 1 });
  expect(depending._state({ subject: "page" })).toEqual({ state: "stale" });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "source" }, { input: "template" }]);

  depending.beginAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "replacement-template" });
  depending.settleAttempt({ subject: "page" });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "replacement-template" }]);
  expect(depending._dependents({ input: "source" })).toEqual([]);
  expect(depending._dependents({ input: "replacement-template" })).toEqual([{ subject: "page" }]);
});

test("abandoning an attempt discards provisional inputs and retains the last settled graph", () => {
  const depending = new DependencyTrackingConcept();
  const first = finish(depending, "page", ["old"]);
  depending.beginAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "new" });

  expect(depending.abandonAttempt({ subject: "page" })).toEqual({ result: first.result });
  expect(depending._state({ subject: "page" })).toEqual({ state: "stale" });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "old" }]);
  expect(depending._dependents({ input: "new" })).toEqual([]);
  expect(() => depending.abandonAttempt({ subject: "page" })).toThrow(NotBuilding);
});

test("abandoning a first attempt removes its provisional dependency edges", () => {
  const depending = new DependencyTrackingConcept();
  depending.beginAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "draft" });
  depending.abandonAttempt({ subject: "page" });

  expect(depending._state({ subject: "page" })).toEqual({ state: "stale" });
  expect(depending._uses({ subject: "page" })).toEqual([]);
  expect(depending._dependents({ input: "draft" })).toEqual([]);
});

test("late uses complete settled first-time and replacement attempts", () => {
  const depending = new DependencyTrackingConcept();

  depending.beginAttempt({ subject: "page" });
  depending.settleAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "source" });
  depending.recordDependency({ subject: "page", input: "body-template" });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "body-template" }, { input: "source" }]);
  expect(depending._dependents({ input: "source" })).toEqual([{ subject: "page" }]);

  depending.beginAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "layout-template" });
  depending.settleAttempt({ subject: "page" });
  depending.recordDependency({ subject: "page", input: "source" });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "layout-template" }, { input: "source" }]);
  expect(depending._dependents({ input: "body-template" })).toEqual([]);
  expect(depending._dependents({ input: "source" })).toEqual([{ subject: "page" }]);
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
    const depending = new DependencyTrackingConcept();
    for (const subject of order) finish(depending, subject, dependencies.get(subject)!);
    return depending;
  };

  const first = graphFor(["join", "right", "cycle-c", "tail", "left", "cycle-b", "cycle-a"]);
  const second = graphFor(["cycle-a", "cycle-b", "left", "tail", "cycle-c", "right", "join"]);
  expect(first.invalidate({ input: "origin" })).toEqual({ input: "origin", count: 7 });
  expect(second.invalidate({ input: "origin" })).toEqual({ input: "origin", count: 7 });

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
  expect(first.invalidate({ input: "origin" })).toEqual({ input: "origin", count: 2 });
  expect(first._reason({ subject: "join" })).toEqual([{ reason: "left" }]);
  expect(first._reason({ subject: "tail" })).toEqual([{ reason: "join" }]);
});

test("building results are invalidated and stale reasons survive retry and settlement", () => {
  const depending = new DependencyTrackingConcept();
  const begun = depending.beginAttempt({ subject: "unfinished" });
  depending.recordDependency({ subject: "unfinished", input: "source" });

  expect(depending.invalidate({ input: "source" })).toEqual({ input: "source", count: 1 });
  expect(depending._state({ subject: "unfinished" })).toEqual({ state: "stale" });
  expect(depending._current({ subject: "unfinished" })).toEqual([]);
  expect(() => depending.settleAttempt({ subject: "unfinished" })).toThrow(NotBuilding);

  expect(depending.beginAttempt({ subject: "unfinished" })).toEqual({ result: begun.result, attempt: 2 });
  expect(depending._state({ subject: "unfinished" })).toEqual({ state: "building" });
  expect(depending._reason({ subject: "unfinished" })).toEqual([{ reason: "source" }]);
  depending.recordDependency({ subject: "unfinished", input: "source" });
  depending.settleAttempt({ subject: "unfinished" });
  expect(depending._reason({ subject: "unfinished" })).toEqual([{ reason: "source" }]);

  depending.beginAttempt({ subject: "unfinished" });
  expect(depending._reason({ subject: "unfinished" })).toEqual([]);
  depending.settleAttempt({ subject: "unfinished" });
  expect(() => depending.settleAttempt({ subject: "unfinished" })).toThrow(NotBuilding);
});

test("result and use identities are stable, collision-safe, and keyed by their facts", () => {
  const depending = new DependencyTrackingConcept();
  const first = depending.beginAttempt({ subject: "a:b" });
  const firstUse = depending.recordDependency({ subject: "a:b", input: "c" });
  expect(depending.recordDependency({ subject: "a:b", input: "c" })).toEqual(firstUse);
  depending.settleAttempt({ subject: "a:b" });

  const second = depending.beginAttempt({ subject: "a" });
  const secondUse = depending.recordDependency({ subject: "a", input: "b:c" });
  depending.settleAttempt({ subject: "a" });

  expect(first.result).toBe(`result:${JSON.stringify("a:b")}`);
  expect(firstUse.use).toBe(`use:${JSON.stringify([first.result, "c"])}`);
  expect(firstUse.use).not.toBe(secondUse.use);
  expect(first.result).not.toBe(second.result);

  depending.beginAttempt({ subject: "a:b" });
  const changedUse = depending.recordDependency({ subject: "a:b", input: "different" });
  expect(changedUse.use).not.toBe(firstUse.use);
  expect(depending._uses({ subject: "a:b" })).toEqual([{ input: "c" }]);
  depending.beginAttempt({ subject: "a:b" });
  expect(depending.recordDependency({ subject: "a:b", input: "c" })).toEqual(firstUse);
  depending.settleAttempt({ subject: "a:b" });

  expect(depending.removeResult({ subject: "a:b" })).toEqual({ result: first.result });
  expect(depending.beginAttempt({ subject: "a:b" })).toEqual(first);
  const another = new DependencyTrackingConcept();
  expect(another.beginAttempt({ subject: "a:b" })).toEqual(first);
  expect(another.recordDependency({ subject: "a:b", input: "c" })).toEqual(firstUse);
});

test("many queries and equal-length invalidation paths use UTF-8 byte order", () => {
  const depending = new DependencyTrackingConcept();
  const subjects = ["z", "\ue000", "\u{10000}"];
  for (const subject of [...subjects].reverse()) finish(depending, subject, ["origin"]);
  expect(depending._dependents({ input: "origin" })).toEqual(subjects.map((subject) => ({ subject })));

  depending.beginAttempt({ subject: "ordered-inputs" });
  for (const input of [...subjects].reverse()) depending.recordDependency({ subject: "ordered-inputs", input });
  depending.settleAttempt({ subject: "ordered-inputs" });
  expect(depending._uses({ subject: "ordered-inputs" })).toEqual(subjects.map((input) => ({ input })));
  depending.removeResult({ subject: "ordered-inputs" });

  finish(depending, "diamond", ["\u{10000}", "\ue000"]);
  expect(depending.invalidate({ input: "origin" }).count).toBe(4);
  expect(depending._reason({ subject: "diamond" })).toEqual([{ reason: "\ue000" }]);
  expect(depending._stale().map(({ subject }) => subject)).toEqual(["diamond", ...subjects]);
});

test("unknown subjects are virtual stale results and inputs need no corresponding result", () => {
  const depending = new DependencyTrackingConcept();
  expect(depending._state({ subject: "missing" })).toEqual({ state: "stale" });
  expect(depending._current({ subject: "missing" })).toEqual([]);
  expect(depending._reason({ subject: "missing" })).toEqual([]);
  expect(depending._uses({ subject: "missing" })).toEqual([]);
  expect(depending._stale()).toEqual([]);
  expect(depending.invalidate({ input: "missing" })).toEqual({ input: "missing", count: 0 });
  expect(() => depending.recordDependency({ subject: "missing", input: "anything" })).toThrow(NotBuilding);
  expect(() => depending.settleAttempt({ subject: "missing" })).toThrow(NotBuilding);

  const expectedMissing = { result: `result:${JSON.stringify("unrecorded-input")}` };
  expect(depending.removeResult({ subject: "unrecorded-input" })).toEqual(expectedMissing);
  expect(depending._stale()).toEqual([]);

  finish(depending, "consumer", ["unrecorded-input"]);
  expect(depending._dependents({ input: "unrecorded-input" })).toEqual([{ subject: "consumer" }]);
  expect(depending.removeResult({ subject: "unrecorded-input" })).toEqual(expectedMissing);
  expect(depending._current({ subject: "consumer" })).toHaveLength(1);
  expect(depending.invalidate({ input: "unrecorded-input" })).toEqual({ input: "unrecorded-input", count: 1 });
  depending.removeResult({ subject: "consumer" });
  expect(depending._dependents({ input: "unrecorded-input" })).toEqual([]);

  const upstream = finish(depending, "upstream", ["source"]);
  finish(depending, "downstream", ["upstream"]);
  expect(depending.removeResult({ subject: "upstream" })).toEqual({ result: upstream.result });
  expect(depending._dependents({ input: "source" })).toEqual([]);
  expect(depending._dependents({ input: "upstream" })).toEqual([{ subject: "downstream" }]);
  expect(depending._current({ subject: "downstream" })).toHaveLength(1);
  expect(depending.invalidate({ input: "upstream" })).toEqual({ input: "upstream", count: 1 });
});

test("actions reject malformed runtime text atomically and lookup queries stay total", () => {
  const depending = new DependencyTrackingConcept();
  depending.beginAttempt({ subject: "kept" });
  depending.recordDependency({ subject: "kept", input: "valid" });
  const invalid = [1, null, undefined, "\ud800"];

  for (const value of invalid) {
    expect(() => depending.beginAttempt({ subject: value })).toThrow(InvalidText);
    expect(() => depending.recordDependency({ subject: value, input: "input" })).toThrow(InvalidText);
    expect(() => depending.recordDependency({ subject: "kept", input: value })).toThrow(InvalidText);
    expect(() => depending.settleAttempt({ subject: value })).toThrow(InvalidText);
    expect(() => depending.abandonAttempt({ subject: value })).toThrow(InvalidText);
    expect(() => depending.invalidate({ input: value })).toThrow(InvalidText);
    expect(() => depending.removeResult({ subject: value })).toThrow(InvalidText);
    expect(depending._state({ subject: value })).toEqual({ state: "stale" });
    expect(depending._current({ subject: value })).toEqual([]);
    expect(depending._reason({ subject: value })).toEqual([]);
    expect(depending._uses({ subject: value })).toEqual([]);
    expect(depending._dependents({ input: value })).toEqual([]);
  }

  expect(depending._state({ subject: "kept" })).toEqual({ state: "building" });
  expect(depending._uses({ subject: "kept" })).toEqual([{ input: "valid" }]);
  expect(() => depending.invalidate({ input: "\ud800" })).toThrow("Subjects and inputs must be well-formed text.");
});

test("the registry exposes every refusal with its normative message", async () => {
  expect(dependencyTrackingRegistration.refusals).toEqual({
    ATTEMPT_EXHAUSTED: AttemptExhausted,
    INVALID_TEXT: InvalidText,
    NOT_BUILDING: NotBuilding,
    STALE_ATTEMPT: StaleAttempt,
  });
  expect(
    dependencyTrackingRegistration.specification.actions.flatMap(({ refusals }) =>
      refusals.map(({ code, message }) => [code, message]),
    ),
  ).toEqual([
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["ATTEMPT_EXHAUSTED", "No further computation attempt can be represented."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["NOT_BUILDING", "This result is not being computed."],
    ["STALE_ATTEMPT", "This computation attempt is no longer active."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["NOT_BUILDING", "This result is not being computed."],
    ["STALE_ATTEMPT", "This computation attempt is no longer active."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["NOT_BUILDING", "This result is not being computed."],
    ["STALE_ATTEMPT", "This computation attempt is no longer active."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
    ["INVALID_TEXT", "Subjects and inputs must be well-formed text."],
  ]);

  const concepts = conceptSet({ DependencyTracking: dependencyTrackingRegistration });
  const app = assemble({ conceptSet: concepts, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.DependencyTracking.beginAttempt({ subject: 1 })).toEqual({
    error: "INVALID_TEXT",
    detail: "Subjects and inputs must be well-formed text.",
  });
  expect(await app.concepts.DependencyTracking.recordDependency({ subject: "missing", attempt: 1, input: "input" })).toEqual({
    error: "NOT_BUILDING",
    detail: "This result is not being computed.",
  });
  await app.whenIdle();
});

test("stale attempts cannot mutate a replacement computation", () => {
  const depending = new StrictDependencyTrackingConcept();
  const first = depending.beginAttempt({ subject: "page" });
  const second = depending.beginAttempt({ subject: "page" });

  expect(() => depending.recordDependency({ subject: "page", attempt: first.attempt, input: "stale" })).toThrow(StaleAttempt);
  depending.recordDependency({ subject: "page", attempt: second.attempt, input: "current" });
  expect(() => depending.settleAttempt({ subject: "page", attempt: first.attempt })).toThrow(StaleAttempt);
  depending.settleAttempt({ subject: "page", attempt: second.attempt });
  expect(depending._uses({ subject: "page" })).toEqual([{ input: "current" }]);
});
