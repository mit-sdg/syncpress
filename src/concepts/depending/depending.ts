const INVALID_TEXT_MESSAGE = "Subjects and inputs must be well-formed text.";
const NOT_BUILDING_MESSAGE = "This result is not being computed.";
const STALE_ATTEMPT_MESSAGE = "This computation attempt is no longer active.";
const ATTEMPT_EXHAUSTED_MESSAGE = "No further computation attempt can be represented.";

export class InvalidText extends Error {
  constructor() {
    super(INVALID_TEXT_MESSAGE);
    this.name = "InvalidText";
  }
}

export class NotBuilding extends Error {
  constructor() {
    super(NOT_BUILDING_MESSAGE);
    this.name = "NotBuilding";
  }
}

export class StaleAttempt extends Error {
  constructor() {
    super(STALE_ATTEMPT_MESSAGE);
    this.name = "StaleAttempt";
  }
}

export class AttemptExhausted extends Error {
  constructor() {
    super(ATTEMPT_EXHAUSTED_MESSAGE);
    this.name = "AttemptExhausted";
  }
}

export type ResultState = "building" | "current" | "stale";

type ResultRecord = {
  result: string;
  subject: string;
  state: ResultState;
  reason?: string;
  inputs: Set<string>;
  attemptInputs: Set<string>;
  settled: boolean;
  attempt: number;
};

const encoder = new TextEncoder();

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function requireText(value: unknown): asserts value is string {
  if (!isText(value)) throw new InvalidText();
}

function compareText(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    const comparison = leftBytes[index]! - rightBytes[index]!;
    if (comparison !== 0) return comparison;
  }
  return leftBytes.length - rightBytes.length;
}

function ordered(values: Iterable<string>): string[] {
  return [...values].sort(compareText);
}

function resultIdentity(subject: string): string {
  return `result:${JSON.stringify(subject)}`;
}

function useIdentity(result: string, input: string): string {
  return `use:${JSON.stringify([result, input])}`;
}

/** Track current and stale results in a deterministic dependency graph. */
export class DependingConcept {
  readonly #results = new Map<string, ResultRecord>();
  readonly #dependentsByInput = new Map<string, Set<string>>();

  begin({ subject }: { subject: unknown }) {
    requireText(subject);
    let result = this.#results.get(subject);
    if (result === undefined) {
      result = {
        result: resultIdentity(subject),
        subject,
        state: "building",
        inputs: new Set(),
        attemptInputs: new Set(),
        settled: false,
        attempt: 1,
      };
      this.#results.set(subject, result);
      return { result: result.result, attempt: result.attempt };
    }

    if (result.attempt === Number.MAX_SAFE_INTEGER) throw new AttemptExhausted();
    this.#discardAttempt(result);
    if (result.state === "current") result.reason = undefined;
    result.state = "building";
    result.attempt += 1;
    return { result: result.result, attempt: result.attempt };
  }

  use({ subject, attempt, input }: { subject: unknown; attempt: unknown; input: unknown }) {
    requireText(subject);
    requireText(input);
    const result = this.#results.get(subject);
    if (result?.state !== "building" && result?.state !== "current") throw new NotBuilding();
    if (attempt !== result.attempt) throw new StaleAttempt();

    const inputs = result.state === "building" ? result.attemptInputs : result.inputs;
    if (!inputs.has(input)) {
      inputs.add(input);
      if (result.state === "current" || !result.settled) this.#addDependent(subject, input);
    }
    return { use: useIdentity(result.result, input) };
  }

  settle({ subject, attempt }: { subject: unknown; attempt: unknown }) {
    requireText(subject);
    const result = this.#results.get(subject);
    if (result?.state !== "building") throw new NotBuilding();
    if (attempt !== result.attempt) throw new StaleAttempt();

    if (result.settled) this.#clearInputs(result);
    result.inputs = result.attemptInputs;
    result.attemptInputs = new Set();
    if (result.settled) {
      for (const input of result.inputs) this.#addDependent(result.subject, input);
    }
    result.settled = true;
    result.state = "current";
    return { result: result.result };
  }

