import { isProxy } from "node:util/types";

export class InvalidText extends Error {}
export class InvalidDirection extends Error {}
export class InvalidField extends Error {}
export class InvalidCondition extends Error {}
export class InvalidCard extends Error {}
export class CatalogNotFound extends Error {}
export class NotIncluded extends Error {}

export type Direction = "asc" | "desc";
export type NormalizedValue = null | boolean | number | string | NormalizedValue[] | NormalizedRecord;
export interface NormalizedRecord {
  [key: string]: NormalizedValue;
}

export type CatalogCondition =
  | { test: "equals"; field: string; value: NormalizedValue }
  | { test: "contains"; field: string; value: NormalizedValue }
  | { test: "exists"; field: string };

type CatalogRecord = {
  catalog: string;
  name: string;
  direction: Direction;
  sort: string | null;
  condition: CatalogCondition | null;
};
type EntryRecord = {
  entry: string;
  catalog: string;
  item: string;
  key: NormalizedValue | undefined;
  tiebreak: string;
  card: NormalizedRecord;
};

class UnsupportedValue extends Error {}

const encoder = new TextEncoder();
const fieldPattern = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

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
  if (leftBytes.length !== rightBytes.length) return leftBytes.length - rightBytes.length;
  if (left === right) return 0;

  // Distinct malformed UTF-16 strings can encode to the same replacement bytes.
  return left < right ? -1 : 1;
}

function setOwn(record: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
}

function sortedKeys(record: NormalizedRecord): string[] {
  return Object.keys(record).sort(compareText);
}

function normalizeValue(value: unknown, active = new Set<object>()): NormalizedValue {
  try {
    return normalizeValueUnchecked(value, active);
  } catch {
    throw new UnsupportedValue();
  }
}

function normalizeValueUnchecked(value: unknown, active: Set<object>): NormalizedValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (!isText(value)) throw new UnsupportedValue();
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new UnsupportedValue();
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") throw new UnsupportedValue();
  if (isProxy(value)) throw new UnsupportedValue();
  if (active.has(value)) throw new UnsupportedValue();

  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) throw new UnsupportedValue();
      const ownKeys = Reflect.ownKeys(value);
      if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) throw new UnsupportedValue();
      const normalized: NormalizedValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new UnsupportedValue();
        normalized.push(normalizeValueUnchecked(descriptor.value, active));
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new UnsupportedValue();
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) throw new UnsupportedValue();
    const normalized: NormalizedRecord = {};
    for (const key of (keys as string[]).sort(compareText)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new UnsupportedValue();
      if (!isText(key)) throw new UnsupportedValue();
      setOwn(normalized, key, normalizeValueUnchecked(descriptor.value, active));
    }
    return normalized;
  } finally {
    active.delete(value);
  }
}

function normalizeCard(card: unknown): NormalizedRecord {
  const normalized = normalizeValue(card);
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) throw new UnsupportedValue();
  return normalized;
}

function cloneValue(value: NormalizedValue): NormalizedValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  const clone: NormalizedRecord = {};
  for (const key of sortedKeys(value)) setOwn(clone, key, cloneValue(value[key]!));
  return clone;
}

function cloneRecord(record: NormalizedRecord): NormalizedRecord {
  return cloneValue(record) as NormalizedRecord;
}

function cloneCondition(condition: CatalogCondition | null): CatalogCondition | null {
  if (condition === null) return null;
  if (condition.test === "exists") return { ...condition };
  return { ...condition, value: cloneValue(condition.value) };
}

function equalValue(left: NormalizedValue, right: NormalizedValue): boolean {
  if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equalValue(value, right[index]!));
  }
  const leftKeys = sortedKeys(left);
  const rightKeys = sortedKeys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && equalValue(left[key]!, right[key]!));
}

function equalOptionalValue(left: NormalizedValue | undefined, right: NormalizedValue | undefined): boolean {
  return left === undefined || right === undefined ? left === right : equalValue(left, right);
}

function equalCondition(left: CatalogCondition | null, right: CatalogCondition | null): boolean {
  if (left === null || right === null) return left === right;
  if (left.test !== right.test || left.field !== right.field) return false;
  if (left.test === "exists" || right.test === "exists") return true;
  return equalValue(left.value, right.value);
}

function kind(value: NormalizedValue): number {
  if (value === null) return 0;
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return 2;
  if (typeof value === "string") return 3;
  if (Array.isArray(value)) return 4;
  return 5;
}

function compareSequences(left: readonly NormalizedValue[], right: readonly NormalizedValue[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const comparison = compareValue(left[index]!, right[index]!);
    if (comparison !== 0) return comparison;
  }
  return left.length - right.length;
}

