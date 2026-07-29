import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export class NotBegun extends Error {}
export class PathContested extends Error {}
export class PathLeavesDestination extends Error {}

type Producer = { producer: string; attempt: number };
type Intent = {
  intent: string;
  producer: string;
  path: string;
  content: Uint8Array;
  digest: string;
  medium: string;
  attempt: number;
};

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function compareBytes(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function isSafeOutputPath(path: string): boolean {
  return (
    path !== "" &&
    !path.includes("\u0000") &&
    !path.includes("\\") &&
    !isAbsolute(path) &&
    !/^[a-z]:/i.test(path) &&
    path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path));
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function statusAt(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
}

function specialKind(entry: { isSymbolicLink(): boolean; isBlockDevice(): boolean; isCharacterDevice(): boolean; isFIFO(): boolean; isSocket(): boolean }): string {
  if (entry.isSymbolicLink()) return "symlink";
  if (entry.isBlockDevice()) return "block-device";
  if (entry.isCharacterDevice()) return "character-device";
  if (entry.isFIFO()) return "fifo";
  if (entry.isSocket()) return "socket";
  return "unknown";
}

/** Reconcile producers' agreed byte intents with one local destination. */
export class EmittingConcept {
  #destination: string | undefined;
  readonly #producers = new Map<string, Producer>();
  readonly #intentsByProducer = new Map<string, Map<string, Intent>>();
  readonly #emitted = new Map<string, string>();

  async direct({ destination }: { destination: string }) {
    const requested = resolve(destination);
    await mkdir(requested, { recursive: true });
    const root = await realpath(requested);
    this.#destination = root;
    this.#emitted.clear();
    for (const [path, fileDigest] of await this.#filesBelow(root)) this.#emitted.set(path, fileDigest);
    return { destination, existing: this.#emitted.size };
  }

  begin({ producer }: { producer: string }) {
    const record = this.#producer(producer);
    record.attempt += 1;
    return { producer, attempt: record.attempt };
  }

  intend({ producer, path, content, medium }: { producer: string; path: string; content: Uint8Array; medium: string }) {
    if (!isSafeOutputPath(path)) throw new PathLeavesDestination();
    const nextDigest = digest(content);
    for (const intent of this.#intentsAt(path)) {
      if (intent.producer !== producer && intent.digest !== nextDigest) throw new PathContested();
    }

    const record = this.#producer(producer);
    const intents = this.#intentsByProducer.get(producer)!;
    const intent = `intent:${JSON.stringify([producer, path])}`;
    intents.set(path, { intent, producer, path, content: content.slice(), digest: nextDigest, medium, attempt: record.attempt });
    return { intent, path, digest: nextDigest };
  }

  commit({ producer }: { producer: string }) {
    const record = this.#producers.get(producer);
    if (record === undefined) throw new NotBegun();
    const intents = this.#intentsByProducer.get(producer)!;
    let dropped = 0;
    for (const [path, intent] of intents) {
      if (intent.attempt >= record.attempt) continue;
      intents.delete(path);
      dropped += 1;
    }
    return { producer, dropped };
  }

  retract({ producer }: { producer: string }) {
    const count = this.#intentsByProducer.get(producer)?.size ?? 0;
    this.#intentsByProducer.delete(producer);
    this.#producers.delete(producer);
    return { producer, count };
  }

  async reconcile() {
    const destination = this.#destination;
    if (destination === undefined) throw new Error("A destination must be directed before reconciliation.");

    this.#emitted.clear();
    for (const [path, fileDigest] of await this.#filesBelow(destination)) this.#emitted.set(path, fileDigest);
    const intended = this.#intended();
    const orphaned = [...this.#emitted.keys()]
      .filter((path) => !intended.has(path))
      .sort((left, right) => right.split("/").length - left.split("/").length || compareBytes(left, right));
    for (const path of orphaned) await this.#remove(path);

    let written = 0;
    let replaced = 0;
    let kept = 0;
    for (const [path, intent] of [...intended.entries()].sort(([left], [right]) => compareBytes(left, right))) {
      const previous = this.#emitted.get(path);
      if (previous === undefined) {
        await this.#write(path, intent.content);
        written += 1;
      } else if (previous !== intent.digest) {
        await this.#write(path, intent.content);
        replaced += 1;
      } else {
        kept += 1;
      }
    }

    this.#emitted.clear();
    for (const [path, intent] of intended) this.#emitted.set(path, intent.digest);
    return { written, replaced, kept, removed: orphaned.length };
  }

  _intent({ path }: { path: string }): { digest: string; medium: string }[] {
    const intent = this.#intentsAt(path).sort((left, right) => compareBytes(left.producer, right.producer))[0];
    return intent === undefined ? [] : [{ digest: intent.digest, medium: intent.medium }];
  }

  _producers({ path }: { path: string }): { producer: string }[] {
    return this.#intentsAt(path)
      .sort((left, right) => compareBytes(left.producer, right.producer))
      .map(({ producer }) => ({ producer }));
  }

  _byProducer({ producer }: { producer: string }): { path: string; digest: string; medium: string }[] {
    return [...(this.#intentsByProducer.get(producer)?.values() ?? [])]
      .sort((left, right) => compareBytes(left.path, right.path))
      .map(({ path, digest: intentDigest, medium }) => ({ path, digest: intentDigest, medium }));
  }

  _attempt({ producer }: { producer: string }): { attempt: number }[] {
    const record = this.#producers.get(producer);
    return record === undefined ? [] : [{ attempt: record.attempt }];
  }

  _pending(): { path: string; digest: string }[] {
    return [...this.#intended()]
      .filter(([path, intent]) => this.#emitted.get(path) !== intent.digest)
      .sort(([left], [right]) => compareBytes(left, right))
      .map(([path, intent]) => ({ path, digest: intent.digest }));
  }

  _orphans(): { path: string }[] {
    const intended = this.#intended();
    return [...this.#emitted.keys()]
      .filter((path) => !intended.has(path))
      .sort(compareBytes)
      .map((path) => ({ path }));
  }

  #producer(producer: string): Producer {
    const existing = this.#producers.get(producer);
    if (existing !== undefined) return existing;
    const record = { producer, attempt: 0 };
    this.#producers.set(producer, record);
    this.#intentsByProducer.set(producer, new Map());
    return record;
  }

  #intentsAt(path: string): Intent[] {
    return [...this.#intentsByProducer.values()]
      .map((intents) => intents.get(path))
      .filter((intent): intent is Intent => intent !== undefined);
  }

  #intended(): Map<string, Intent> {
    const intended = new Map<string, Intent>();
    for (const intents of this.#intentsByProducer.values()) {
      for (const intent of intents.values()) {
        const existing = intended.get(intent.path);
        if (existing === undefined || compareBytes(intent.producer, existing.producer) < 0) intended.set(intent.path, intent);
      }
    }
    return intended;
  }

  async #filesBelow(directory: string, prefix = ""): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareBytes(left.name, right.name));
    for (const entry of entries) {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      const location = join(directory, entry.name);
      if (entry.isDirectory()) {
        for (const [child, childDigest] of await this.#filesBelow(location, path)) files.set(child, childDigest);
      } else if (entry.isFile()) {
        files.set(path, digest(await readFile(location)));
      } else {
        files.set(path, `special:${specialKind(entry)}`);
      }
    }
    return files;
  }

  async #remove(path: string): Promise<void> {
    const target = await this.#target(path, false);
    if (target === undefined) return;
    const status = await statusAt(target);
    if (status === undefined) return;
    await rm(target, { force: true, recursive: status.isDirectory() });
  }

  async #write(path: string, content: Uint8Array): Promise<void> {
    const target = await this.#target(path, true);
    if (target === undefined) throw new PathLeavesDestination();
    const status = await statusAt(target);
    if (status !== undefined && (status.isSymbolicLink() || status.isDirectory() || !status.isFile())) {
      await rm(target, { force: true, recursive: status.isDirectory() });
    }
    await writeFile(target, content);
  }

  async #target(path: string, createParents: boolean): Promise<string | undefined> {
    const destination = this.#destination;
    if (destination === undefined) throw new Error("A destination must be directed before reconciliation.");
    const segments = path.split("/");
    let parent = destination;
    for (const segment of segments.slice(0, -1)) {
      const next = join(parent, segment);
      let status = await statusAt(next);
      if (status === undefined) {
        if (!createParents) return undefined;
        await mkdir(next);
        status = await statusAt(next);
      }
      if (status === undefined || status.isSymbolicLink()) throw new PathLeavesDestination();
      if (!status.isDirectory()) {
        if (!createParents) throw new PathLeavesDestination();
        await rm(next, { force: true, recursive: false });
        await mkdir(next);
      }
      const resolved = await realpath(next);
      if (!isWithin(destination, resolved)) throw new PathLeavesDestination();
      parent = next;
    }
    const target = resolve(parent, segments.at(-1)!);
    if (!isWithin(destination, target)) throw new PathLeavesDestination();
    return target;
  }
}
