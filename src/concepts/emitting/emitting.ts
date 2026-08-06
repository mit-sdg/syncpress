import { createHash } from "node:crypto";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const INVALID_DESTINATION = "A destination must name a directory other than the filesystem root.";
const DESTINATION_UNAVAILABLE = "The destination could not be inspected.";
const INVALID_PRODUCER = "A producer identity must be well-formed text.";
const INVALID_CLAIM = "An artifact claim identity must be well-formed text.";
const ATTEMPT_EXHAUSTED = "This producer has no remaining safe attempt number.";
const PATH_LEAVES_DESTINATION = "An artifact path must stay inside the destination.";
const INVALID_PATH = "An artifact path must use the canonical portable form.";
const INVALID_CONTENT = "Artifact content must be bytes or well-formed text.";
const INVALID_MEDIUM = "An artifact medium must be well-formed text.";
const PATH_CONTESTED = "This artifact path conflicts with another intended artifact.";
const NOT_BEGUN = "This producer has no open attempt.";
const STALE_ATTEMPT = "This producer attempt is no longer active.";
const DESTINATION_NOT_DIRECTED = "No destination has been directed.";
const RECONCILIATION_FAILED = "The intended destination tree could not be installed.";

/** Serialize reconciliation across fresh concept instances in this process. */
const destinationTails = new Map<string, Promise<void>>();

async function acquireDestination(destination: string): Promise<() => void> {
  const previous = destinationTails.get(destination) ?? Promise.resolve();
  let unlock!: () => void;
  const held = new Promise<void>((resolveHeld) => {
    unlock = resolveHeld;
  });
  const tail = previous.then(() => held);
  destinationTails.set(destination, tail);
  await previous;
  return () => {
    unlock();
    void tail.finally(() => {
      if (destinationTails.get(destination) === tail) destinationTails.delete(destination);
    });
  };
}

export class InvalidDestination extends Error {
  constructor() {
    super(INVALID_DESTINATION);
    this.name = "InvalidDestination";
  }
}

export class DestinationUnavailable extends Error {
  constructor(options?: ErrorOptions) {
    super(DESTINATION_UNAVAILABLE, options);
    this.name = "DestinationUnavailable";
  }
}

export class InvalidProducer extends Error {
  constructor() {
    super(INVALID_PRODUCER);
    this.name = "InvalidProducer";
  }
}

export class InvalidClaim extends Error {
  constructor() {
    super(INVALID_CLAIM);
    this.name = "InvalidClaim";
  }
}

export class AttemptExhausted extends Error {
  constructor() {
    super(ATTEMPT_EXHAUSTED);
    this.name = "AttemptExhausted";
  }
}

export class PathLeavesDestination extends Error {
  constructor() {
    super(PATH_LEAVES_DESTINATION);
    this.name = "PathLeavesDestination";
  }
}

export class InvalidPath extends Error {
  constructor() {
    super(INVALID_PATH);
    this.name = "InvalidPath";
  }
}

export class InvalidContent extends Error {
  constructor() {
    super(INVALID_CONTENT);
    this.name = "InvalidContent";
  }
}

export class InvalidMedium extends Error {
  constructor() {
    super(INVALID_MEDIUM);
    this.name = "InvalidMedium";
  }
}

export class PathContested extends Error {
  constructor() {
    super(PATH_CONTESTED);
    this.name = "PathContested";
  }
}

export class NotBegun extends Error {
  constructor() {
    super(NOT_BEGUN);
    this.name = "NotBegun";
  }
}

export class StaleAttempt extends Error {
  constructor() {
    super(STALE_ATTEMPT);
    this.name = "StaleAttempt";
  }
}

export class DestinationNotDirected extends Error {
  constructor() {
    super(DESTINATION_NOT_DIRECTED);
    this.name = "DestinationNotDirected";
  }
}

export class ReconciliationFailed extends Error {
  constructor(options?: ErrorOptions) {
    super(RECONCILIATION_FAILED, options);
    this.name = "ReconciliationFailed";
  }
}

type ArtifactContent = Uint8Array | string;
type Intent = {
  intent: string;
  producer: string;
  claim: string;
  path: string;
  content: Uint8Array;
  digest: string;
  medium: string;
  attempt: number;
};
type ProducerRecord = {
  producer: string;
  attempt: number;
  active: Map<string, Intent>;
  staged?: Map<string, Intent>;
};
type EmittedEntry = {
  path: string;
  kind: string;
  content?: Uint8Array;
  digest?: string;
};
type Snapshot = {
  exists: boolean;
  mode: number;
  entries: Map<string, EmittedEntry>;
  directories: Set<string>;
};
type PathStatus = "canonical" | "outside" | "invalid";