function compareRecords(left: NormalizedRecord, right: NormalizedRecord): number {
  const leftKeys = sortedKeys(left);
  const rightKeys = sortedKeys(right);
  for (let index = 0; index < Math.min(leftKeys.length, rightKeys.length); index += 1) {
    const leftKey = leftKeys[index]!;
    const rightKey = rightKeys[index]!;
    const keyComparison = compareText(leftKey, rightKey);
    if (keyComparison !== 0) return keyComparison;
    const valueComparison = compareValue(left[leftKey]!, right[rightKey]!);
    if (valueComparison !== 0) return valueComparison;
  }
  return leftKeys.length - rightKeys.length;
}

function compareValue(left: NormalizedValue, right: NormalizedValue): number {
  const kindDifference = kind(left) - kind(right);
  if (kindDifference !== 0) return kindDifference;
  if (left === null && right === null) return 0;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  if (typeof left === "number" && typeof right === "number") return left < right ? -1 : left > right ? 1 : 0;
  if (typeof left === "string" && typeof right === "string") return compareText(left, right);
  if (Array.isArray(left) && Array.isArray(right)) return compareSequences(left, right);
  return compareRecords(left as NormalizedRecord, right as NormalizedRecord);
}

function catalogIdentity(name: string): string {
  return `catalog:${JSON.stringify(name)}`;
}

function entryIdentity(catalog: string, item: string): string {
  return `entry:${JSON.stringify([catalog, item])}`;
}

function normalizeField(field: unknown): string {
  if (typeof field !== "string" || !fieldPattern.test(field)) throw new InvalidField();
  return field;
}

function normalizeCondition(condition: unknown): CatalogCondition | null {
  if (condition === null) return null;
  try {
    if (typeof condition !== "object" || Array.isArray(condition) || isProxy(condition)) throw new InvalidCondition();
    const prototype = Object.getPrototypeOf(condition);
    if (prototype !== Object.prototype && prototype !== null) throw new InvalidCondition();
    const keys = Reflect.ownKeys(condition);
    if (keys.some((key) => typeof key !== "string")) throw new InvalidCondition();
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(condition, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) throw new InvalidCondition();
    }
    const record = condition as Record<string, unknown>;
    const field = normalizeField(record.field);
    if (record.test === "exists" && keys.length === 2) return { test: "exists", field };
    if ((record.test === "equals" || record.test === "contains") && keys.length === 3) {
      return { test: record.test, field, value: normalizeValue(record.value) };
    }
  } catch {
    throw new InvalidCondition();
  }
  throw new InvalidCondition();
}

function readField(card: NormalizedRecord, field: string): NormalizedValue | undefined {
  let current: NormalizedValue = card;
  for (const segment of field.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current) || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment]!;
  }
  return current;
}

function containsValue(container: NormalizedValue, value: NormalizedValue): boolean {
  if (Array.isArray(container)) return container.some((member) => equalValue(member, value));
  return typeof container === "string" && typeof value === "string" && container.includes(value);
}

function accepts(card: NormalizedRecord, condition: CatalogCondition | null): boolean {
  if (condition === null) return true;
  const value = readField(card, condition.field);
  if (condition.test === "exists") return value !== undefined;
  if (value === undefined) return false;
  return condition.test === "equals" ? equalValue(value, condition.value) : containsValue(value, condition.value);
}

/** Catalog projected items under declared admission and deterministic ordering policy. */
export class CatalogingConcept {
  readonly #catalogsByName = new Map<string, CatalogRecord>();
  readonly #catalogsByID = new Map<string, CatalogRecord>();
  readonly #entries = new Map<string, EntryRecord>();

  declare({
    name,
    direction,
    sort,
    condition,
  }: {
    name: unknown;
    direction: unknown;
    sort: unknown;
    condition: unknown;
  }) {
    requireText(name);
    if (direction !== "asc" && direction !== "desc") throw new InvalidDirection();
    const normalizedSort = sort === null ? null : normalizeField(sort);
    const normalizedCondition = normalizeCondition(condition);
    const existing = this.#catalogsByName.get(name);
    if (existing === undefined) {
      const catalog = catalogIdentity(name);
      const record: CatalogRecord = { catalog, name, direction, sort: normalizedSort, condition: normalizedCondition };
      this.#catalogsByName.set(name, record);
      this.#catalogsByID.set(catalog, record);
      return { catalog, changed: true };
    }
    const changed =
      existing.direction !== direction ||
      existing.sort !== normalizedSort ||
      !equalCondition(existing.condition, normalizedCondition);
    if (!changed) return { catalog: existing.catalog, changed: false };
    existing.direction = direction;
    existing.sort = normalizedSort;
    existing.condition = normalizedCondition;
    for (const [entry, record] of this.#entries) {
      if (record.catalog !== existing.catalog) continue;
      if (!accepts(record.card, normalizedCondition)) this.#entries.delete(entry);
      else record.key = normalizedSort === null ? undefined : readField(record.card, normalizedSort);
    }
    return { catalog: existing.catalog, changed: true };
  }

