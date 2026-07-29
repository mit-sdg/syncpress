import { isProxy } from "node:util/types";

export class InvalidText extends Error {}
export class InvalidDirection extends Error {}
export class InvalidSortKey extends Error {}
export class InvalidCard extends Error {}
export class CollectionNotFound extends Error {}
export class NotIncluded extends Error {}

export type Direction = "asc" | "desc";
export type NormalizedValue = null | boolean | number | string | NormalizedValue[] | NormalizedRecord;
export interface NormalizedRecord {
  [key: string]: NormalizedValue;
}

type CollectionRecord = { collection: string; name: string; direction: Direction };
type EntryRecord = {
  entry: string;
  collection: string;
  item: string;
  key: NormalizedValue | undefined;
  tiebreak: string;
  card: NormalizedRecord;
};

class UnsupportedValue extends Error {}

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

function collectionIdentity(name: string): string {
  return `collection:${JSON.stringify(name)}`;
}

function entryIdentity(collection: string, item: string): string {
  return `entry:${JSON.stringify([collection, item])}`;
}

/** Maintain generic named, totally ordered collections of lightweight values. */
export class CollectingConcept {
  readonly #collectionsByName = new Map<string, CollectionRecord>();
  readonly #collectionsByID = new Map<string, CollectionRecord>();
  readonly #entries = new Map<string, EntryRecord>();

  declare({ name, direction }: { name: unknown; direction: unknown }) {
    requireText(name);
    if (direction !== "asc" && direction !== "desc") throw new InvalidDirection();
    const existing = this.#collectionsByName.get(name);
    if (existing === undefined) {
      const collection = collectionIdentity(name);
      const record: CollectionRecord = { collection, name, direction };
      this.#collectionsByName.set(name, record);
      this.#collectionsByID.set(collection, record);
      return { collection, changed: true };
    }
    const changed = existing.direction !== direction;
    existing.direction = direction;
    return { collection: existing.collection, changed };
  }

  include({ collection, item, key, tiebreak, card }: { collection: unknown; item: unknown; key?: unknown; tiebreak: unknown; card: unknown }) {
    requireText(collection);
    requireText(item);
    requireText(tiebreak);
    if (!this.#collectionsByID.has(collection)) throw new CollectionNotFound();

    let normalizedKey: NormalizedValue | undefined;
    try {
      normalizedKey = key === undefined ? undefined : normalizeValue(key);
    } catch (error) {
      if (error instanceof UnsupportedValue) throw new InvalidSortKey();
      throw error;
    }

    let normalizedCard: NormalizedRecord;
    try {
      normalizedCard = normalizeCard(card);
    } catch (error) {
      if (error instanceof UnsupportedValue) throw new InvalidCard();
      throw error;
    }

    const entry = entryIdentity(collection, item);
    const existing = this.#entries.get(entry);
    if (
      existing !== undefined &&
      equalOptionalValue(existing.key, normalizedKey) &&
      existing.tiebreak === tiebreak &&
      equalValue(existing.card, normalizedCard)
    ) {
      return { entry, changed: false };
    }
    this.#entries.set(entry, { entry, collection, item, key: normalizedKey, tiebreak, card: normalizedCard });
    return { entry, changed: true };
  }

  exclude({ collection, item }: { collection: unknown; item: unknown }) {
    requireText(collection);
    requireText(item);
    const entry = entryIdentity(collection, item);
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
    const count = this.#collectionsByID.size;
    this.#collectionsByName.clear();
    this.#collectionsByID.clear();
    this.#entries.clear();
    return { count };
  }

  _collections(): { collection: string; name: string; direction: Direction }[] {
    return [...this.#collectionsByID.values()]
      .sort((left, right) => compareText(left.name, right.name))
      .map(({ collection, name, direction }) => ({ collection, name, direction }));
  }

  _named({ name }: { name: unknown }): { collection: string; direction: Direction }[] {
    if (!isText(name)) return [];
    const collection = this.#collectionsByName.get(name);
    return collection === undefined ? [] : [{ collection: collection.collection, direction: collection.direction }];
  }

  _items({ collection }: { collection: unknown }): { item: string; key: NormalizedValue | undefined; card: NormalizedRecord }[] {
    if (!isText(collection)) return [];
    const record = this.#collectionsByID.get(collection);
    if (record === undefined) return [];
    return [...this.#entries.values()]
      .filter((entry) => entry.collection === collection)
      .sort((left, right) => this.#compareEntries(left, right, record.direction))
      .map(({ item, key, card }) => ({ item, key: key === undefined ? undefined : cloneValue(key), card: cloneRecord(card) }));
  }

  _membership({ item }: { item: unknown }): { collection: string; name: string }[] {
    if (!isText(item)) return [];
    return [...this.#entries.values()]
      .filter((entry) => entry.item === item)
      .map((entry) => this.#collectionsByID.get(entry.collection)!)
      .sort((left, right) => compareText(left.name, right.name))
      .map(({ collection, name }) => ({ collection, name }));
  }

  _position({ collection, item }: { collection: unknown; item: unknown }): { index: number }[] {
    if (!isText(collection) || !isText(item)) return [];
    const index = this._items({ collection }).findIndex((entry) => entry.item === item);
    return index === -1 ? [] : [{ index }];
  }

  _catalog(): { collections: NormalizedRecord } {
    const collections: NormalizedRecord = {};
    for (const { collection, name } of this._collections()) {
      setOwn(
        collections,
        name,
        this._items({ collection }).map(({ card }) => card),
      );
    }
    return { collections };
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
