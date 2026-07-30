const RANK_TAKEN = "This record already has a contribution at this rank.";
const NO_SUCH_LAYER = "This record has no contribution at this rank.";
const INVALID_RANK = "A layer rank must be a finite number.";
const INVALID_VALUES = "A layer contribution must be a finite JSON-like record.";

export class RankTaken extends Error {
  constructor() {
    super(RANK_TAKEN);
    this.name = "RankTaken";
  }
}

export class NoSuchLayer extends Error {
  constructor() {
    super(NO_SUCH_LAYER);
    this.name = "NoSuchLayer";
  }
}

export class InvalidRank extends Error {
  constructor() {
    super(INVALID_RANK);
    this.name = "InvalidRank";
  }
}

export class InvalidValues extends Error {
  constructor() {
    super(INVALID_VALUES);
    this.name = "InvalidValues";
  }
}

export type LayerValue = null | boolean | number | string | LayerValue[] | LayerValues;
export type LayerValues = { [key: string]: LayerValue };

type LayerRecord = { layer: string; rank: number; values: LayerValues };
type Origin = { path: string[]; layer: LayerRecord };
type Resolution = { values: LayerValues; origins: Map<string, Origin> };
type ReadResult = { present: true; value: LayerValue } | { present: false };

function invalidValues(): never {
  throw new InvalidValues();
}

function normalizeRank(rank: unknown): number {
  if (typeof rank !== "number" || !Number.isFinite(rank)) throw new InvalidRank();
  return Object.is(rank, -0) ? 0 : rank;
}

function defineValue(record: LayerValues, key: string, value: LayerValue): void {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function normalizeValue(value: unknown, active = new Set<object>()): LayerValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalidValues();
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object" || active.has(value)) invalidValues();

  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) invalidValues();
      const ownKeys = Reflect.ownKeys(value);
      if (ownKeys.length !== value.length + 1 || ownKeys.some((key) => typeof key !== "string")) invalidValues();
      const normalized: LayerValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) invalidValues();
        normalized.push(normalizeValue(descriptor.value, active));
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) invalidValues();
    const normalized = Object.create(prototype) as LayerValues;
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key !== "string")) invalidValues();
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) invalidValues();
      defineValue(normalized, key, normalizeValue(descriptor.value, active));
    }
    return normalized;
  } finally {
    active.delete(value);
  }
}

function normalizeValues(values: unknown): LayerValues {
  try {
    const normalized = normalizeValue(values);
    if (!isMapping(normalized)) invalidValues();
    return normalized;
  } catch (error) {
    if (error instanceof InvalidValues) throw error;
    throw new InvalidValues();
  }
}

function cloneValue(value: LayerValue): LayerValue {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  const clone = Object.create(Object.getPrototypeOf(value)) as LayerValues;
  for (const key of Object.keys(value)) defineValue(clone, key, cloneValue(value[key]!));
  return clone;
}

function cloneValues(values: LayerValues): LayerValues {
  return cloneValue(values) as LayerValues;
}

function isMapping(value: unknown): value is LayerValues {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copyPath(path: readonly string[]): string[] | undefined {
  try {
    if (!Array.isArray(path) || Object.getPrototypeOf(path) !== Array.prototype) return undefined;
    const ownKeys = Reflect.ownKeys(path);
    if (ownKeys.length !== path.length + 1 || ownKeys.some((key) => typeof key !== "string")) return undefined;
    const copy: string[] = [];
    for (let index = 0; index < path.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(path, String(index));
      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "string") {
        return undefined;
      }
      copy.push(descriptor.value);
    }
    return copy;
  } catch {
    return undefined;
  }
}

function pathKey(path: readonly string[]): string {
  return JSON.stringify(path);
}

function readAt(values: LayerValues, path: readonly string[]): ReadResult {
  let current: LayerValue = values;
  for (const segment of path) {
    if (!isMapping(current) || !Object.hasOwn(current, segment)) return { present: false };
    current = current[segment]!;
  }
  return { present: true, value: current };
}

function isAtOrBelow(prefix: readonly string[], path: readonly string[]): boolean {
  return prefix.length <= path.length && prefix.every((segment, index) => segment === path[index]);
}

function removeOriginsAt(origins: Map<string, Origin>, path: readonly string[]): void {
  for (const [key, origin] of origins) if (isAtOrBelow(path, origin.path)) origins.delete(key);
}

function setOriginsFor(value: LayerValue, path: readonly string[], layer: LayerRecord, origins: Map<string, Origin>): void {
  origins.set(pathKey(path), { path: [...path], layer });
  if (!isMapping(value)) return;
  for (const key of Object.keys(value)) setOriginsFor(value[key]!, [...path, key], layer, origins);
}

