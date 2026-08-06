import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidPhases,
  InvalidText,
  JobNotRunning,
  NoPhases,
  PhaseRepeated,
  PhasingConcept,
  SequenceActive,
  SequenceNotFound,
  StaleAttempt,
} from "./phasing.ts";
import { phasing as registration } from "./registry.ts";

function advance(phasing: PhasingConcept, cursor: { job: string; attempt: string }) {
  const result = phasing.advance(cursor);
  if (result.attempt !== null) cursor.attempt = result.attempt;
  return result;
}

test("its principle: exact attempts move independent sequences without duplicate announcements", () => {
  const phasing = new PhasingConcept();
  const declared = phasing.declare({ name: "article", phases: ["draft", "review", "publish"] });
  expect(declared.changed).toBe(true);
  expect(phasing.declare({ name: "article", phases: ["draft", "review", "publish"] })).toEqual({
    sequence: declared.sequence,
    changed: false,
  });

  const first = phasing.start({ sequence: declared.sequence });
  expect(() => phasing.start({ sequence: declared.sequence })).toThrow(SequenceActive);
  const otherSequence = phasing.declare({ name: "translation", phases: ["draft", "publish"] }).sequence;
  const second = phasing.start({ sequence: otherSequence });
  expect(first).toMatchObject({ phase: "draft" });
  expect(second).toMatchObject({ phase: "draft" });
  const draftAttempt = first.attempt;
  const reviewed = advance(phasing, first);
  expect(reviewed).toMatchObject({ job: first.job, phase: "review", transitioned: true });
  expect(phasing.advance({ job: first.job, attempt: draftAttempt })).toEqual({ ...reviewed, transitioned: false });
  expect(advance(phasing, first)).toMatchObject({ job: first.job, phase: "publish", transitioned: true });
  expect(phasing._job({ job: second.job })).toEqual([{
    sequence: otherSequence,
    name: "translation",
    phase: "draft",
    attempt: second.attempt,
    state: "running",
  }]);

  const finished = advance(phasing, first);
  expect(finished).toEqual({ job: first.job, name: "article", phase: null, attempt: null, transitioned: true });
  expect(phasing.advance(first)).toEqual({ ...finished, transitioned: false });
  expect(phasing._job({ job: first.job })).toEqual([{
    sequence: declared.sequence,
    name: "article",
    phase: "publish",
    attempt: first.attempt,
    state: "finished",
  }]);
  expect(phasing._outcome({ job: first.job })).toEqual([{ state: "finished" }]);

  expect(phasing.abandon({ job: second.job, attempt: second.attempt, reason: "Review was withdrawn." })).toEqual({
    job: second.job,
    reason: "Review was withdrawn.",
  });
  expect(phasing._outcome({ job: second.job })).toEqual([{ state: "failed", reason: "Review was withdrawn." }]);
  expect(() => phasing.abandon({ job: second.job, attempt: second.attempt, reason: "again" })).toThrow(JobNotRunning);
});

test("advance announces seven barriers exactly once after a starting phase", () => {
  const phasing = new PhasingConcept();
  const barriers = Array.from({ length: 7 }, (_, index) => `step-${index + 1}`);
  const sequence = phasing.declare({ name: "seven steps", phases: ["waiting", ...barriers] }).sequence;
  const started = phasing.start({ sequence });
  const announced: string[] = [];
  expect(started.phase).toBe("waiting");

  while (true) {
    const { phase } = advance(phasing, started);
    if (phase === null) break;
    announced.push(phase);
  }

  expect(announced).toEqual(barriers);
  expect(phasing._job({ job: started.job })).toEqual([{
    sequence,
    name: "seven steps",
    phase: "step-7",
    attempt: started.attempt,
    state: "finished",
  }]);
});

test("changed declarations affect new jobs but running jobs keep their starting plan", () => {
  const phasing = new PhasingConcept();
  const original = ["one", "two", "three"];
  const declared = phasing.declare({ name: "process", phases: original });
  const oldJob = phasing.start({ sequence: declared.sequence });
  original[1] = "mutated by caller";

  expect(phasing.declare({ name: "process", phases: ["new", "done"] })).toEqual({
    sequence: declared.sequence,
    changed: true,
  });
  expect(() => phasing.start({ sequence: declared.sequence })).toThrow(SequenceActive);

  expect(advance(phasing, oldJob).phase).toBe("two");
  expect(advance(phasing, oldJob).phase).toBe("three");
  expect(advance(phasing, oldJob).phase).toBeNull();
  const newJob = phasing.start({ sequence: declared.sequence });
  expect(newJob.phase).toBe("new");
  expect(advance(phasing, newJob).phase).toBe("done");
  expect(advance(phasing, newJob).phase).toBeNull();
});

