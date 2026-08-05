import { lstat, watch } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const INVALID_WATCH = "A watch needs a directory and a positive settling duration.";
const DIRECTORY_MISSING = "This required directory is missing.";
const DIRECTORY_UNSUPPORTED = "This required location must be a directory that is not a symbolic link.";
const DIRECTORY_UNOBSERVABLE = "This directory could not be observed.";
const WATCH_NOT_FOUND = "There is no such watch.";
const WATCH_FAILED = "The host watch stopped unexpectedly.";

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

export class WatchFailed extends Error {
  constructor() {
    super(WATCH_FAILED);
    this.name = "WatchFailed";
  }
}

type WatchRecord = {
  watch: string;
  directory: string;
  settling: number;
  state: "open" | "failed" | "closed";
  excluded: string[];
  prefixes: string[];
  settled: boolean;
  observation: AbortController;
  timer: ReturnType<typeof setTimeout> | undefined;
  waiting: (() => void) | undefined;
  task: Promise<void> | undefined;
};

function isWatchText(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value.isWellFormed();
}

function isDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function hasSiblingPrefix(prefix: string, candidate: string): boolean {
  const parent = dirname(prefix);
  if (!contains(parent, candidate)) return false;
  const [first] = relative(parent, candidate).split(sep);
  return first?.startsWith(basename(prefix)) ?? false;
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

  async observe(
    { directory, settling, excluded, prefix }: {
      directory: string;
      settling: number;
      excluded: string;
      prefix: string;
    },
  ) {
    if (!isWatchText(directory) || !isDuration(settling) || !isWatchText(excluded) || !isWatchText(prefix)) {
      throw new InvalidWatch();
    }
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
      state: "open",
      excluded: [resolve(excluded)],
      prefixes: [resolve(prefix)],
      settled: false,
      observation: new AbortController(),
      timer: undefined,
      waiting: undefined,
      task: undefined,
    };

    let events: AsyncIterable<{ filename: string | Buffer | null }>;
    try {
      events = watch(absolute, { recursive: true, signal: record.observation.signal });
    } catch {
      throw new DirectoryUnobservable();
    }

    this.#watches.set(record.watch, record);
    record.task = this.#consume(record, events);
    return { watch: record.watch };
  }

  /** Restart the settling span for every change the watch still counts. */
  async #consume(record: WatchRecord, events: AsyncIterable<{ filename: string | Buffer | null }>): Promise<void> {
    try {
      for await (const event of events) {
        if (record.state !== "open") break;
        if (event.filename === null) continue;
        const changed = resolve(record.directory, event.filename.toString());
        if (!contains(record.directory, changed)) {
          this.#fail(record);
          return;
        }
        if (record.excluded.some((path) => contains(path, changed))) continue;
        if (record.prefixes.some((prefix) => hasSiblingPrefix(prefix, changed))) continue;
        if (record.timer !== undefined) clearTimeout(record.timer);
        record.timer = setTimeout(() => {
          record.timer = undefined;
          record.settled = true;
          this.#release(record);
        }, record.settling);
      }
      if (record.state === "open") this.#fail(record);
    } catch {
      if (record.state === "open") this.#fail(record);
    }
  }

  #fail(record: WatchRecord): void {
    record.state = "failed";
    if (record.timer !== undefined) clearTimeout(record.timer);
    record.timer = undefined;
    this.#release(record);
  }

  #release(record: WatchRecord): void {
    const waiting = record.waiting;
    record.waiting = undefined;
    waiting?.();
  }

  async attend({ watch: identity, within }: { watch: string; within: number }) {
    const record = this.#watches.get(identity);
    if (record === undefined) throw new WatchNotFound();
    if (!isDuration(within)) throw new InvalidWatch();
    const state = record.state as WatchRecord["state"];
    if (state === "failed") throw new WatchFailed();
    if (state === "closed") return { changed: false, watching: false };
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

    const current = record.state as WatchRecord["state"];
    if (current === "failed") throw new WatchFailed();
    if (current === "closed") return { changed: false, watching: false };
    if (!record.settled) return { changed: false, watching: true };
    record.settled = false;
    return { changed: true, watching: true };
  }

  async close({ watch: identity }: { watch: string }) {
    const record = this.#watches.get(identity);
    if (record === undefined) throw new WatchNotFound();
    if (record.state !== "closed") {
      record.state = "closed";
      if (record.timer !== undefined) clearTimeout(record.timer);
      record.timer = undefined;
      record.observation.abort();
      this.#release(record);
      await record.task;
    }
    return { watch: record.watch };
  }

  _watch({ watch: identity }: { watch: string }): { directory: string; settling: number; state: "open" | "failed" | "closed" }[] {
    const record = this.#watches.get(identity);
    return record === undefined ? [] : [{ directory: record.directory, settling: record.settling, state: record.state }];
  }

  _excluded({ watch: identity }: { watch: string }): { path: string }[] {
    return (this.#watches.get(identity)?.excluded ?? []).map((path) => ({ path }));
  }

  _open(): { watch: string }[] {
    return [...this.#watches.values()].filter(({ state }) => state === "open").map(({ watch: identity }) => ({ watch: identity }));
  }
}
