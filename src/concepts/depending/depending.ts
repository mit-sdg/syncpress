const INVALID_TEXT_MESSAGE = "Subjects and inputs must be well-formed text.";
const NOT_BUILDING_MESSAGE = "This result is not being computed.";

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

export type ResultState = "building" | "current" | "stale";

type ResultRecord = {
  result: string;
  subject: string;
  state: ResultState;
  reason?: string;
  inputs: Set<string>;
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
      result = { result: resultIdentity(subject), subject, state: "building", inputs: new Set() };
      this.#results.set(subject, result);
      return { result: result.result };
    }

    this.#clearInputs(result);
    if (result.state === "current") result.reason = undefined;
    result.state = "building";
    return { result: result.result };
  }

  use({ subject, input }: { subject: unknown; input: unknown }) {
    requireText(subject);
    requireText(input);
    const result = this.#results.get(subject);
    if (result?.state !== "building") throw new NotBuilding();

    if (!result.inputs.has(input)) {
      result.inputs.add(input);
      let dependents = this.#dependentsByInput.get(input);
      if (dependents === undefined) {
        dependents = new Set();
        this.#dependentsByInput.set(input, dependents);
      }
      dependents.add(subject);
    }
    return { use: useIdentity(result.result, input) };
  }

  settle({ subject }: { subject: unknown }) {
    requireText(subject);
    const result = this.#results.get(subject);
    if (result?.state !== "building") throw new NotBuilding();
    result.state = "current";
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
    return ordered(this.#results.get(subject)?.inputs ?? []).map((input) => ({ input }));
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
}