test("empty and repeated phases are refused without replacing a valid plan", () => {
  const phasing = new PhasingConcept();
  const declared = phasing.declare({ name: "process", phases: ["first", "last"] });

  expect(() => phasing.declare({ name: "process", phases: [] })).toThrow(NoPhases);
  expect(() => phasing.declare({ name: "process", phases: ["same", "same"] })).toThrow(PhaseRepeated);
  expect(() => phasing.declare({ name: "process", phases: ["same", "same", 1] })).toThrow(InvalidPhases);
  expect(phasing.declare({ name: "process", phases: ["first", "last"] })).toEqual({
    sequence: declared.sequence,
    changed: false,
  });
  expect(phasing.start({ sequence: declared.sequence }).phase).toBe("first");
});

test("phase plans reject malformed runtime structures and copy valid frozen input", () => {
  class PhaseList extends Array<unknown> {}

  const phasing = new PhasingConcept();
  const sparse = Array(1);
  const decorated = Object.assign(["one"], { extra: true });
  const symbolDecorated = Object.assign(["one"], { [Symbol("extra")]: true });
  const changedPrototype = ["one"];
  Object.setPrototypeOf(changedPrototype, null);
  const proxy = new Proxy(["one"], {});
  const revoked = Proxy.revocable(["one"], {});
  revoked.revoke();

  for (const phases of [null, "one", [1], ["\ud800"], sparse, decorated, symbolDecorated, new PhaseList("one"), changedPrototype, proxy, revoked.proxy]) {
    expect(() => phasing.declare({ name: "invalid", phases })).toThrow(InvalidPhases);
  }

  const frozen = Object.freeze(["one", "two"]);
  const sequence = phasing.declare({ name: "valid", phases: frozen }).sequence;
  expect(phasing.start({ sequence }).phase).toBe("one");
  expect(phasing.declare({ name: "invalid", phases: ["now valid"] }).changed).toBe(true);
});

test("actions validate text and exact attempts without corrupting running jobs", () => {
  const phasing = new PhasingConcept();
  expect(() => phasing.declare({ name: 1, phases: ["one"] })).toThrow(InvalidText);
  expect(() => phasing.declare({ name: "\ud800", phases: ["one"] })).toThrow(InvalidText);

  const sequence = phasing.declare({ name: "process", phases: ["one", "two"] }).sequence;
  expect(() => phasing.start({ sequence: "missing" })).toThrow(SequenceNotFound);
  expect(() => phasing.start({ sequence: 1 as unknown as string })).toThrow(SequenceNotFound);

  const started = phasing.start({ sequence });
  expect(() => phasing.advance({ job: started.job, attempt: "stale" })).toThrow(StaleAttempt);
  expect(() => phasing.abandon({ job: started.job, attempt: "stale", reason: "stop" })).toThrow(StaleAttempt);
  expect(() => phasing.abandon({ job: started.job, attempt: started.attempt, reason: 1 })).toThrow(InvalidText);
  expect(() => phasing.abandon({ job: started.job, attempt: started.attempt, reason: "\ud800" })).toThrow(InvalidText);
  expect(phasing._job({ job: started.job })).toEqual([{
    sequence,
    name: "process",
    phase: "one",
    attempt: started.attempt,
    state: "running",
  }]);
  expect(advance(phasing, started).phase).toBe("two");
});

test("unknown jobs are refused by actions and absent from optional queries", () => {
  const phasing = new PhasingConcept();
  expect(() => phasing.advance({ job: "missing", attempt: "missing" })).toThrow(JobNotRunning);
  expect(() => phasing.advance({ job: null as unknown as string, attempt: "missing" })).toThrow(JobNotRunning);
  expect(() => phasing.abandon({ job: "missing", attempt: "missing", reason: 1 })).toThrow(JobNotRunning);
  expect(phasing._job({ job: "missing" })).toEqual([]);
  expect(phasing._job({ job: null as never })).toEqual([]);
  expect(phasing._outcome({ job: "missing" })).toEqual([]);
  expect(phasing._outcome({ job: null as never })).toEqual([]);
});

