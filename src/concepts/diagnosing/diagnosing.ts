const UNKNOWN_SEVERITY_MESSAGE = "A diagnostic is an error or a warning.";
const INVALID_TEXT_MESSAGE = "Codes, messages, sources, diagnostic identities, and notes must be well-formed text.";
const INVALID_LOCATION_MESSAGE = "A location needs a source; line and column must be positive safe integers, and a column needs a line.";
const DIAGNOSTIC_NOT_FOUND_MESSAGE = "There is no such diagnostic.";

export class UnknownSeverity extends Error {
  constructor() {
    super(UNKNOWN_SEVERITY_MESSAGE);
    this.name = "UnknownSeverity";
  }
}

export class InvalidText extends Error {
  constructor() {
    super(INVALID_TEXT_MESSAGE);
    this.name = "InvalidText";
  }
}

export class InvalidLocation extends Error {
  constructor() {
    super(INVALID_LOCATION_MESSAGE);
    this.name = "InvalidLocation";
  }
}

export class DiagnosticNotFound extends Error {
  constructor() {
    super(DIAGNOSTIC_NOT_FOUND_MESSAGE);
    this.name = "DiagnosticNotFound";
  }
}

export type DiagnosticSeverity = "error" | "warning";

type Location = {
  source: string | undefined;
  line: number | undefined;
  column: number | undefined;
};

type DiagnosticRecord = Location & {
  diagnostic: string;
  severity: DiagnosticSeverity;
  code: string;
  message: string;
};

type RelationRecord = {
  relation: string;
  diagnostic: string;
  source: string;
  line: number | undefined;
  column: number | undefined;
  note: string;
};

const encoder = new TextEncoder();

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function text(value: unknown): string {
  if (!isText(value)) throw new InvalidText();
  return value;
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return text(value);
}

function optionalPosition(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new InvalidLocation();
  return value;
}

function location(source: string | undefined, lineValue: unknown, columnValue: unknown): Location {
  const line = optionalPosition(lineValue);
  const column = optionalPosition(columnValue);
  if ((line !== undefined || column !== undefined) && source === undefined) throw new InvalidLocation();
  if (column !== undefined && line === undefined) throw new InvalidLocation();
  return { source, line, column };
}

