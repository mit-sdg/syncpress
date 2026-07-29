import { isProxy } from "node:util/types";

export class InvalidText extends Error {}
export class InvalidPhases extends Error {}
export class NoPhases extends Error {}
export class PhaseRepeated extends Error {}
export class UnknownMode extends Error {}
export class SequenceNotFound extends Error {}
export class JobNotRunning extends Error {}

type Mode = "once" | "live";
type JobState = "running" | "finished" | "failed";
type SequenceRecord = { sequence: string; name: string; phases: readonly string[] };
type JobRecord = {
  job: string;
  sequence: string;
  phases: readonly string[];
  index: number;
  order: bigint;
  mode: Mode;
  state: JobState;
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

function requireMode(value: unknown): asserts value is Mode {
  if (value !== "once" && value !== "live") throw new UnknownMode();
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

/** Advance independent jobs through an explicitly declared sequence of barriers. */
export class PhasingConcept {
  readonly #sequencesByName = new Map<string, SequenceRecord>();
  readonly #sequencesByID = new Map<string, SequenceRecord>();
  readonly #jobs = new Map<string, JobRecord>();
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

  start({ sequence, mode }: { sequence: unknown; mode: unknown }) {
    if (!isText(sequence)) throw new SequenceNotFound();
    const plan = this.#sequencesByID.get(sequence);
    if (plan === undefined) throw new SequenceNotFound();
    requireMode(mode);

    const order = this.#nextJob;
    this.#nextJob += 1n;
    const job = `job:${order}`;
    const phases = Object.freeze([...plan.phases]);
    this.#jobs.set(job, { job, sequence, phases, index: 0, order, mode, state: "running" });
    return { job, phase: phases[0]!, mode };
  }

  advance({ job }: { job: unknown }) {
    const record = isText(job) ? this.#jobs.get(job) : undefined;
    if (record?.state !== "running") throw new JobNotRunning();

    if (record.index < record.phases.length - 1) {
      record.index += 1;
      return { job, phase: currentPhase(record), mode: record.mode };
    }

    record.state = "finished";
    return { job, phase: null, mode: record.mode };
  }

  abandon({ job, reason }: { job: unknown; reason: unknown }) {
    const record = isText(job) ? this.#jobs.get(job) : undefined;
    if (record?.state !== "running") throw new JobNotRunning();
    requireText(reason);

    record.state = "failed";
    record.reason = reason;
    return { job, reason };
  }

  _job({ job }: { job: unknown }): { phase: string; state: JobState; mode: Mode }[] {
    if (!isText(job)) return [];
    const record = this.#jobs.get(job);
    return record === undefined ? [] : [{ phase: currentPhase(record), state: record.state, mode: record.mode }];
  }

  _running(): { job: string; phase: string; mode: Mode }[] {
    return [...this.#jobs.values()]
      .filter(({ state }) => state === "running")
      .sort((left, right) => (left.order < right.order ? -1 : left.order > right.order ? 1 : 0))
      .map((record) => ({ job: record.job, phase: currentPhase(record), mode: record.mode }));
  }

  _outcome({ job }: { job: unknown }): { state: Exclude<JobState, "running">; reason?: string }[] {
    if (!isText(job)) return [];
    const record = this.#jobs.get(job);
    if (record === undefined || record.state === "running") return [];
    return [{ state: record.state, ...(record.reason === undefined ? {} : { reason: record.reason }) }];
  }
}