const encoder = new TextEncoder();

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function requireProducer(producer: unknown): asserts producer is string {
  if (!isText(producer)) throw new InvalidProducer();
}

function requireClaim(claim: unknown): asserts claim is string {
  if (!isText(claim)) throw new InvalidClaim();
}

function requireMedium(medium: unknown): asserts medium is string {
  if (!isText(medium)) throw new InvalidMedium();
}

function normalizedContent(content: unknown): Uint8Array {
  if (typeof content === "string") {
    if (!content.isWellFormed()) throw new InvalidContent();
    return encoder.encode(content);
  }
  if (!(content instanceof Uint8Array)) throw new InvalidContent();
  try {
    return Uint8Array.from(content);
  } catch {
    throw new InvalidContent();
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
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

function isSegment(segment: string): boolean {
  if (
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    !segment.isWellFormed() ||
    segment.normalize("NFC") !== segment ||
    /[\\\u0000-\u001f\u007f]/u.test(segment)
  ) {
    return false;
  }
  return true;
}

function pathStatus(path: unknown): PathStatus {
  if (typeof path !== "string" || path === "") return "invalid";
  if (path.startsWith("/") || /^[a-z]:\//i.test(path)) return "outside";

  let depth = 0;
  let canonical = true;
  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "..") {
      if (depth === 0) return "outside";
      depth -= 1;
      canonical = false;
    } else if (segment === ".") {
      canonical = false;
    } else {
      if (!isSegment(segment)) return "invalid";
      depth += 1;
    }
  }
  return canonical ? "canonical" : "invalid";
}

function pathsOverlap(left: string, right: string): boolean {
  return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function intentIdentity(producer: string, path: string): string {
  return `intent:${JSON.stringify([producer, path])}`;
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

async function statusAt(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
}

function entryKind(entry: {
  isSymbolicLink(): boolean;
  isBlockDevice(): boolean;
  isCharacterDevice(): boolean;
  isFIFO(): boolean;
  isSocket(): boolean;
}): string {
  if (entry.isSymbolicLink()) return "symlink";
  if (entry.isBlockDevice()) return "block-device";
  if (entry.isCharacterDevice()) return "character-device";
  if (entry.isFIFO()) return "fifo";
  if (entry.isSocket()) return "socket";
  return "unknown";
}

function nativePath(root: string, path: string): string {
  return join(root, ...path.split("/"));
}

function expectedDirectories(paths: Iterable<string>): Set<string> {
  const directories = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/");
    for (let length = 1; length < segments.length; length += 1) {
      directories.add(segments.slice(0, length).join("/"));
    }
  }
  return directories;
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function sameEntry(left: EmittedEntry, right: EmittedEntry): boolean {
  if (left.kind !== right.kind) return false;
  if (left.content === undefined || right.content === undefined) return left.content === right.content;
  return sameBytes(left.content, right.content);
}

function sameSnapshot(left: Snapshot, right: Snapshot): boolean {
  return left.exists === right.exists &&
    left.mode === right.mode &&
    left.entries.size === right.entries.size &&
    [...left.entries].every(([path, entry]) => {
      const other = right.entries.get(path);
      return other !== undefined && sameEntry(entry, other);
    }) &&
    sameSet(left.directories, right.directories);
}

/** Reconcile independent producers' exact byte artifacts with one local destination. */
export class EmittingConcept {
  #destination: string | undefined;
  #transactionPrefix: string | undefined;
  readonly #producers = new Map<string, ProducerRecord>();
  readonly #emitted = new Map<string, EmittedEntry>();

  async configureDestination({ destination, prefix }: { destination: string; prefix: string }) {
    if (!isText(destination) || destination === "" || destination.includes("\u0000") || !isText(prefix) || prefix === "") {
      throw new InvalidDestination();
    }

    const requested = resolve(destination);
    const transactionPrefix = resolve(prefix);
    if (dirname(requested) === requested || dirname(transactionPrefix) !== dirname(requested) || transactionPrefix === requested) {
      throw new InvalidDestination();
    }

    let directed = requested;
    let snapshot: Snapshot;
    try {
      const status = await statusAt(requested);
      if (status === undefined) {
        snapshot = { exists: false, mode: 0o755, entries: new Map(), directories: new Set() };
      } else {
        try {
          directed = await realpath(requested);
        } catch (error) {
          if (status.isSymbolicLink() && ["ENOENT", "ELOOP", "ENOTDIR"].includes(errorCode(error) ?? "")) {
            throw new InvalidDestination();
          }
          throw error;
        }
        const rootStatus = await statusAt(directed);
        if (rootStatus === undefined || !rootStatus.isDirectory() || rootStatus.isSymbolicLink()) {
          throw new InvalidDestination();
        }
        if (dirname(directed) === directed) throw new InvalidDestination();
        snapshot = await this.#snapshot(directed, rootStatus.mode & 0o777);
      }
    } catch (error) {
      if (error instanceof InvalidDestination) throw error;
      if (errorCode(error) === "ENOTDIR") throw new InvalidDestination();
      throw new DestinationUnavailable({ cause: error });
    }

    this.#destination = directed;
    this.#transactionPrefix = transactionPrefix;
    this.#recordSnapshot(snapshot);
    return { destination, existing: snapshot.entries.size };
  }

  beginAttempt({ producer }: { producer: string }) {
    requireProducer(producer);
    const record = this.#producer(producer);
    if (record.attempt === Number.MAX_SAFE_INTEGER) throw new AttemptExhausted();
    record.attempt += 1;
    record.staged = new Map();
    return { producer, attempt: record.attempt };
  }

  intend({ producer, attempt, path, content, medium, claim }: { producer: string; attempt?: unknown; path: string; content: ArtifactContent; medium: string; claim?: string }) {
    requireProducer(producer);
    const normalizedClaim = claim ?? producer;
    requireClaim(normalizedClaim);
    const status = pathStatus(path);
    if (status === "outside") throw new PathLeavesDestination();
    if (status === "invalid") throw new InvalidPath();
    const bytes = normalizedContent(content);
    requireMedium(medium);

    const current = this.#producers.get(producer);
    const staging = current?.staged !== undefined;
    if ((staging && attempt !== current.attempt) || (!staging && attempt !== undefined)) throw new StaleAttempt();
    this.#assertAvailable(producer, normalizedClaim, path, bytes, staging);

    const record = current ?? this.#producer(producer);
    const intent = intentIdentity(producer, path);
    const next = { intent, producer, claim: normalizedClaim, path, content: bytes, digest: digest(bytes), medium, attempt: record.attempt };
    (record.staged ?? record.active).set(path, next);
    return { intent, path, digest: next.digest };
  }

  commitAttempt({ producer, attempt }: { producer: string; attempt: unknown }) {
    requireProducer(producer);
    const record = this.#producers.get(producer);
    if (record?.staged === undefined) throw new NotBegun();
    if (attempt !== record.attempt) throw new StaleAttempt();

    let dropped = 0;
    for (const path of record.active.keys()) {
      if (!record.staged.has(path)) dropped += 1;
    }
    record.active = record.staged;
    record.staged = undefined;
    return { producer, dropped };
  }

  abortAttempt({ producer, attempt }: { producer: string; attempt: unknown }) {
    requireProducer(producer);
    const record = this.#producers.get(producer);
    if (record?.staged === undefined) throw new NotBegun();
    if (attempt !== record.attempt) throw new StaleAttempt();

    const discarded = record.staged.size;
    record.staged = undefined;
    return { producer, discarded };
  }

  retractProducer({ producer }: { producer: string }) {
    requireProducer(producer);
    const record = this.#producers.get(producer);
    const paths = new Set([...(record?.active.keys() ?? []), ...(record?.staged?.keys() ?? [])]);
    this.#producers.delete(producer);
    return { producer, count: paths.size };
  }

  async reconcile() {
    const destination = this.#destination;
    const transactionPrefix = this.#transactionPrefix;
    if (destination === undefined || transactionPrefix === undefined) throw new DestinationNotDirected();
    const release = await acquireDestination(destination);

    try {
      let snapshot: Snapshot;
      try {
        const status = await statusAt(destination);
        if (status === undefined) {
          snapshot = { exists: false, mode: 0o755, entries: new Map(), directories: new Set() };
        } else {
          if (!status.isDirectory() || status.isSymbolicLink()) {
            throw new Error("The directed destination is no longer a directory.");
          }
          snapshot = await this.#snapshot(destination, status.mode & 0o777);
        }
      } catch (error) {
        throw new ReconciliationFailed({ cause: error });
      }

      const intended = this.#intended();
      let written = 0;
      let replaced = 0;
      let kept = 0;
      for (const [path, intent] of intended) {
        const previous = snapshot.entries.get(path);
        if (previous === undefined) written += 1;
        else if (this.#entryMatches(previous, intent)) kept += 1;
        else replaced += 1;
      }
      let removed = 0;
      for (const path of snapshot.entries.keys()) {
        if (!intended.has(path)) removed += 1;
      }

      const directories = expectedDirectories(intended.keys());
      const exact =
        snapshot.exists &&
        snapshot.entries.size === intended.size &&
        [...intended].every(([path, intent]) => {
          const entry = snapshot.entries.get(path);
          return entry !== undefined && this.#entryMatches(entry, intent);
        }) &&
        sameSet(snapshot.directories, directories);

      if (!exact) {
        try {
          await this.#install(destination, transactionPrefix, snapshot, intended);
        } catch (error) {
          throw new ReconciliationFailed({ cause: error });
        }
        this.#recordIntended(intended);
      } else {
        this.#recordSnapshot(snapshot);
      }
      return { written, replaced, kept, removed };
    } finally {
      release();
    }
  }

  _intent({ path }: { path: string }): { digest: string; medium: string }[] {
    if (pathStatus(path) !== "canonical") return [];
    const intent = this.#activeAt(path)[0];
    return intent === undefined ? [] : [{ digest: intent.digest, medium: intent.medium }];
  }

  _producers({ path }: { path: string }): { producer: string }[] {
    if (pathStatus(path) !== "canonical") return [];
    const matching = (storeOf: (record: ProducerRecord) => Map<string, Intent> | undefined): string[] => {
      const producers = new Set<string>();
      for (const record of this.#producers.values()) {
        const store = storeOf(record);
        if (store !== undefined && [...store.keys()].some((reserved) => reserved === path || pathsOverlap(reserved, path))) {
          producers.add(record.producer);
        }
      }
      return [...producers].sort(compareText);
    };
    const active = matching((record) => record.active);
    return (active.length > 0 ? active : matching((record) => record.staged)).map((producer) => ({ producer }));
  }

  _byProducer({ producer }: { producer: string }): { path: string; digest: string; medium: string }[] {
    if (!isText(producer)) return [];
    return [...(this.#producers.get(producer)?.active.values() ?? [])]
      .sort((left, right) => compareText(left.path, right.path))
      .map(({ path, digest: intentDigest, medium }) => ({ path, digest: intentDigest, medium }));
  }

  _attempt({ producer }: { producer: string }): { attempt: number }[] {
    if (!isText(producer)) return [];
    const record = this.#producers.get(producer);
    return record === undefined ? [] : [{ attempt: record.attempt }];
  }

  _open({ producer }: { producer: string }): { attempt: number }[] {
    if (!isText(producer)) return [];
    const record = this.#producers.get(producer);
    return record?.staged === undefined ? [] : [{ attempt: record.attempt }];
  }

  _pending(): { path: string; digest: string }[] {
    return [...this.#intended()]
      .filter(([path, intent]) => {
        const entry = this.#emitted.get(path);
        return entry === undefined || !this.#entryMatches(entry, intent);
      })
      .sort(([left], [right]) => compareText(left, right))
      .map(([path, intent]) => ({ path, digest: intent.digest }));
  }

  _orphans(): { path: string }[] {
    const intended = this.#intended();
    return [...this.#emitted.keys()]
      .filter((path) => !intended.has(path))
      .sort(compareText)
      .map((path) => ({ path }));
  }

  #producer(producer: string): ProducerRecord {
    const existing = this.#producers.get(producer);
    if (existing !== undefined) return existing;
    const record = { producer, attempt: 0, active: new Map<string, Intent>() };
    this.#producers.set(producer, record);
    return record;
  }

  #assertAvailable(producer: string, claim: string, path: string, content: Uint8Array, staging: boolean): void {
    const records = [...this.#producers.values()].sort((left, right) => compareText(left.producer, right.producer));
    for (const record of records) {
      const stores: Map<string, Intent>[] = [];
      if (record.producer === producer) {
        stores.push(staging ? record.staged! : record.active);
      } else {
        stores.push(record.active);
        if (record.staged !== undefined) stores.push(record.staged);
      }

      for (const store of stores) {
        const intents = [...store.values()].sort((left, right) => compareText(left.path, right.path));
        for (const incumbent of intents) {
          if (incumbent.path === path) {
            if (
              !sameBytes(incumbent.content, content) &&
              (incumbent.producer !== producer || incumbent.claim !== claim)
            ) {
              throw new PathContested();
            }
          } else if (pathsOverlap(incumbent.path, path)) {
            throw new PathContested();
          }
        }
      }
    }
  }

  #activeAt(path: string): Intent[] {
    const intents: Intent[] = [];
    for (const record of this.#producers.values()) {
      const intent = record.active.get(path);
      if (intent !== undefined) intents.push(intent);
    }
    return intents.sort((left, right) => compareText(left.producer, right.producer));
  }

  #intended(): Map<string, Intent> {
    const intended = new Map<string, Intent>();
    for (const record of this.#producers.values()) {
      for (const intent of record.active.values()) {
        const incumbent = intended.get(intent.path);
        if (incumbent === undefined || compareText(intent.producer, incumbent.producer) < 0) {
          intended.set(intent.path, intent);
        }
      }
    }
    return intended;
  }

  #entryMatches(entry: EmittedEntry, intent: Intent): boolean {
    return entry.kind === "file" && entry.content !== undefined && sameBytes(entry.content, intent.content);
  }

  async #snapshot(directory: string, mode: number): Promise<Snapshot> {
    const entries = new Map<string, EmittedEntry>();
    const directories = new Set<string>();
    const visit = async (current: string, prefix: string): Promise<void> => {
      const children = await readdir(current, { withFileTypes: true });
      children.sort((left, right) => compareText(left.name, right.name));
      for (const child of children) {
        const path = prefix === "" ? child.name : `${prefix}/${child.name}`;
        const location = join(current, child.name);
        if (child.isDirectory()) {
          directories.add(path);
          await visit(location, path);
        } else if (child.isFile()) {
          const content = Uint8Array.from(await readFile(location));
          entries.set(path, { path, kind: "file", content, digest: digest(content) });
        } else {
          entries.set(path, { path, kind: entryKind(child) });
        }
      }
    };
    await visit(directory, "");
    return { exists: true, mode, entries, directories };
  }

  async #install(destination: string, transactionPrefix: string, snapshot: Snapshot, intended: Map<string, Intent>): Promise<void> {
    const parent = dirname(destination);
    await mkdir(parent, { recursive: true });
    const transaction = await mkdtemp(transactionPrefix);
    const staged = join(transaction, "next");
    const previous = join(transaction, "previous");
    let preserveTransaction = false;
    let installed = false;

    try {
      await mkdir(staged, { mode: 0o700 });
      for (const [path, intent] of [...intended].sort(([left], [right]) => compareText(left, right))) {
        const target = nativePath(staged, path);
        await mkdir(dirname(target), { recursive: true });
        const prior = snapshot.entries.get(path);
        if (snapshot.exists && prior !== undefined && this.#entryMatches(prior, intent)) {
          try {
            await link(nativePath(destination, path), target);
            continue;
          } catch {
            // A byte-for-byte write is the portable fallback when hard links are unavailable.
          }
        }
        await writeFile(target, intent.content, { flag: "wx" });
      }
      await chmod(staged, snapshot.mode);

      if (snapshot.exists) {
        await rename(destination, previous);
        const previousStatus = await statusAt(previous);
        const moved = previousStatus === undefined || !previousStatus.isDirectory() || previousStatus.isSymbolicLink()
          ? undefined
          : await this.#snapshot(previous, previousStatus.mode & 0o777);
        if (moved === undefined || !sameSnapshot(snapshot, moved)) {
          const changed = new Error("The destination changed while reconciliation was being prepared.");
          try {
            await rename(previous, destination);
          } catch (restoreError) {
            preserveTransaction = true;
            throw new AggregateError([changed, restoreError], "The concurrently changed destination could not be restored.");
          }
          throw changed;
        }
      } else if ((await statusAt(destination)) !== undefined) {
        throw new Error("The destination appeared while reconciliation was being prepared.");
      }

      try {
        await rename(staged, destination);
        installed = true;
      } catch (error) {
        if (snapshot.exists) {
          try {
            await rename(previous, destination);
          } catch (restoreError) {
            preserveTransaction = true;
            throw new AggregateError([error, restoreError], "The previous destination could not be restored.");
          }
        }
        throw error;
      }

      if (snapshot.exists) await rm(previous, { force: true, recursive: true }).catch(() => undefined);
    } finally {
      if (!installed && snapshot.exists && !preserveTransaction && (await statusAt(destination)) === undefined) {
        try {
          await rename(previous, destination);
        } catch {
          preserveTransaction = (await statusAt(previous).catch(() => undefined)) !== undefined;
        }
      }
      if (!preserveTransaction) await rm(transaction, { force: true, recursive: true }).catch(() => undefined);
    }
  }

  #recordSnapshot(snapshot: Snapshot): void {
    this.#emitted.clear();
    for (const [path, entry] of snapshot.entries) this.#emitted.set(path, entry);
  }

  #recordIntended(intended: Map<string, Intent>): void {
    this.#emitted.clear();
    for (const [path, intent] of intended) {
      this.#emitted.set(path, {
        path,
        kind: "file",
        content: Uint8Array.from(intent.content),
        digest: intent.digest,
      });
    }
  }
}
