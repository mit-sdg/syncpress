export class CollectionNotFound extends Error {}
export class NotIncluded extends Error {}

type CollectionRecord = { collection: string; name: string; direction: "asc" | "desc" };
type EntryRecord = { entry: string; collection: string; item: string; key: unknown; tiebreak: string; card: Record<string, unknown> };

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length && leftKeys.every((key) => key in right && equal(left[key], right[key]));
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function kind(value: unknown): number {
  if (value === null) return 0;
  if (typeof value === "boolean") return 1;
  if (typeof value === "number") return 2;
  if (typeof value === "string") return 3;
  if (Array.isArray(value)) return 4;
  return 5;
}

function compareText(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  for (let index = 0; index < Math.min(leftBytes.length, rightBytes.length); index += 1) {
    const comparison = leftBytes[index]! - rightBytes[index]!;
    if (comparison !== 0) return comparison;
  }
  return leftBytes.length - rightBytes.length;
}

function compareValue(left: unknown, right: unknown): number {
  const kindDifference = kind(left) - kind(right);
  if (kindDifference !== 0) return kindDifference;
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  if (typeof left === "string" && typeof right === "string") return compareText(left, right);
  return compareText(JSON.stringify(left), JSON.stringify(right));
}

/** Maintain named, total-order listings without retaining full rendered pages. */
export class CollectingConcept {
  readonly #collectionsByName = new Map<string, CollectionRecord>();
  readonly #collectionsByID = new Map<string, CollectionRecord>();
  readonly #entries = new Map<string, EntryRecord>();

  declare({ name, direction }: { name: string; direction: "asc" | "desc" }) {
    const existing = this.#collectionsByName.get(name);
    if (existing === undefined) {
      const collection = `collection:${name}`;
      const record = { collection, name, direction };
      this.#collectionsByName.set(name, record);
      this.#collectionsByID.set(collection, record);
      return { collection, changed: true };
    }
    const changed = existing.direction !== direction;
    existing.direction = direction;
    return { collection: existing.collection, changed };
  }

  include({ collection, item, key, tiebreak, card }: { collection: string; item: string; key: unknown; tiebreak: string; card: Record<string, unknown> }) {
    if (!this.#collectionsByID.has(collection)) throw new CollectionNotFound();
    const entryKey = `${collection}\u0000${item}`;
    const existing = this.#entries.get(entryKey);
    if (existing !== undefined && equal(existing.key, key) && existing.tiebreak === tiebreak && equal(existing.card, card)) {
      return { entry: existing.entry, changed: false };
    }
    const entry = existing?.entry ?? `entry:${collection}:${item}`;
    this.#entries.set(entryKey, { entry, collection, item, key: structuredClone(key), tiebreak, card: structuredClone(card) });
    return { entry, changed: true };
  }

  exclude({ collection, item }: { collection: string; item: string }) {
    const entryKey = `${collection}\u0000${item}`;
    const record = this.#entries.get(entryKey);
    if (record === undefined) throw new NotIncluded();
    this.#entries.delete(entryKey);
    return { entry: record.entry };
  }

  withdraw({ item }: { item: string }) {
    let count = 0;
    for (const [entryKey, entry] of this.#entries) {
      if (entry.item !== item) continue;
      this.#entries.delete(entryKey);
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

  _collections(): { collection: string; name: string; direction: "asc" | "desc" }[] {
    return [...this.#collectionsByID.values()]
      .sort((left, right) => compareText(left.name, right.name))
      .map(({ collection, name, direction }) => ({ collection, name, direction }));
  }

  _named({ name }: { name: string }): { collection: string; direction: "asc" | "desc" }[] {
    const collection = this.#collectionsByName.get(name);
    return collection === undefined ? [] : [{ collection: collection.collection, direction: collection.direction }];
  }

  _items({ collection }: { collection: string }): { item: string; key: unknown; card: Record<string, unknown> }[] {
    const direction = this.#collectionsByID.get(collection)?.direction ?? "asc";
    return [...this.#entries.values()]
      .filter((entry) => entry.collection === collection)
      .sort((left, right) => this.#compareEntries(left, right, direction))
      .map(({ item, key, card }) => ({ item, key: structuredClone(key), card: structuredClone(card) }));
  }

  _membership({ item }: { item: string }): { collection: string; name: string }[] {
    return [...this.#entries.values()]
      .filter((entry) => entry.item === item)
      .map((entry) => this.#collectionsByID.get(entry.collection)!)
      .sort((left, right) => compareText(left.name, right.name))
      .map(({ collection, name }) => ({ collection, name }));
  }

  _position({ collection, item }: { collection: string; item: string }): { index: number }[] {
    const index = this._items({ collection }).findIndex((entry) => entry.item === item);
    return index === -1 ? [] : [{ index }];
  }

  _catalog() {
    const collections: Record<string, unknown[]> = {};
    for (const { collection, name } of this._collections()) collections[name] = this._items({ collection }).map(({ card }) => card);
    return { collections };
  }

  #compareEntries(left: EntryRecord, right: EntryRecord, direction: "asc" | "desc"): number {
    const leftMissing = left.key === undefined;
    const rightMissing = right.key === undefined;
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    const comparison = compareValue(left.key, right.key);
    if (comparison !== 0) return direction === "asc" ? comparison : -comparison;
    return compareText(left.tiebreak, right.tiebreak);
  }
}
