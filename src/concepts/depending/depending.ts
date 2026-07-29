export class NotBuilding extends Error {}

type Result = { result: string; subject: string; state: "building" | "current" | "stale"; reason?: string; inputs: Set<string> };

function ordered(values: Iterable<string>): string[] {
  return [...values].sort();
}

/** Track the derived dependency graph for one build process. */
export class DependingConcept {
  readonly #results = new Map<string, Result>();

  begin({ subject }: { subject: string }) {
    const result = this.#results.get(subject) ?? { result: `result:${subject}`, subject, state: "building" as const, inputs: new Set<string>() };
    result.state = "building";
    result.reason = undefined;
    result.inputs.clear();
    this.#results.set(subject, result);
    return { result: result.result };
  }

  use({ subject, input }: { subject: string; input: string }) {
    const result = this.#results.get(subject);
    if (result?.state !== "building") throw new NotBuilding();
    result.inputs.add(input);
    return { use: `use:${subject}:${input}` };
  }

  settle({ subject }: { subject: string }) {
    const result = this.#results.get(subject);
    if (result?.state !== "building") throw new NotBuilding();
    result.state = "current";
    return { result: result.result };
  }

  touch({ input }: { input: string }) {
    const queue = [input];
    const seen = new Set<string>();
    let count = 0;
    while (queue.length > 0) {
      const changed = queue.shift()!;
      for (const result of this.#results.values()) {
        if (!result.inputs.has(changed) || result.state === "stale") continue;
        result.state = "stale";
        result.reason = changed;
        count += 1;
        if (!seen.has(result.subject)) {
          seen.add(result.subject);
          queue.push(result.subject);
        }
      }
    }
    return { input, count };
  }

  drop({ subject }: { subject: string }) {
    const result = this.#results.get(subject);
    this.#results.delete(subject);
    return { result: result?.result ?? `result:${subject}` };
  }

  _state({ subject }: { subject: string }) {
    return { state: this.#results.get(subject)?.state ?? "stale" };
  }

  _current({ subject }: { subject: string }): { result: string }[] {
    const result = this.#results.get(subject);
    return result?.state === "current" ? [{ result: result.result }] : [];
  }

  _reason({ subject }: { subject: string }): { reason: string }[] {
    const reason = this.#results.get(subject)?.reason;
    return reason === undefined ? [] : [{ reason }];
  }

  _stale(): { subject: string; reason: string }[] {
    return ordered(this.#results.keys())
      .map((subject) => this.#results.get(subject)!)
      .filter((result) => result.state === "stale" && result.reason !== undefined)
      .map(({ subject, reason }) => ({ subject, reason: reason! }));
  }

  _uses({ subject }: { subject: string }): { input: string }[] {
    return ordered(this.#results.get(subject)?.inputs ?? []).map((input) => ({ input }));
  }

  _dependents({ input }: { input: string }): { subject: string }[] {
    return ordered([...this.#results.values()].filter((result) => result.inputs.has(input)).map(({ subject }) => subject)).map((subject) => ({ subject }));
  }
}
