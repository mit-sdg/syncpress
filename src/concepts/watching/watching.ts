import { lstat, watch } from "node:fs/promises";
import { resolve } from "node:path";

const INVALID_WATCH = "A watch needs a directory and a positive settling duration.";
const DIRECTORY_MISSING = "This required directory is missing.";
const DIRECTORY_UNSUPPORTED = "This required location must be a directory that is not a symbolic link.";
const DIRECTORY_UNOBSERVABLE = "This directory could not be observed.";
const WATCH_NOT_FOUND = "There is no such watch.";
const WATCH_NOT_OPEN = "There is no such open watch.";

export class InvalidWatch extends Error {
  constructor() {
    super(INVALID_WATCH);
    this.name = "InvalidWatch";
  }
}

export class DirectoryMissing extends Error {
  constructor() {
    super(DIRECTORY_MISSING);
    this.name = "DirectoryMissing";
  }
}

export class DirectoryUnsupported extends Error {
  constructor() {
    super(DIRECTORY_UNSUPPORTED);
    this.name = "DirectoryUnsupported";
  }
}

export class DirectoryUnobservable extends Error {
  constructor() {
    super(DIRECTORY_UNOBSERVABLE);
    this.name = "DirectoryUnobservable";
  }
}

export class WatchNotFound extends Error {
  constructor() {
    super(WATCH_NOT_FOUND);
    this.name = "WatchNotFound";
  }
}

export class WatchNotOpen extends Error {
  constructor() {
    super(WATCH_NOT_OPEN);
    this.name = "WatchNotOpen";
  }
}

type WatchRecord = {
  watch: string;
  directory: string;
  settling: number;
  open: boolean;
  prefixes: string[];
  settled: boolean;
  observation: AbortController;
  timer: ReturnType<typeof setTimeout> | undefined;
  waiting: (() => void) | undefined;
};

function isWatchText(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value.isWellFormed();
}

function isDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

/** Report settled bursts of host change, and never report what the caller disregards. */
export class WatchingConcept {
  readonly #watches = new Map<string, WatchRecord>();
  #next = 0;

  async observe({ directory, settling }: { directory: string; settling: number }) {
    if (!isWatchText(directory) || !isDuration(settling)) throw new InvalidWatch();
    const absolute = resolve(directory);

    let status: Awaited<ReturnType<typeof lstat>>;
    try {
      status = await lstat(absolute);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ENOTDIR") throw new DirectoryMissing();
      throw new DirectoryUnobservable();
    }
    if (status.isSymbolicLink() || !status.isDirectory()) throw new DirectoryUnsupported();

    this.#next += 1;
    const record: WatchRecord = {
      watch: `watch:${this.#next}`,
      directory: absolute,
      settling,
      open: true,
      prefixes: [],
      settled: false,
      observation: new AbortController(),
      timer: undefined,
      waiting: undefined,
    };

    let events: AsyncIterable<{ filename: string | Buffer | null }>;
    try {
      events = watch(absolute, { recursive: true, signal: record.observation.signal });
    } catch {
      throw new DirectoryUnobservable();
    }

    this.#watches.set(record.watch, record);
    void this.#consume(record, events);
    return { watch: record.watch };
  }

  /** Restart the settling span for every change the watch still counts. */
  async #consume(record: WatchRecord, events: AsyncIterable<{ filename: string | Buffer | null }>): Promise<void> {
    try {
      for await (const event of events) {
        if (!record.open) break;
        if (event.filename === null) continue;
        const changed = resolve(record.directory, event.filename.toString());
        if (record.prefixes.some((prefix) => changed.startsWith(prefix))) continue;
        if (record.timer !== undefined) clearTimeout(record.timer);
        record.timer = setTimeout(() => {
          record.timer = undefined;
          record.settled = true;
          this.#release(record);
        }, record.settling);
      }
    } catch {
      // An aborted observation and a host watcher failure both end this watch's reporting.
    }
  }

  #release(record: WatchRecord): void {
    const waiting = record.waiting;
    record.waiting = undefined;
    waiting?.();
  }

  disregard({ watch: identity, prefix }: { watch: string; prefix: string }) {
    const record = this.#watches.get(identity);
    if (record === undefined || !record.open) throw new WatchNotOpen();
    if (!isWatchText(prefix)) throw new InvalidWatch();
    if (!record.prefixes.includes(prefix)) record.prefixes.push(prefix);
    return { watch: record.watch, prefix };
  }

  async attend({ watch: identity, within }: { watch: string; within: number }) {
    const record = this.#watches.get(identity);
    if (record === undefined) throw new WatchNotFound();
    if (!isDuration(within)) throw new InvalidWatch();
    if (!record.open) return { changed: false, watching: false };
    if (record.settled) {
      record.settled = false;
      return { changed: true, watching: true };
    }

    await new Promise<void>((released) => {
      const span = setTimeout(() => {
        record.waiting = undefined;
        released();
      }, within);
      record.waiting = () => {
        clearTimeout(span);
        released();
      };
    });

    if (!record.open) return { changed: false, watching: false };
    if (!record.settled) return { changed: false, watching: true };
    record.settled = false;
    return { changed: true, watching: true };
  }

  close({ watch: identity }: { watch: string }) {
    const record = this.#watches.get(identity);
    if (record === undefined) throw new WatchNotFound();
    if (record.open) {
      record.open = false;
      if (record.timer !== undefined) clearTimeout(record.timer);
      record.timer = undefined;
      record.observation.abort();
      this.#release(record);
    }
    return { watch: record.watch };
  }

  _watch({ watch: identity }: { watch: string }): { directory: string; settling: number; state: "open" | "closed" }[] {
    const record = this.#watches.get(identity);
    return record === undefined
      ? []
      : [{ directory: record.directory, settling: record.settling, state: record.open ? "open" : "closed" }];
  }

  _disregarded({ watch: identity }: { watch: string }): { prefix: string }[] {
    return (this.#watches.get(identity)?.prefixes ?? []).map((prefix) => ({ prefix }));
  }

  _open(): { watch: string }[] {
    return [...this.#watches.values()].filter(({ open }) => open).map(({ watch: identity }) => ({ watch: identity }));
  }
}
