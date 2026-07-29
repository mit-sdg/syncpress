export class RankTaken extends Error {}
export class NoSuchLayer extends Error {}

type LayerRecord = { layer: string; rank: number; values: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function merge(base: unknown, incoming: unknown): unknown {
  if (!isRecord(base) || !isRecord(incoming)) return structuredClone(incoming);
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(incoming)) result[key] = key in result ? merge(result[key], value) : structuredClone(value);
  return result;
}

function atKey(value: unknown, key: string): unknown {
  let current = value;
  for (const segment of key.split(".")) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

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

/** Resolve independently supplied records by rank rather than arrival order. */
export class LayeringConcept {
  readonly #layers = new Map<string, Map<number, LayerRecord>>();

  contribute({ subject, rank, values }: { subject: string; rank: number; values: Record<string, unknown> }) {
    const layers = this.#layers.get(subject) ?? new Map<number, LayerRecord>();
    if (layers.has(rank)) throw new RankTaken();
    const layer = `layer:${subject}:${rank}`;
    layers.set(rank, { layer, rank, values: structuredClone(values) });
    this.#layers.set(subject, layers);
    return { layer };
  }

  withdraw({ subject, rank }: { subject: string; rank: number }) {
    const layers = this.#layers.get(subject);
    const record = layers?.get(rank);
    if (record === undefined) throw new NoSuchLayer();
    layers!.delete(rank);
    if (layers!.size === 0) this.#layers.delete(subject);
    return { layer: record.layer };
  }

  clear({ subject }: { subject: string }) {
    const count = this.#layers.get(subject)?.size ?? 0;
    this.#layers.delete(subject);
    return { subject, count };
  }

  _resolved({ subject }: { subject: string }) {
    const values = this.#ordered(subject).reduce<unknown>((resolved, layer) => merge(resolved, layer.values), {});
    return { values: values as Record<string, unknown> };
  }

  _value({ subject, key }: { subject: string; key: string }): { value: unknown }[] {
    const value = atKey(this._resolved({ subject }).values, key);
    return value === undefined ? [] : [{ value: structuredClone(value) }];
  }

  _flag({ subject, key, otherwise }: { subject: string; key: string; otherwise: boolean }) {
    const value = atKey(this._resolved({ subject }).values, key);
    return { value: typeof value === "boolean" ? value : otherwise };
  }

  _holds({ subject, key, value }: { subject: string; key: string; value: unknown }) {
    const held = atKey(this._resolved({ subject }).values, key);
    return {
      present: held !== undefined,
      equal: equal(held, value),
      contains: Array.isArray(held) ? held.some((entry) => equal(entry, value)) : typeof held === "string" && typeof value === "string" ? held.includes(value) : false,
    };
  }

  _origin({ subject, key }: { subject: string; key: string }): { rank: number; layer: string }[] {
    let origin: LayerRecord | undefined;
    for (const layer of this.#ordered(subject)) if (atKey(layer.values, key) !== undefined) origin = layer;
    return origin === undefined ? [] : [{ rank: origin.rank, layer: origin.layer }];
  }

  _layers({ subject }: { subject: string }): { rank: number; values: Record<string, unknown> }[] {
    return this.#ordered(subject).map(({ rank, values }) => ({ rank, values: structuredClone(values) }));
  }

  #ordered(subject: string): LayerRecord[] {
    return [...(this.#layers.get(subject)?.values() ?? [])].sort((left, right) => left.rank - right.rank);
  }
}
