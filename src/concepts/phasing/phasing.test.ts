import { expect, test } from "bun:test";
import { assemble, conceptSet } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidPhases,
  InvalidText,
  JobNotRunning,
  NoPhases,
  PhaseRepeated,
  PhasingConcept,
  SequenceNotFound,
  UnknownMode,
} from "./phasing.ts";
import { phasing as registration } from "./registry.ts";

test("its principle: independent jobs move in order and announce no terminal phase twice", () => {
  const phasing = new PhasingConcept();
  const declared = phasing.declare({ name: "article", phases: ["draft", "review", "publish"] });
  expect(declared.changed).toBe(true);
  expect(phasing.declare({ name: "article", phases: ["draft", "review", "publish"] })).toEqual({
    sequence: declared.sequence,
    changed: false,
  });

  const first = phasing.start({ sequence: declared.sequence, mode: "once" });
  const second = phasing.start({ sequence: declared.sequence, mode: "live" });
  expect(first).toMatchObject({ phase: "draft", mode: "once" });
  expect(second).toMatchObject({ phase: "draft", mode: "live" });
  expect(phasing.advance({ job: first.job })).toEqual({ job: first.job, phase: "review", mode: "once" });
  expect(phasing.advance({ job: first.job })).toEqual({ job: first.job, phase: "publish", mode: "once" });
  expect(phasing._job({ job: second.job })).toEqual([{ phase: "draft", state: "running", mode: "live" }]);

  expect(phasing.advance({ job: first.job })).toEqual({ job: first.job, phase: null, mode: "once" });
  expect(phasing._job({ job: first.job })).toEqual([{ phase: "publish", state: "finished", mode: "once" }]);
  expect(phasing._outcome({ job: first.job })).toEqual([{ state: "finished" }]);
  expect(() => phasing.advance({ job: first.job })).toThrow(JobNotRunning);

  expect(phasing.abandon({ job: second.job, reason: "Review was withdrawn." })).toEqual({
    job: second.job,
    reason: "Review was withdrawn.",
  });
  expect(phasing._outcome({ job: second.job })).toEqual([{ state: "failed", reason: "Review was withdrawn." }]);
  expect(() => phasing.abandon({ job: second.job, reason: "again" })).toThrow(JobNotRunning);
});

test("advance announces seven barriers exactly once after a starting phase", () => {
  const phasing = new PhasingConcept();
  const barriers = Array.from({ length: 7 }, (_, index) => `step-${index + 1}`);
  const sequence = phasing.declare({ name: "seven steps", phases: ["waiting", ...barriers] }).sequence;
  const started = phasing.start({ sequence, mode: "once" });
  const announced: string[] = [];
  expect(started.phase).toBe("waiting");

  while (true) {
    const { phase } = phasing.advance({ job: started.job });
    if (phase === null) break;
    announced.push(phase);
  }

  expect(announced).toEqual(barriers);
  expect(phasing._job({ job: started.job })).toEqual([{ phase: "step-7", state: "finished", mode: "once" }]);
});

test("changed declarations affect new jobs but running jobs keep their starting plan", () => {
  const phasing = new PhasingConcept();
  const original = ["one", "two", "three"];
  const declared = phasing.declare({ name: "process", phases: original });
  const oldJob = phasing.start({ sequence: declared.sequence, mode: "once" });
  original[1] = "mutated by caller";

  expect(phasing.declare({ name: "process", phases: ["new", "done"] })).toEqual({
    sequence: declared.sequence,
    changed: true,
  });
  const newJob = phasing.start({ sequence: declared.sequence, mode: "once" });

  expect(phasing.advance({ job: oldJob.job }).phase).toBe("two");
  expect(phasing.advance({ job: newJob.job }).phase).toBe("done");
  expect(phasing.advance({ job: oldJob.job }).phase).toBe("three");
  expect(phasing.advance({ job: oldJob.job }).phase).toBeNull();
  expect(phasing.advance({ job: newJob.job }).phase).toBeNull();
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
  expect(phasing.start({ sequence: declared.sequence, mode: "once" }).phase).toBe("first");
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
  expect(phasing.start({ sequence, mode: "once" }).phase).toBe("one");
  expect(phasing.declare({ name: "invalid", phases: ["now valid"] }).changed).toBe(true);
});