function compareText(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    const comparison = leftBytes[index]! - rightBytes[index]!;
    if (comparison !== 0) return comparison;
  }
  if (leftBytes.length !== rightBytes.length) return leftBytes.length - rightBytes.length;
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareNumber(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOptional<T>(left: T | undefined, right: T | undefined, compare: (left: T, right: T) => number): number {
  if (left === undefined) return right === undefined ? 0 : -1;
  if (right === undefined) return 1;
  return compare(left, right);
}

function severityOrder(severity: DiagnosticSeverity): number {
  return severity === "error" ? 0 : 1;
}

function diagnosticIdentity(severity: DiagnosticSeverity, code: string, location: Location): string {
  return `diagnostic:${JSON.stringify([severity, code, location.source ?? null, location.line ?? null, location.column ?? null])}`;
}

function relationIdentity(diagnostic: string, source: string, line: number | undefined, column: number | undefined, note: string): string {
  return `relation:${JSON.stringify([diagnostic, source, line ?? null, column ?? null, note])}`;
}

function compareDiagnostic(left: DiagnosticRecord, right: DiagnosticRecord): number {
  return (
    severityOrder(left.severity) - severityOrder(right.severity) ||
    compareOptional(left.source, right.source, compareText) ||
    compareOptional(left.line, right.line, compareNumber) ||
    compareOptional(left.column, right.column, compareNumber) ||
    compareText(left.code, right.code)
  );
}

function compareRelation(left: RelationRecord, right: RelationRecord): number {
  return (
    compareText(left.source, right.source) ||
    compareOptional(left.line, right.line, compareNumber) ||
    compareOptional(left.column, right.column, compareNumber) ||
    compareText(left.note, right.note)
  );
}

/** Accumulate independently found diagnostics without deciding what they prevent. */
export class DiagnosingConcept {
  readonly #diagnostics = new Map<string, DiagnosticRecord>();
  readonly #relations = new Map<string, RelationRecord>();

  report({
    severity,
    code,
    message,
    source,
    line,
    column,
  }: {
    severity: unknown;
    code: unknown;
    message: unknown;
    source?: unknown;
    line?: unknown;
    column?: unknown;
  }) {
    if (severity !== "error" && severity !== "warning") throw new UnknownSeverity();
    const normalizedCode = text(code);
    const normalizedMessage = text(message);
    const normalizedLocation = location(optionalText(source), line, column);
    const diagnostic = diagnosticIdentity(severity, normalizedCode, normalizedLocation);
    if (this.#diagnostics.has(diagnostic)) return { diagnostic };

    this.#diagnostics.set(diagnostic, {
      diagnostic,
      severity,
      code: normalizedCode,
      message: normalizedMessage,
      ...normalizedLocation,
    });
    return { diagnostic };
  }

  relate({
    diagnostic,
    source,
    line,
    column,
    note,
  }: {
    diagnostic: unknown;
    source: unknown;
    line?: unknown;
    column?: unknown;
    note: unknown;
  }) {
    const normalizedDiagnostic = text(diagnostic);
    const normalizedSource = text(source);
    const normalizedNote = text(note);
    if (!this.#diagnostics.has(normalizedDiagnostic)) throw new DiagnosticNotFound();
    const normalizedLocation = location(normalizedSource, line, column);
    const relation = relationIdentity(
      normalizedDiagnostic,
      normalizedSource,
      normalizedLocation.line,
      normalizedLocation.column,
      normalizedNote,
    );
    if (!this.#relations.has(relation)) {
      this.#relations.set(relation, {
        relation,
        diagnostic: normalizedDiagnostic,
        source: normalizedSource,
        line: normalizedLocation.line,
        column: normalizedLocation.column,
        note: normalizedNote,
      });
    }
    return { relation };
  }

  retract({ source }: { source?: unknown }) {
    const normalizedSource = optionalText(source);
    let count = 0;
    for (const record of [...this.#diagnostics.values()]) {
      if (record.source !== normalizedSource) continue;
      this.#remove(record.diagnostic);
      count += 1;
    }
    return { source: normalizedSource, count };
  }

  clear() {
    const count = this.#diagnostics.size;
    this.#diagnostics.clear();
    this.#relations.clear();
    return { count };
  }

  _all(): {
    diagnostic: string;
    severity: DiagnosticSeverity;
    code: string;
    message: string;
    source: string | undefined;
    line: number | undefined;
    column: number | undefined;
  }[] {
    return this.#orderedDiagnostics().map(({ diagnostic, severity, code, message, source, line, column }) => ({
      diagnostic,
      severity,
      code,
      message,
      source,
      line,
      column,
    }));
  }

  _errors(): {
    diagnostic: string;
    code: string;
    message: string;
    source: string | undefined;
    line: number | undefined;
    column: number | undefined;
  }[] {
    return this.#orderedDiagnostics()
      .filter(({ severity }) => severity === "error")
      .map(({ diagnostic, code, message, source, line, column }) => ({ diagnostic, code, message, source, line, column }));
  }

  _for({ source }: { source?: unknown }): {
    diagnostic: string;
    severity: DiagnosticSeverity;
    code: string;
    message: string;
    line: number | undefined;
    column: number | undefined;
  }[] {
    if (source !== undefined && !isText(source)) return [];
    return this.#orderedDiagnostics()
      .filter((diagnostic) => diagnostic.source === source)
      .map(({ diagnostic, severity, code, message, line, column }) => ({ diagnostic, severity, code, message, line, column }));
  }

  _related({ diagnostic }: { diagnostic: unknown }): {
    source: string;
    line: number | undefined;
    column: number | undefined;
    note: string;
  }[] {
    if (!isText(diagnostic)) return [];
    return [...this.#relations.values()]
      .filter((relation) => relation.diagnostic === diagnostic)
      .sort(compareRelation)
      .map(({ source, line, column, note }) => ({ source, line, column, note }));
  }

  _clean(): { clean: boolean } {
    return { clean: ![...this.#diagnostics.values()].some(({ severity }) => severity === "error") };
  }

  #orderedDiagnostics(): DiagnosticRecord[] {
    return [...this.#diagnostics.values()].sort(compareDiagnostic);
  }

  #remove(diagnostic: string): void {
    this.#diagnostics.delete(diagnostic);
    for (const [relation, record] of this.#relations) {
      if (record.diagnostic === diagnostic) this.#relations.delete(relation);
    }
  }
}
