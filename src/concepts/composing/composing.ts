export class KeyConflicts extends Error {}

type Entry = { entry: string; key: string; value: unknown; raw: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function partKey(subject: string, part: string): string {
  return `${subject}\u0000${part}`;
}

function setAt(record: Record<string, unknown>, key: string, value: unknown): void {
  const segments = key.split(".");
  let current = record;
  for (const segment of segments.slice(0, -1)) {
    const existing = current[segment];
    if (existing === undefined) current[segment] = {};
    else if (!isRecord(existing)) throw new KeyConflicts();
    current = current[segment] as Record<string, unknown>;
  }
  current[segments.at(-1)!] = structuredClone(value);
}

/** Build nested records from independently owned dotted entries. */
export class ComposingConcept {
  readonly #parts = new Map<string, Map<string, Entry>>();

  set({ subject, part, key, value, raw }: { subject: string; part: string; key: string; value: unknown; raw: boolean }) {
    const entries = this.#parts.get(partKey(subject, part)) ?? new Map<string, Entry>();
    for (const entry of entries.values()) {
      const entryContainsKey = key.startsWith(`${entry.key}.`);
      const keyContainsEntry = entry.key.startsWith(`${key}.`);
      if ((entryContainsKey && !isRecord(entry.value)) || (keyContainsEntry && !isRecord(value))) throw new KeyConflicts();
    }
    const entry = `entry:${subject}:${part}:${key}`;
    entries.set(key, { entry, key, value: structuredClone(value), raw });
    this.#parts.set(partKey(subject, part), entries);
    return { entry };
  }

  clear({ subject, part }: { subject: string; part: string }) {
    const key = partKey(subject, part);
    const count = this.#parts.get(key)?.size ?? 0;
    this.#parts.delete(key);
    return { subject, part, count };
  }

  _record({ subject, part }: { subject: string; part: string }) {
    const entries = this.#parts.get(partKey(subject, part));
    const values: Record<string, unknown> = {};
    for (const entry of entries?.values() ?? []) setAt(values, entry.key, entry.value);
    return { values, raw: [...(entries?.values() ?? [])].filter((entry) => entry.raw).map((entry) => entry.key) };
  }

  _value({ subject, part, key }: { subject: string; part: string; key: string }): { value: unknown }[] {
    const entry = this.#parts.get(partKey(subject, part))?.get(key);
    return entry === undefined ? [] : [{ value: structuredClone(entry.value) }];
  }

  _keys({ subject, part }: { subject: string; part: string }): { key: string; raw: boolean }[] {
    return [...(this.#parts.get(partKey(subject, part))?.values() ?? [])].map(({ key, raw }) => ({ key, raw }));
  }
}
