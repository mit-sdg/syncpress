export class UnknownSeverity extends Error {}
export class DiagnosticNotFound extends Error {}

type Severity = "error" | "warning";
type Diagnostic = {
  diagnostic: string;
  severity: Severity;
  code: string;
  message: string;
  source: string;
  line: number;
  column: number;
};
type Relation = { relation: string; diagnostic: string; source: string; line: number; column: number; note: string };

function compareText(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    const comparison = leftBytes[index]! - rightBytes[index]!;
    if (comparison !== 0) return comparison;
  }
  return leftBytes.length - rightBytes.length;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function severityOrder(severity: Severity): number {
  return severity === "error" ? 0 : 1;
}

/** Accumulate independently found diagnostics without stopping the current run. */
export class DiagnosingConcept {
  readonly #diagnosticsByKey = new Map<string, Diagnostic>();
  readonly #diagnosticsByID = new Map<string, Diagnostic>();
  readonly #relations = new Map<string, Relation>();
  #nextDiagnostic = 1;
  #nextRelation = 1;

  report({ severity, code, message, source, line, column }: { severity: string; code: string; message: string; source: string; line: number; column: number }) {
    if (severity !== "error" && severity !== "warning") throw new UnknownSeverity();
    const key = JSON.stringify([severity, code, source, line, column]);
    const existing = this.#diagnosticsByKey.get(key);
    if (existing !== undefined) return { diagnostic: existing.diagnostic };

    const diagnostic = `diagnostic:${this.#nextDiagnostic++}`;
    const record: Diagnostic = { diagnostic, severity: severity === "error" ? "error" : "warning", code, message, source, line, column };
    this.#diagnosticsByKey.set(key, record);
    this.#diagnosticsByID.set(diagnostic, record);
    return { diagnostic };
  }

  relate({ diagnostic, source, line, column, note }: { diagnostic: string; source: string; line: number; column: number; note: string }) {
    if (!this.#diagnosticsByID.has(diagnostic)) throw new DiagnosticNotFound();
    const relation = `relation:${this.#nextRelation++}`;
    this.#relations.set(relation, { relation, diagnostic, source, line, column, note });
    return { relation };
  }

  retract({ source }: { source: string }) {
    let count = 0;
    for (const [key, diagnostic] of this.#diagnosticsByKey) {
      if (diagnostic.source !== source) continue;
      this.#diagnosticsByKey.delete(key);
      this.#diagnosticsByID.delete(diagnostic.diagnostic);
      for (const [relation, record] of this.#relations) if (record.diagnostic === diagnostic.diagnostic) this.#relations.delete(relation);
      count += 1;
    }
    return { source, count };
  }

  clear() {
    const count = this.#diagnosticsByID.size;
    this.#diagnosticsByKey.clear();
    this.#diagnosticsByID.clear();
    this.#relations.clear();
    return { count };
  }

  _all(): { diagnostic: string; severity: Severity; code: string; message: string; source: string; line: number; column: number }[] {
    return this.#orderedDiagnostics().map(({ diagnostic, severity, code, message, source, line, column }) => ({ diagnostic, severity, code, message, source, line, column }));
  }

  _errors(): { diagnostic: string; code: string; message: string; source: string; line: number; column: number }[] {
    return this.#orderedDiagnostics()
      .filter(({ severity }) => severity === "error")
      .map(({ diagnostic, code, message, source, line, column }) => ({ diagnostic, code, message, source, line, column }));
  }

  _for({ source }: { source: string }): { diagnostic: string; severity: Severity; code: string; message: string; line: number; column: number }[] {
    return this.#orderedDiagnostics()
      .filter((diagnostic) => diagnostic.source === source)
      .map(({ diagnostic, severity, code, message, line, column }) => ({ diagnostic, severity, code, message, line, column }));
  }

  _related({ diagnostic }: { diagnostic: string }): { source: string; line: number; column: number; note: string }[] {
    return [...this.#relations.values()]
      .filter((relation) => relation.diagnostic === diagnostic)
      .sort((left, right) => compareText(left.source, right.source) || compareNumber(left.line, right.line) || compareNumber(left.column, right.column) || compareText(left.note, right.note))
      .map(({ source, line, column, note }) => ({ source, line, column, note }));
  }

  _clean() {
    return { clean: ![...this.#diagnosticsByID.values()].some(({ severity }) => severity === "error") };
  }

  #orderedDiagnostics(): Diagnostic[] {
    return [...this.#diagnosticsByID.values()].sort(
      (left, right) =>
        severityOrder(left.severity) - severityOrder(right.severity) ||
        compareText(left.source, right.source) ||
        compareNumber(left.line, right.line) ||
        compareNumber(left.column, right.column) ||
        compareText(left.code, right.code),
    );
  }
}