  abandon({ subject, attempt }: { subject: unknown; attempt: unknown }) {
    requireText(subject);
    const result = this.#results.get(subject);
    if (result?.state !== "building") throw new NotBuilding();
    if (attempt !== result.attempt) throw new StaleAttempt();

    this.#discardAttempt(result);
    result.state = "stale";
    return { result: result.result };
  }

  touch({ input }: { input: unknown }) {
    requireText(input);
    let frontier = [input];
    const expanded = new Set(frontier);
    let count = 0;

    while (frontier.length > 0) {
      const next = new Set<string>();
      for (const changed of frontier) {
        for (const subject of ordered(this.#dependentsByInput.get(changed) ?? [])) {
          const result = this.#results.get(subject);
          if (result === undefined) continue;
          if (result.state !== "stale") {
            result.state = "stale";
            result.reason = changed;
            count += 1;
          }
          if (!expanded.has(subject)) {
            expanded.add(subject);
            next.add(subject);
          }
        }
      }
      frontier = ordered(next);
    }

    return { input, count };
  }

  drop({ subject }: { subject: unknown }) {
    requireText(subject);
    const result = this.#results.get(subject);
    if (result !== undefined) {
      this.#clearInputs(result);
      this.#discardAttempt(result);
      this.#results.delete(subject);
    }
    return { result: result?.result ?? resultIdentity(subject) };
  }

  _state({ subject }: { subject: unknown }): { state: ResultState } {
    return { state: isText(subject) ? (this.#results.get(subject)?.state ?? "stale") : "stale" };
  }

  _current({ subject }: { subject: unknown }): { result: string }[] {
    if (!isText(subject)) return [];
    const result = this.#results.get(subject);
    return result?.state === "current" ? [{ result: result.result }] : [];
  }

  _attempt({ subject }: { subject: unknown }): { attempt: number }[] {
    if (!isText(subject)) return [];
    const result = this.#results.get(subject);
    return result === undefined ? [] : [{ attempt: result.attempt }];
  }

  _reason({ subject }: { subject: unknown }): { reason: string }[] {
    if (!isText(subject)) return [];
    const reason = this.#results.get(subject)?.reason;
    return reason === undefined ? [] : [{ reason }];
  }

  _stale(): { subject: string; reason: string }[] {
    return [...this.#results.values()]
      .filter((result): result is ResultRecord & { reason: string } => result.state === "stale" && result.reason !== undefined)
      .sort((left, right) => compareText(left.subject, right.subject))
      .map(({ subject, reason }) => ({ subject, reason }));
  }

  _uses({ subject }: { subject: unknown }): { input: string }[] {
    if (!isText(subject)) return [];
    const result = this.#results.get(subject);
    return ordered(result === undefined ? [] : result.settled ? result.inputs : result.attemptInputs).map((input) => ({ input }));
  }

  _dependents({ input }: { input: unknown }): { subject: string }[] {
    if (!isText(input)) return [];
    return ordered(this.#dependentsByInput.get(input) ?? []).map((subject) => ({ subject }));
  }

  #clearInputs(result: ResultRecord): void {
    for (const input of result.inputs) {
      const dependents = this.#dependentsByInput.get(input);
      dependents?.delete(result.subject);
      if (dependents?.size === 0) this.#dependentsByInput.delete(input);
    }
    result.inputs.clear();
  }

  #discardAttempt(result: ResultRecord): void {
    if (!result.settled) {
      for (const input of result.attemptInputs) {
        const dependents = this.#dependentsByInput.get(input);
        dependents?.delete(result.subject);
        if (dependents?.size === 0) this.#dependentsByInput.delete(input);
      }
    }
    result.attemptInputs.clear();
  }

  #addDependent(subject: string, input: string): void {
    let dependents = this.#dependentsByInput.get(input);
    if (dependents === undefined) {
      dependents = new Set();
      this.#dependentsByInput.set(input, dependents);
    }
    dependents.add(subject);
  }
}
