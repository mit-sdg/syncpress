import { isProxy } from "node:util/types";

export class InvalidText extends Error {}
export class InvalidPhases extends Error {}
export class NoPhases extends Error {}
export class PhaseRepeated extends Error {}
export class SequenceNotFound extends Error {}
export class SequenceActive extends Error {}
export class JobNotRunning extends Error {}
export class StaleAttempt extends Error {}

type JobState = "running" | "finished" | "failed";
type SequenceRecord = { sequence: string; name: string; phases: readonly string[] };
type TransitionRecord = { job: string; name: string; phase: string | null; attempt: string | null };
type JobRecord = {
  job: string;
  sequence: string;
  name: string;
  phases: readonly string[];
  index: number;
  order: bigint;
  state: JobState;
  transitions: Map<string, TransitionRecord>;
  reason?: string;
};

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function requireText(value: unknown): asserts value is string {
  if (!isText(value)) throw new InvalidText();
}

function normalizePhases(value: unknown): readonly string[] {
  if (isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    throw new InvalidPhases();
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || !keys.includes("length")) throw new InvalidPhases();
  if (value.length === 0) throw new NoPhases();

  const phases: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || !isText(descriptor.value)) {
      throw new InvalidPhases();
    }
    phases.push(descriptor.value);
  }
  if (new Set(phases).size !== phases.length) throw new PhaseRepeated();
  return Object.freeze(phases);
}

function samePhases(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((phase, index) => phase === right[index]);
}

function sequenceIdentity(name: string): string {
  return `sequence:${JSON.stringify(name)}`;
}

function currentPhase(job: JobRecord): string {
  return job.phases[job.index]!;
}

function attemptIdentity(job: string, index: number): string {
  return `phase-attempt:${JSON.stringify([job, index])}`;
}

/** Advance independent jobs through an explicitly declared sequence of barriers. */
export class PhasingConcept {
  readonly #sequencesByName = new Map<string, SequenceRecord>();
  readonly #sequencesByID = new Map<string, SequenceRecord>();
  readonly #jobs = new Map<string, JobRecord>();
  readonly #latestBySequence = new Map<string, JobRecord>();
  #nextJob = 1n;

  declare({ name, phases }: { name: unknown; phases: unknown }) {
    requireText(name);
    const normalized = normalizePhases(phases);
    const current = this.#sequencesByName.get(name);
    if (current !== undefined && samePhases(current.phases, normalized)) {
      return { sequence: current.sequence, changed: false };
    }

    const sequence = current?.sequence ?? sequenceIdentity(name);
    const record: SequenceRecord = { sequence, name, phases: normalized };
    this.#sequencesByName.set(name, record);
    this.#sequencesByID.set(sequence, record);
    return { sequence, changed: true };
  }

  start({ sequence }: { sequence: string }) {
    if (!isText(sequence)) throw new SequenceNotFound();
    const plan = this.#sequencesByID.get(sequence);
    if (plan === undefined) throw new SequenceNotFound();
    if ([...this.#jobs.values()].some((job) => job.sequence === sequence && job.state === "running")) {
      throw new SequenceActive();
    }

    const order = this.#nextJob;
    this.#nextJob += 1n;
    const job = `job:${order}`;
    const phases = Object.freeze([...plan.phases]);
    const record: JobRecord = { job, sequence, name: plan.name, phases, index: 0, order, state: "running", transitions: new Map() };
    this.#jobs.set(job, record);
    this.#latestBySequence.set(sequence, record);
    return { job, name: plan.name, phase: phases[0]!, attempt: attemptIdentity(job, 0) };
  }

  completePhase({ job, attempt }: { job: string; attempt: string }) {
    const record = isText(job) ? this.#jobs.get(job) : undefined;
    if (record === undefined) throw new JobNotRunning();
    const completed = isText(attempt) ? record.transitions.get(attempt) : undefined;
    if (completed !== undefined) return { ...completed, transitioned: false };
    if (record.state !== "running") throw new JobNotRunning();
    if (attempt !== attemptIdentity(job, record.index)) throw new StaleAttempt();

    let next: TransitionRecord;
    if (record.index < record.phases.length - 1) {
      record.index += 1;
      next = { job, name: record.name, phase: currentPhase(record), attempt: attemptIdentity(job, record.index) };
    } else {
      record.state = "finished";
      next = { job, name: record.name, phase: null, attempt: null };
    }
    record.transitions.set(attempt, next);
    return { ...next, transitioned: true };
  }

  abandon({ job, attempt, reason }: { job: string; attempt: string; reason: unknown }) {
    const record = isText(job) ? this.#jobs.get(job) : undefined;
    if (record?.state !== "running") throw new JobNotRunning();
    if (attempt !== attemptIdentity(record.job, record.index)) throw new StaleAttempt();
    requireText(reason);

    record.state = "failed";
    record.reason = reason;
    return { job, reason };
  }

  _job({ job }: { job: string }): { sequence: string; name: string; phase: string; attempt: string; state: JobState }[] {
    if (!isText(job)) return [];
    const record = this.#jobs.get(job);
    return record === undefined ? [] : [{
      sequence: record.sequence,
      name: record.name,
      phase: currentPhase(record),
      attempt: attemptIdentity(record.job, record.index),
      state: record.state,
    }];
  }

  _running({ sequence }: { sequence: string }): { job: string; name: string; phase: string; attempt: string }[] {
    if (!isText(sequence)) return [];
    return [...this.#jobs.values()]
      .filter((job) => job.sequence === sequence && job.state === "running")
      .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0))
      .map((record) => ({ job: record.job, name: record.name, phase: currentPhase(record), attempt: attemptIdentity(record.job, record.index) }));
  }

  _latest({ sequence }: { sequence: string }): { job: string; name: string; phase: string; attempt: string; state: JobState }[] {
    if (!isText(sequence)) return [];
    const record = this.#latestBySequence.get(sequence);
    return record === undefined ? [] : [{
      job: record.job,
      name: record.name,
      phase: currentPhase(record),
      attempt: attemptIdentity(record.job, record.index),
      state: record.state,
    }];
  }

  _outcome({ job }: { job: string }): { state: Exclude<JobState, "running">; reason?: string }[] {
    if (!isText(job)) return [];
    const record = this.#jobs.get(job);
    if (record === undefined || record.state === "running") return [];
    return [{ state: record.state, ...(record.reason === undefined ? {} : { reason: record.reason }) }];
  }
}