function mergeMappings(
  base: LayerValues,
  incoming: LayerValues,
  layer: LayerRecord,
  origins: Map<string, Origin>,
  prefix: readonly string[],
): LayerValues {
  const result = cloneValues(base);
  for (const key of Object.keys(incoming)) {
    const path = [...prefix, key];
    const next = incoming[key]!;
    const previous = Object.hasOwn(base, key) ? base[key] : undefined;
    if (previous !== undefined && isMapping(previous) && isMapping(next)) {
      defineValue(result, key, mergeMappings(previous, next, layer, origins, path));
    } else {
      removeOriginsAt(origins, path);
      defineValue(result, key, cloneValue(next));
      setOriginsFor(next, path, layer, origins);
    }
  }
  return result;
}

function equalValue(left: LayerValue, right: LayerValue): boolean {
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return left === right;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equalValue(value, right[index]!));
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => Object.hasOwn(right, key) && equalValue(left[key]!, right[key]!));
}

function layerIdentity(subject: string, rank: number): string {
  return `layer:${JSON.stringify([subject, rank])}`;
}

/** Resolve ranked configuration layers and retain provenance for every effective path. */
export class LayeringConcept {
  readonly #layers = new Map<string, Map<number, LayerRecord>>();

  contribute({ subject, rank, values }: { subject: string; rank: number; values: unknown }) {
    const normalizedRank = normalizeRank(rank);
    const normalizedValues = normalizeValues(values);
    const layers = this.#layers.get(subject) ?? new Map<number, LayerRecord>();
    if (layers.has(normalizedRank)) throw new RankTaken();

    const layer = layerIdentity(subject, normalizedRank);
    layers.set(normalizedRank, { layer, rank: normalizedRank, values: normalizedValues });
    this.#layers.set(subject, layers);
    return { layer };
  }

  withdraw({ subject, rank }: { subject: string; rank: number }) {
    const normalizedRank = normalizeRank(rank);
    const layers = this.#layers.get(subject);
    const record = layers?.get(normalizedRank);
    if (record === undefined) throw new NoSuchLayer();
    layers!.delete(normalizedRank);
    if (layers!.size === 0) this.#layers.delete(subject);
    return { layer: record.layer };
  }

  clear({ subject }: { subject: string }) {
    const count = this.#layers.get(subject)?.size ?? 0;
    this.#layers.delete(subject);
    return { subject, count };
  }

  _resolved({ subject }: { subject: string }): { values: LayerValues } {
    return { values: cloneValues(this.#resolve(subject).values) };
  }

  _value({ subject, path }: { subject: string; path: readonly string[] }): { value: LayerValue }[] {
    const normalizedPath = copyPath(path);
    if (normalizedPath === undefined) return [];
    const read = readAt(this.#resolve(subject).values, normalizedPath);
    return read.present ? [{ value: cloneValue(read.value) }] : [];
  }

  _flag({ subject, path, otherwise }: { subject: string; path: readonly string[]; otherwise: boolean }): { value: boolean } {
    const normalizedPath = copyPath(path);
    if (normalizedPath === undefined) return { value: otherwise };
    const read = readAt(this.#resolve(subject).values, normalizedPath);
    return { value: read.present && typeof read.value === "boolean" ? read.value : otherwise };
  }

  _equal({ subject, path, value }: { subject: string; path: readonly string[]; value: unknown }): { present: boolean; equal: boolean } {
    const normalizedPath = copyPath(path);
    if (normalizedPath === undefined) return { present: false, equal: false };
    const read = readAt(this.#resolve(subject).values, normalizedPath);
    if (!read.present) return { present: false, equal: false };
    try {
      return { present: true, equal: equalValue(read.value, normalizeValue(value)) };
    } catch {
      return { present: true, equal: false };
    }
  }

  _origin({ subject, path }: { subject: string; path: readonly string[] }): { rank: number; layer: string }[] {
    const normalizedPath = copyPath(path);
    if (normalizedPath === undefined || normalizedPath.length === 0) return [];
    const origin = this.#resolve(subject).origins.get(pathKey(normalizedPath));
    return origin === undefined ? [] : [{ rank: origin.layer.rank, layer: origin.layer.layer }];
  }

  _layers({ subject }: { subject: string }): { layer: string; rank: number; values: LayerValues }[] {
    return this.#ordered(subject).map(({ layer, rank, values }) => ({ layer, rank, values: cloneValues(values) }));
  }

  #ordered(subject: string): LayerRecord[] {
    return [...(this.#layers.get(subject)?.values() ?? [])].sort((left, right) => left.rank - right.rank);
  }

  #resolve(subject: string): Resolution {
    let values: LayerValues = {};
    const origins = new Map<string, Origin>();
    for (const layer of this.#ordered(subject)) values = mergeMappings(values, layer.values, layer, origins, []);
    return { values, origins };
  }
}
