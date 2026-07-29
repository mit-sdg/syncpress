import { createHash } from "node:crypto";

export class PathLeavesRoot extends Error {}
export class FileNotFound extends Error {}

type RootRecord = { root: string; name: string };
type FileRecord = {
  file: string;
  root: string;
  path: string;
  name: string;
  content: Uint8Array;
  digest: string;
};

const mediaByExtension: Record<string, string> = {
  avif: "image/avif",
  css: "text/css",
  gif: "image/gif",
  html: "text/html",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  md: "text/markdown",
  png: "image/png",
  svg: "image/svg+xml",
  txt: "text/plain",
  webp: "image/webp",
  xml: "application/xml",
  zip: "application/zip",
};

function digest(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function hasSafeSegments(path: string, allowEmpty: boolean): boolean {
  if (path === "") return allowEmpty;
  return !path.startsWith("/") && path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function comparePaths(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function resolvePath(origin: string, address: string): string | undefined {
  if (address.startsWith("/") || address.startsWith("#") || /^[a-z][a-z\d+.-]*:/i.test(address)) return undefined;
  const target = address.split(/[?#]/, 1)[0];
  if (target === undefined || target === "") return undefined;

  const segments = origin.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
      continue;
    }
    if (segment.includes("\\")) return undefined;
    segments.push(segment);
  }
  return segments.join("/");
}

/** Keep named, in-memory file trees with content-addressed change detection. */
export class FilingConcept {
  readonly #rootsByName = new Map<string, RootRecord>();
  readonly #rootsByID = new Map<string, RootRecord>();
  readonly #filesByID = new Map<string, FileRecord>();
  readonly #fileIDsByAddress = new Map<string, string>();

  open({ name }: { name: string }) {
    const existing = this.#rootsByName.get(name);
    if (existing !== undefined) return { root: existing.root };

    const root = `root:${name}`;
    const record = { root, name };
    this.#rootsByName.set(name, record);
    this.#rootsByID.set(root, record);
    return { root };
  }

  place({ root, path, content }: { root: string; path: string; content: Uint8Array }) {
    if (!this.#rootsByID.has(root) || !hasSafeSegments(path, false)) throw new PathLeavesRoot();

    const address = `${root}\u0000${path}`;
    const previousID = this.#fileIDsByAddress.get(address);
    const nextDigest = digest(content);
    if (previousID !== undefined) {
      const previous = this.#filesByID.get(previousID)!;
      const changed = previous.digest !== nextDigest;
      previous.content = content.slice();
      previous.digest = nextDigest;
      return { file: previous.file, digest: nextDigest, changed };
    }

    const file = `file:${root}:${path}`;
    const name = path.slice(path.lastIndexOf("/") + 1);
    const record = { file, root, path, name, content: content.slice(), digest: nextDigest };
    this.#filesByID.set(file, record);
    this.#fileIDsByAddress.set(address, file);
    return { file, digest: nextDigest, changed: true };
  }

  discard({ file }: { file: string }) {
    const record = this.#filesByID.get(file);
    if (record === undefined) throw new FileNotFound();
    this.#filesByID.delete(file);
    this.#fileIDsByAddress.delete(`${record.root}\u0000${record.path}`);
    return { root: record.root, path: record.path };
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
      : [{ root: record.root, path: record.path, name: record.name, content: record.content.slice(), digest: record.digest }];
  }

  _at({ root, path }: { root: string; path: string }): { file: string; digest: string }[] {
    const file = this.#fileIDsByAddress.get(`${root}\u0000${path}`);
    const record = file === undefined ? undefined : this.#filesByID.get(file);
    return record === undefined ? [] : [{ file: record.file, digest: record.digest }];
  }

  _under({ root, prefix }: { root: string; prefix: string }): { file: string; path: string; digest: string }[] {
    return [...this.#filesByID.values()]
      .filter((record) => record.root === root && (prefix === "" || record.path.startsWith(prefix)))
      .sort((left, right) => comparePaths(left.path, right.path))
      .map(({ file, path, digest: fileDigest }) => ({ file, path, digest: fileDigest }));
  }

  _resolve({ file, address }: { file: string; address: string }): { target: string; path: string }[] {
    const source = this.#filesByID.get(file);
    if (source === undefined) return [];
    const path = resolvePath(source.path, address);
    if (path === undefined) return [];
    const target = this.#fileIDsByAddress.get(`${source.root}\u0000${path}`);
    return target === undefined ? [] : [{ target, path }];
  }

  _join({ prefix, name }: { prefix: string; name: string }) {
    return { path: prefix === "" ? name : `${prefix}/${name}` };
  }

  _directory({ path }: { path: string }) {
    const separator = path.lastIndexOf("/");
    return { prefix: separator === -1 ? "" : path.slice(0, separator) };
  }

  _medium({ path }: { path: string }) {
    const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
    return { medium: mediaByExtension[extension] ?? "application/octet-stream" };
  }
}