test("running and latest jobs are scoped to their sequence", () => {
  const phasing = new PhasingConcept();
  const firstSequence = phasing.declare({ name: "first", phases: ["only"] }).sequence;
  const secondSequence = phasing.declare({ name: "second", phases: ["only"] }).sequence;
  const first = phasing.start({ sequence: firstSequence });
  const second = phasing.start({ sequence: secondSequence });

  expect(phasing._running({ sequence: firstSequence })).toEqual([
    { job: first.job, name: "first", phase: first.phase, attempt: first.attempt },
  ]);
  advance(phasing, first);
  expect(phasing._running({ sequence: firstSequence })).toEqual([]);
  expect(phasing._latest({ sequence: firstSequence })).toEqual([{
    job: first.job,
    name: "first",
    phase: "only",
    attempt: first.attempt,
    state: "finished",
  }]);
  expect(phasing._running({ sequence: secondSequence })).toEqual([
    { job: second.job, name: "second", phase: second.phase, attempt: second.attempt },
  ]);
});

test("sequence identities are deterministic and distinct for arbitrary text names", () => {
  const first = new PhasingConcept();
  const second = new PhasingConcept();
  const names = ["a:b", "a", "__proto__", "", "é"];
  const firstIDs = names.map((name) => first.declare({ name, phases: ["one"] }).sequence);
  const secondIDs = names.map((name) => second.declare({ name, phases: ["one"] }).sequence);

  expect(firstIDs).toEqual(secondIDs);
  expect(new Set(firstIDs).size).toBe(names.length);
  expect(first.declare({ name: "ordered", phases: ["one", "two"] }).changed).toBe(true);
  expect(first.declare({ name: "ordered", phases: ["two", "one"] }).changed).toBe(true);
});

test("registry refusals, query promises, and assembled outcomes match the specification", async () => {
  expect(registration.refusals).toEqual({
    INVALID_TEXT: InvalidText,
    INVALID_PHASES: InvalidPhases,
    NO_PHASES: NoPhases,
    PHASE_REPEATED: PhaseRepeated,
    SEQUENCE_NOT_FOUND: SequenceNotFound,
    SEQUENCE_ACTIVE: SequenceActive,
    JOB_NOT_RUNNING: JobNotRunning,
    STALE_ATTEMPT: StaleAttempt,
  });
  expect(registration.specification.queries.map(({ name, inputs, promise }) => ({ name, inputs, promise }))).toEqual([
    { name: "_job", inputs: ["job"], promise: "optional" },
    { name: "_running", inputs: ["sequence"], promise: "optional" },
    { name: "_latest", inputs: ["sequence"], promise: "optional" },
    { name: "_outcome", inputs: ["job"], promise: "optional" },
  ]);
  expect(registration.specification.actions.flatMap(({ refusals }) => refusals.map(({ code, message }) => [code, message]))).toEqual([
    ["INVALID_TEXT", "Sequence names and failure reasons must be well-formed text."],
    ["INVALID_PHASES", "Phases must be an ordinary dense list of text values."],
    ["NO_PHASES", "A sequence needs at least one phase."],
    ["PHASE_REPEATED", "A phase may occur only once in a sequence."],
    ["SEQUENCE_NOT_FOUND", "There is no such sequence."],
    ["SEQUENCE_ACTIVE", "This sequence already has a running job."],
    ["JOB_NOT_RUNNING", "This job is not running."],
    ["STALE_ATTEMPT", "This phase attempt is not current."],
    ["JOB_NOT_RUNNING", "This job is not running."],
    ["STALE_ATTEMPT", "This phase attempt is not current."],
    ["INVALID_TEXT", "Sequence names and failure reasons must be well-formed text."],
  ]);

  const concepts = conceptSet({ Phasing: registration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.Phasing.declare({ name: "empty", phases: [] })).toEqual({
    error: "NO_PHASES",
    detail: "A sequence needs at least one phase.",
  });
  const declared = (await app.concepts.Phasing.declare({ name: "process", phases: ["only"] })) as { sequence: string };
  const started = (await app.concepts.Phasing.start({ sequence: declared.sequence })) as { job: string; attempt: string };
  expect(await app.concepts.Phasing._job({ job: started.job })).toEqual([
    { sequence: declared.sequence, name: "process", phase: "only", attempt: started.attempt, state: "running" },
  ]);
  expect(await app.concepts.Phasing._job({ job: "missing" })).toEqual([]);
  await app.whenIdle();
});
