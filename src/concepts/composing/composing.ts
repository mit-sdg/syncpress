const KEY_CONFLICTS = "This path overlaps another entry.";
const INVALID_PATH = "A path must contain one or more string segments.";
const INVALID_VALUE = "A value must be a finite JSON-like value.";

export class KeyConflicts extends Error {
  constructor() {
    super(KEY_CONFLICTS);
    this.name = "KeyConflicts";
  }
}

export class InvalidPath extends Error {
  constructor() {
    super(INVALID_PATH);
    this.name = "InvalidPath";
  }
}

export class InvalidValue extends Error {
  constructor() {
    super(INVALID_VALUE);
    this.name = "InvalidValue";
  }
}

export type ComposedValue = null | boolean | number | string | ComposedValue[] | ComposedRecord;
export type ComposedRecord = { [key: string]: ComposedValue };

type Entry = { path: string[]; value: ComposedValue };

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePaths(left: readonly string[], right: readonly string[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = compareText(left[index]!, right[index]!);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function copyPath(path: readonly string[]): string[] | undefined {
  try {
    if (!Array.isArray(path) || Object.getPrototypeOf(path) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(path, "length");
    if (lengthDescriptor === undefined || !("value" in lengthDescriptor) || lengthDescriptor.value === 0) return undefined;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(path);
    if (keys.length !== length + 1) return undefined;

    const copy = new Array<string>(length);
    for (const key of keys) {
      if (key === "length") continue;
      if (typeof key !== "string") return undefined;
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= length || String(index) !== key) return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(path, key);
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !("value" in descriptor) ||
        typeof descriptor.value !== "string"
      ) {
        return undefined;
      }
      copy[index] = descriptor.value;
    }
    return copy;
  } catch {
    return undefined;
  }
}

function isStrictPrefix(prefix: readonly string[], path: readonly string[]): boolean {
  return prefix.length < path.length && prefix.every((segment, index) => segment === path[index]);
}

function defineValue(record: ComposedRecord, key: string, value: ComposedValue): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function cloneValue(value: unknown, ancestors = new Set<object>()): ComposedValue {
  try {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (Number.isFinite(value)) return value;
      throw new InvalidValue();
    }
    if (typeof value !== "object" || ancestors.has(value)) throw new InvalidValue();

    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        if (Object.getPrototypeOf(value) !== Array.prototype) throw new InvalidValue();
        const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
        if (lengthDescriptor === undefined || !("value" in lengthDescriptor)) throw new InvalidValue();
        const length = lengthDescriptor.value as number;
        const ownKeys = Reflect.ownKeys(value);
        if (ownKeys.length !== length + 1 || ownKeys.some((key) => typeof key !== "string")) {
          throw new InvalidValue();
        }
        const copy = new Array<ComposedValue>(length);
        for (let index = 0; index < length; index += 1) {
          const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
          if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
            throw new InvalidValue();
          }
          copy[index] = cloneValue(descriptor.value, ancestors);
        }
        return copy;
      }

      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new InvalidValue();
      const copy = Object.create(prototype) as ComposedRecord;
      const keys = Reflect.ownKeys(value);
      if (keys.some((key) => typeof key !== "string")) throw new InvalidValue();
      for (const key of (keys as string[]).sort(compareText)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new InvalidValue();
        defineValue(copy, key, cloneValue(descriptor.value, ancestors));
      }
      return copy;
    } finally {
      ancestors.delete(value);
    }
  } catch (error) {
    if (error instanceof InvalidValue) throw error;
    throw new InvalidValue();
  }
}

function ordered(entries: Map<string, Entry> | undefined): Entry[] {
  return [...(entries?.values() ?? [])].sort((left, right) => comparePaths(left.path, right.path));
}

function setAt(record: ComposedRecord, path: readonly string[], value: ComposedValue): void {
  let current = record;
  for (const segment of path.slice(0, -1)) {
    if (!Object.hasOwn(current, segment)) defineValue(current, segment, {});
    current = current[segment] as ComposedRecord;
  }
  defineValue(current, path.at(-1)!, cloneValue(value));
}

/** Assemble independently supplied JSON-like values into deterministic records. */
export class ComposingConcept {
  readonly #subjects = new Map<string, Map<string, Map<string, Entry>>>();

  set({ subject, part, path, value }: { subject: string; part: string; path: readonly string[]; value: ComposedValue }) {
    const nextPath = copyPath(path);
    if (nextPath === undefined) throw new InvalidPath();
    const nextValue = cloneValue(value);
    const entries = this.#subjects.get(subject)?.get(part);
    for (const entry of entries?.values() ?? []) {
      if (isStrictPrefix(entry.path, nextPath) || isStrictPrefix(nextPath, entry.path)) throw new KeyConflicts();
    }

    const parts = this.#subjects.get(subject) ?? new Map<string, Map<string, Entry>>();
    const nextEntries = entries ?? new Map<string, Entry>();
    nextEntries.set(JSON.stringify(nextPath), { path: nextPath, value: nextValue });
    parts.set(part, nextEntries);
    this.#subjects.set(subject, parts);
    return { subject, part, path: [...nextPath] };
  }

  clear({ subject, part }: { subject: string; part: string }) {
    const parts = this.#subjects.get(subject);
    const count = parts?.get(part)?.size ?? 0;
    parts?.delete(part);
    if (parts?.size === 0) this.#subjects.delete(subject);
    return { subject, part, count };
  }

  _record({ subject, part }: { subject: string; part: string }) {
    const values: ComposedRecord = {};
    for (const entry of ordered(this.#subjects.get(subject)?.get(part))) setAt(values, entry.path, entry.value);
    return { values };
  }

  _value({ subject, part, path }: { subject: string; part: string; path: readonly string[] }): { value: ComposedValue }[] {
    const validPath = copyPath(path);
    if (validPath === undefined) return [];
    const entry = this.#subjects.get(subject)?.get(part)?.get(JSON.stringify(validPath));
    return entry === undefined ? [] : [{ value: cloneValue(entry.value) }];
  }

  _keys({ subject, part }: { subject: string; part: string }): { path: string[] }[] {
    return ordered(this.#subjects.get(subject)?.get(part)).map(({ path }) => ({ path: [...path] }));
  }
}
