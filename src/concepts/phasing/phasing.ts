export class NoPhases extends Error {}
export class SequenceNotFound extends Error {}
export class JobNotRunning extends Error {}

type Mode = "once" | "live";
type JobState = "running" | "finished" | "failed";
type SequenceRecord = { sequence: string; name: string; phases: string[] };
type JobRecord = { job: string; sequence: string; mode: Mode; phase: string; state: JobState; reason?: string };

function compareText(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    const comparison = leftBytes[index]! - rightBytes[index]!;
    if (comparison !== 0) return comparison;
  }
  return leftBytes.length - rightBytes.length;
}

function samePhases(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((phase, index) => phase === right[index]);
}

/** Advance independent jobs through an explicitly declared sequence of barriers. */
export class PhasingConcept {
  readonly #sequencesByName = new Map<string, SequenceRecord>();
  readonly #sequencesByID = new Map<string, SequenceRecord>();
  readonly #jobs = new Map<string, JobRecord>();
  #nextJob = 1;

  declare({ name, phases }: { name: string; phases: string[] }) {
    if (phases.length === 0) throw new NoPhases();
    const current = this.#sequencesByName.get(name);
    if (current !== undefined && samePhases(current.phases, phases)) return { sequence: current.sequence, changed: false };

    if (current !== undefined) {
      const replacement = { ...current, phases: [...phases] };
      this.#sequencesByName.set(name, replacement);
      this.#sequencesByID.set(replacement.sequence, replacement);
      return { sequence: replacement.sequence, changed: true };
    }

    const sequence = `sequence:${name}`;
    const record = { sequence, name, phases: [...phases] };
    this.#sequencesByName.set(name, record);
    this.#sequencesByID.set(sequence, record);
    return { sequence, changed: true };
  }

  start({ sequence, mode }: { sequence: string; mode: Mode }) {
    const record = this.#sequencesByID.get(sequence);
    if (record === undefined) throw new SequenceNotFound();
    const job = `job:${this.#nextJob++}`;
    const phase = record.phases[0]!;
    this.#jobs.set(job, { job, sequence, mode, phase, state: "running" });
    return { job, phase, mode };
  }

  advance({ job }: { job: string }) {
    const record = this.#jobs.get(job);
    if (record?.state !== "running") throw new JobNotRunning();
    const sequence = this.#sequencesByID.get(record.sequence)!;
    const current = sequence.phases.indexOf(record.phase);
    if (current < sequence.phases.length - 1) {
      record.phase = sequence.phases[current + 1]!;
      return { job, phase: record.phase, mode: record.mode };
    }
    record.state = "finished";
    return { job, phase: record.phase, mode: record.mode };
  }

  abandon({ job, reason }: { job: string; reason: string }) {
    const record = this.#jobs.get(job);
    if (record?.state !== "running") throw new JobNotRunning();
    record.state = "failed";
    record.reason = reason;
    return { job, reason };
  }

  _job({ job }: { job: string }) {
    const record = this.#jobs.get(job)!;
    return { phase: record.phase, state: record.state, mode: record.mode };
  }

  _running(): { job: string; phase: string; mode: Mode }[] {
    return [...this.#jobs.values()]
      .filter(({ state }) => state === "running")
      .sort((left, right) => compareText(left.job, right.job))
      .map(({ job, phase, mode }) => ({ job, phase, mode }));
  }

  _outcome({ job }: { job: string }): { state: Exclude<JobState, "running">; reason?: string }[] {
    const record = this.#jobs.get(job);
    return record === undefined || record.state === "running" ? [] : [{ state: record.state, ...(record.reason === undefined ? {} : { reason: record.reason }) }];
  }
}