  index({ catalog, item, tiebreak, card }: { catalog: unknown; item: unknown; tiebreak: unknown; card: unknown }) {
    requireText(catalog);
    requireText(item);
    requireText(tiebreak);
    const policy = this.#catalogsByID.get(catalog);
    if (policy === undefined) throw new CatalogNotFound();

    let normalizedCard: NormalizedRecord;
    try {
      normalizedCard = normalizeCard(card);
    } catch (error) {
      if (error instanceof UnsupportedValue) throw new InvalidCard();
      throw error;
    }

    const entry = entryIdentity(catalog, item);
    const existing = this.#entries.get(entry);
    if (!accepts(normalizedCard, policy.condition)) {
      return { entry, included: false, changed: existing === undefined ? false : this.#entries.delete(entry) };
    }
    const normalizedKey = policy.sort === null ? undefined : readField(normalizedCard, policy.sort);
    if (
      existing !== undefined &&
      equalOptionalValue(existing.key, normalizedKey) &&
      existing.tiebreak === tiebreak &&
      equalValue(existing.card, normalizedCard)
    ) {
      return { entry, included: true, changed: false };
    }
    this.#entries.set(entry, { entry, catalog, item, key: normalizedKey, tiebreak, card: normalizedCard });
    return { entry, included: true, changed: true };
  }

  unindex({ catalog, item }: { catalog: unknown; item: unknown }) {
    requireText(catalog);
    requireText(item);
    const entry = entryIdentity(catalog, item);
    if (!this.#entries.delete(entry)) throw new NotIncluded();
    return { entry };
  }

  withdraw({ item }: { item: unknown }) {
    requireText(item);
    let count = 0;
    for (const [entry, record] of this.#entries) {
      if (record.item !== item) continue;
      this.#entries.delete(entry);
      count += 1;
    }
    return { item, count };
  }

  reset() {
    const count = this.#catalogsByID.size;
    this.#catalogsByName.clear();
    this.#catalogsByID.clear();
    this.#entries.clear();
    return { count };
  }

  _catalogs(): { catalog: string; name: string; direction: Direction; sort: string | null; condition: CatalogCondition | null }[] {
    return [...this.#catalogsByID.values()]
      .sort((left, right) => compareText(left.name, right.name))
      .map(({ catalog, name, direction, sort, condition }) => ({ catalog, name, direction, sort, condition: cloneCondition(condition) }));
  }

  _named({ name }: { name: unknown }): { catalog: string; direction: Direction; sort: string | null; condition: CatalogCondition | null }[] {
    if (!isText(name)) return [];
    const catalog = this.#catalogsByName.get(name);
    return catalog === undefined
      ? []
      : [{ catalog: catalog.catalog, direction: catalog.direction, sort: catalog.sort, condition: cloneCondition(catalog.condition) }];
  }

  _entries({ catalog }: { catalog: unknown }): { entry: string; item: string; card: NormalizedRecord }[] {
    if (!isText(catalog)) return [];
    const record = this.#catalogsByID.get(catalog);
    if (record === undefined) return [];
    return [...this.#entries.values()]
      .filter((entry) => entry.catalog === catalog)
      .sort((left, right) => this.#compareEntries(left, right, record.direction))
      .map(({ entry, item, card }) => ({ entry, item, card: cloneRecord(card) }));
  }

  _membership({ item }: { item: unknown }): { entry: string; catalog: string; name: string }[] {
    if (!isText(item)) return [];
    return [...this.#entries.values()]
      .filter((entry) => entry.item === item)
      .map((entry) => ({ entry: entry.entry, catalog: this.#catalogsByID.get(entry.catalog)! }))
      .sort((left, right) => compareText(left.catalog.name, right.catalog.name))
      .map(({ entry, catalog }) => ({ entry, catalog: catalog.catalog, name: catalog.name }));
  }

  _position({ catalog, item }: { catalog: unknown; item: unknown }): { index: number }[] {
    if (!isText(catalog) || !isText(item)) return [];
    const index = this._entries({ catalog }).findIndex((entry) => entry.item === item);
    return index === -1 ? [] : [{ index }];
  }

  _record(): { catalogs: NormalizedRecord } {
    const catalogs: NormalizedRecord = {};
    for (const { catalog, name } of this._catalogs()) {
      setOwn(
        catalogs,
        name,
        this._entries({ catalog }).map(({ card }) => card),
      );
    }
    return { catalogs };
  }

  #compareEntries(left: EntryRecord, right: EntryRecord, direction: Direction): number {
    const leftMissing = left.key === undefined;
    const rightMissing = right.key === undefined;
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    if (!leftMissing && !rightMissing) {
      const keyComparison = compareValue(left.key!, right.key!);
      if (keyComparison !== 0) return direction === "asc" ? keyComparison : -keyComparison;
    }
    const tiebreakComparison = compareText(left.tiebreak, right.tiebreak);
    if (tiebreakComparison !== 0) return tiebreakComparison;
    return compareText(left.item, right.item);
  }
}
