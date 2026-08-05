import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export class RootNotFound extends Error {}
export class PathLeavesRoot extends Error {}
export class InvalidPath extends Error {}
export class InvalidEncoding extends Error {}
export class FileNotFound extends Error {}

export type ResolutionStatus = "found" | "missing" | "outside" | "nonlocal" | "invalid" | "unknown-file";

type RootRecord = { root: string; name: string };
type FileRecord = {
  file: string;
  root: string;
  path: string;
  name: string;
  content: Uint8Array;
  digest: string;
};

type Resolution = { status: ResolutionStatus; path?: string; target?: string };
type PathStatus = "canonical" | "outside" | "invalid";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const scheme = /^[a-z][a-z\d+.-]*:/i;
const forbiddenSegmentCharacter = /[\\/\u0000-\u001f\u007f]/u;

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function copyBytes(content: Uint8Array): Uint8Array {
  if (!(content instanceof Uint8Array)) throw new TypeError("File content must be bytes.");
  return Uint8Array.from(content);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function isScalarText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isPathSegment(value: unknown): value is string {
  return isScalarText(value) && value !== "" && value !== "." && value !== ".." &&
    value.normalize("NFC") === value && !forbiddenSegmentCharacter.test(value);
}

function pathStatus(path: unknown): PathStatus {
  if (typeof path !== "string" || path === "") return "invalid";
  if (path.startsWith("/")) return "outside";
  let depth = 0;
  let canonical = true;
  for (const segment of path.split("/")) {
    if (segment === "..") {
      if (depth === 0) return "outside";
      depth -= 1;
      canonical = false;
    } else if (segment === ".") {
      canonical = false;
    } else {
      if (!isPathSegment(segment)) return "invalid";
      depth += 1;
    }
  }
  return canonical ? "canonical" : "invalid";
}

function isDirectoryPath(prefix: unknown): prefix is string {
  return prefix === "" || pathStatus(prefix) === "canonical";
}

function comparePaths(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function rootIdentity(name: string): string {
  return `root:${JSON.stringify(name)}`;
}

function fileIdentity(root: string, path: string): string {
  return `file:${JSON.stringify([root, path])}`;
}

/** Keep independent, named byte trees with stable identities and exact change detection. */
export class FilingConcept {
  readonly #rootsByName = new Map<string, RootRecord>();
  readonly #rootsByID = new Map<string, RootRecord>();
  readonly #filesByID = new Map<string, FileRecord>();
  readonly #fileIDsByRoot = new Map<string, Map<string, string>>();

  open({ name }: { name: string }) {
    if (typeof name !== "string") throw new TypeError("A root name must be text.");
    const existing = this.#rootsByName.get(name);
    if (existing !== undefined) return { root: existing.root };

    const root = rootIdentity(name);
    const record = { root, name };
    this.#rootsByName.set(name, record);
    this.#rootsByID.set(root, record);
    this.#fileIDsByRoot.set(root, new Map());
    return { root };
  }

  place({ root, path, content }: { root: string; path: string; content: Uint8Array }) {
    return this.#place(root, path, content);
  }

  placeBase64({ root, path, encoded }: { root: string; path: string; encoded: string }) {
    if (typeof encoded !== "string") throw new InvalidEncoding();
    const content = Buffer.from(encoded, "base64");
    if (content.toString("base64") !== encoded) throw new InvalidEncoding();
    return this.#place(root, path, content);
  }

  #place(root: string, path: string, content: Uint8Array) {
    if (!this.#rootsByID.has(root)) throw new RootNotFound();
    const status = pathStatus(path);
    if (status === "outside") throw new PathLeavesRoot();
    if (status === "invalid") throw new InvalidPath();

    const nextContent = copyBytes(content);
    const nextDigest = digest(nextContent);
    const filesAtRoot = this.#fileIDsByRoot.get(root)!;
    const previousID = filesAtRoot.get(path);
    if (previousID !== undefined) {
      const previous = this.#filesByID.get(previousID)!;
      const changed = !sameBytes(previous.content, nextContent);
      previous.content = nextContent;
      previous.digest = nextDigest;
      return { file: previous.file, digest: nextDigest, changed };
    }

    const file = fileIdentity(root, path);
    const name = path.slice(path.lastIndexOf("/") + 1);
    const record = { file, root, path, name, content: nextContent, digest: nextDigest };
    this.#filesByID.set(file, record);
    filesAtRoot.set(path, file);
    return { file, digest: nextDigest, changed: true };
  }

  discard({ file }: { file: string }) {
    const record = this.#filesByID.get(file);
    if (record === undefined) throw new FileNotFound();
    this.#filesByID.delete(file);
    this.#fileIDsByRoot.get(record.root)!.delete(record.path);
    return { root: record.root, path: record.path, name: record.name };
  }

  _root({ root }: { root: string }): { name: string }[] {
    const record = this.#rootsByID.get(root);
    return record === undefined ? [] : [{ name: record.name }];
  }

  _named({ name }: { name: string }): { root: string }[] {
    const record = this.#rootsByName.get(name);
    return record === undefined ? [] : [{ root: record.root }];
  }

  _file({ file }: { file: string }): { root: string; path: string; name: string; content: Uint8Array; digest: string }[] {
    const record = this.#filesByID.get(file);
    return record === undefined
      ? []
      : [{ root: record.root, path: record.path, name: record.name, content: copyBytes(record.content), digest: record.digest }];
  }

  _text({ file }: { file: string }): { text: string }[] {
    const record = this.#filesByID.get(file);
    if (record === undefined) return [];
    try {
      return [{ text: decoder.decode(record.content) }];
    } catch {
      return [];
    }
  }

  _files(): { file: string; root: string; path: string }[] {
    return [...this.#rootsByID.keys()]
      .flatMap((root) =>
        [...this.#fileIDsByRoot.get(root)!.values()]
          .map((file) => this.#filesByID.get(file)!)
          .sort((left, right) => comparePaths(left.path, right.path))
      )
      .map(({ file, root, path }) => ({ file, root, path }));
  }

  _at({ root, path }: { root: string; path: string }): { file: string; digest: string }[] {
    if (pathStatus(path) !== "canonical") return [];
    const file = this.#fileIDsByRoot.get(root)?.get(path);
    const record = file === undefined ? undefined : this.#filesByID.get(file);
    return record === undefined ? [] : [{ file: record.file, digest: record.digest }];
  }

  _under({ root, prefix }: { root: string; prefix: string }): { file: string; path: string; digest: string }[] {
    if (!isDirectoryPath(prefix)) return [];
    const filesAtRoot = this.#fileIDsByRoot.get(root);
    if (filesAtRoot === undefined) return [];
    const beginning = prefix === "" ? "" : `${prefix}/`;
    return [...filesAtRoot.values()]
      .map((file) => this.#filesByID.get(file)!)
      .filter((record) => beginning === "" || record.path.startsWith(beginning))
      .sort((left, right) => comparePaths(left.path, right.path))
      .map(({ file, path, digest: fileDigest }) => ({ file, path, digest: fileDigest }));
  }

  _resolve({ file, address }: { file: string; address: string }): { target: string; path: string }[] {
    const resolution = this.#resolution(file, address);
    return resolution.status === "found" ? [{ target: resolution.target!, path: resolution.path! }] : [];
  }

  _resolution({ file, address }: { file: string; address: string }): { status: ResolutionStatus } {
    return { status: this.#resolution(file, address).status };
  }

  #resolution(file: string, address: string): Resolution {
    const source = this.#filesByID.get(file);
    if (source === undefined) return { status: "unknown-file" };
    if (typeof address !== "string" || !isScalarText(address)) return { status: "invalid" };
    if (address.startsWith("/") || scheme.test(address)) return { status: "nonlocal" };

    const query = address.indexOf("?");
    const fragment = address.indexOf("#");
    const end = Math.min(query === -1 ? address.length : query, fragment === -1 ? address.length : fragment);
    const referencePath = address.slice(0, end);
    if (referencePath === "") return { status: "found", path: source.path, target: source.file };
    if (referencePath.endsWith("/")) return { status: "invalid" };

    const targetSegments = source.path.split("/").slice(0, -1);
    const rawSegments = referencePath.split("/");
    let endsAtDirectory = false;
    for (let index = 0; index < rawSegments.length; index += 1) {
      const raw = rawSegments[index]!;
      if (raw === "") return { status: "invalid" };

      let segment: string;
      try {
        segment = decodeURIComponent(raw);
      } catch {
        return { status: "invalid" };
      }
      if (segment.includes("/") || !isScalarText(segment) || segment.normalize("NFC") !== segment) {
        return { status: "invalid" };
      }
      if (segment === ".") {
        endsAtDirectory = index === rawSegments.length - 1;
        continue;
      }
      if (segment === "..") {
        if (targetSegments.length === 0) return { status: "outside" };
        targetSegments.pop();
        endsAtDirectory = index === rawSegments.length - 1;
        continue;
      }
      if (!isPathSegment(segment)) return { status: "invalid" };
      targetSegments.push(segment);
      endsAtDirectory = false;
    }
    if (endsAtDirectory || targetSegments.length === 0) return { status: "invalid" };

    const path = targetSegments.join("/");
    const target = this.#fileIDsByRoot.get(source.root)?.get(path);
    return target === undefined ? { status: "missing", path } : { status: "found", path, target };
  }
}