test("actions validate text and modes without corrupting running jobs", () => {
  const phasing = new PhasingConcept();
  expect(() => phasing.declare({ name: 1, phases: ["one"] })).toThrow(InvalidText);
  expect(() => phasing.declare({ name: "\ud800", phases: ["one"] })).toThrow(InvalidText);

  const sequence = phasing.declare({ name: "process", phases: ["one", "two"] }).sequence;
  expect(() => phasing.start({ sequence, mode: "other" })).toThrow(UnknownMode);
  expect(() => phasing.start({ sequence, mode: null })).toThrow(UnknownMode);
  expect(() => phasing.start({ sequence: "missing", mode: "other" })).toThrow(SequenceNotFound);
  expect(() => phasing.start({ sequence: 1, mode: "once" })).toThrow(SequenceNotFound);

  const started = phasing.start({ sequence, mode: "once" });
  expect(() => phasing.abandon({ job: started.job, reason: 1 })).toThrow(InvalidText);
  expect(() => phasing.abandon({ job: started.job, reason: "\ud800" })).toThrow(InvalidText);
  expect(phasing._job({ job: started.job })).toEqual([{ phase: "one", state: "running", mode: "once" }]);
  expect(phasing.advance({ job: started.job }).phase).toBe("two");
});

test("unknown jobs are refused by actions and absent from optional queries", () => {
  const phasing = new PhasingConcept();
  expect(() => phasing.advance({ job: "missing" })).toThrow(JobNotRunning);
  expect(() => phasing.advance({ job: null })).toThrow(JobNotRunning);
  expect(() => phasing.abandon({ job: "missing", reason: 1 })).toThrow(JobNotRunning);
  expect(phasing._job({ job: "missing" })).toEqual([]);
  expect(phasing._job({ job: null })).toEqual([]);
  expect(phasing._outcome({ job: "missing" })).toEqual([]);
  expect(phasing._outcome({ job: null })).toEqual([]);
});

test("running jobs are returned in start order and terminal jobs are excluded", () => {
  const phasing = new PhasingConcept();
  const sequence = phasing.declare({ name: "single step", phases: ["only"] }).sequence;
  const jobs = Array.from({ length: 12 }, (_, index) =>
    phasing.start({ sequence, mode: index % 2 === 0 ? "once" : "live" }),
  );

  phasing.advance({ job: jobs[1]!.job });
  phasing.abandon({ job: jobs[4]!.job, reason: "stopped" });
  const expected = jobs.filter((_, index) => index !== 1 && index !== 4);
  expect(phasing._running()).toEqual(
    expected.map(({ job, phase, mode }) => ({ job, phase, mode })),
  );
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
    UNKNOWN_MODE: UnknownMode,
    JOB_NOT_RUNNING: JobNotRunning,
  });
  expect(registration.specification.queries).toEqual([
    { name: "_job", inputs: ["job"], promise: "optional" },
    { name: "_running", inputs: [], promise: "many" },
    { name: "_outcome", inputs: ["job"], promise: "optional" },
  ]);
  expect(registration.specification.actions.flatMap(({ refusals }) => refusals.map(({ code, message }) => [code, message]))).toEqual([
    ["INVALID_TEXT", "Sequence names and failure reasons must be well-formed text."],
    ["INVALID_PHASES", "Phases must be an ordinary dense list of text values."],
    ["NO_PHASES", "A sequence needs at least one phase."],
    ["PHASE_REPEATED", "A phase may occur only once in a sequence."],
    ["SEQUENCE_NOT_FOUND", "There is no such sequence."],
    ["UNKNOWN_MODE", "A job mode must be once or live."],
    ["JOB_NOT_RUNNING", "This job is not running."],
    ["JOB_NOT_RUNNING", "This job is not running."],
    ["INVALID_TEXT", "Sequence names and failure reasons must be well-formed text."],
  ]);

  const concepts = conceptSet({ Phasing: registration });
  const app = assemble({ vocabulary: concepts.vocabulary, instances: concepts.implementations(), composition: {} });
  expect(await app.concepts.Phasing.declare({ name: "empty", phases: [] })).toEqual({
    error: "NO_PHASES",
    detail: "A sequence needs at least one phase.",
  });
  const declared = (await app.concepts.Phasing.declare({ name: "process", phases: ["only"] })) as { sequence: string };
  const started = (await app.concepts.Phasing.start({ sequence: declared.sequence, mode: "once" })) as { job: string };
  expect(await app.concepts.Phasing._job({ job: started.job })).toEqual([
    { phase: "only", state: "running", mode: "once" },
  ]);
  expect(await app.concepts.Phasing._job({ job: "missing" })).toEqual([]);
  await app.whenIdle();
});
