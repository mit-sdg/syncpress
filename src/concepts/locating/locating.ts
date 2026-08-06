import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const INVALID_LOCATION = "A location must be well-formed, non-empty text.";
const LOCATION_MISSING = "This required directory is missing.";
const LOCATION_NOT_DIRECTORY = "This required location must be a directory that is not a symbolic link.";
const LOCATION_UNRESOLVABLE = "This location could not be resolved.";
const NOT_GROUNDED = "No base directory has been grounded.";

export class InvalidLocation extends Error {
  constructor() {
    super(INVALID_LOCATION);
    this.name = "InvalidLocation";
  }
}

class UnresolvableHostPath extends Error {}

export class NotGrounded extends Error {
  constructor() {
    super(NOT_GROUNDED);
    this.name = "NotGrounded";
  }
}

type Base = { path: string; real: string };
type PlaceRecord = {
  place: string;
  name: string;
  request: string;
  path: string;
  real: string;
  contained: boolean;
  resolved: boolean;
};

function isLocationText(value: unknown): value is string {
  return typeof value === "string" && value !== "" && value.isWellFormed();
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

/** The path with every resolvable symbolic link replaced, keeping absent trailing segments literal. */
async function realPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    const code = errorCode(error);
    if (code !== "ENOENT" && code !== "ENOTDIR") throw new UnresolvableHostPath();
  }

  const parent = dirname(path);
  return parent === path ? path : join(await realPath(parent), basename(path));
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

function placeIdentity(name: string): string {
  return `place:${JSON.stringify(name)}`;
}

/** Record wanted host locations, ground one base, and settle containment before anything is read. */
export class LocatingConcept {
  readonly #requests = new Map<string, string>();
  #base: Base | undefined;
  readonly #places = new Map<string, PlaceRecord>();

  recordRequest({ name, path }: { name: string; path: string }) {
    if (!isLocationText(name) || !isLocationText(path)) throw new InvalidLocation();
    this.#requests.set(name, path);
    return { name, path };
  }

  async establishBase({ path }: { path: string }) {
    if (!isLocationText(path)) throw new InvalidLocation();
    const absolute = resolve(path);

    let status: Awaited<ReturnType<typeof lstat>>;
    try {
      status = await lstat(absolute);
    } catch (error) {
      const code = errorCode(error);
      if (code === "ENOENT" || code === "ENOTDIR") {
        return { status: "problem" as const, code: "LOCATION_MISSING", detail: LOCATION_MISSING };
      }
      return { status: "problem" as const, code: "LOCATION_UNRESOLVABLE", detail: LOCATION_UNRESOLVABLE };
    }
    if (status.isSymbolicLink() || !status.isDirectory()) {
      return { status: "problem" as const, code: "LOCATION_NOT_DIRECTORY", detail: LOCATION_NOT_DIRECTORY };
    }

    let real: string;
    try {
      real = await realPath(absolute);
    } catch {
      return { status: "problem" as const, code: "LOCATION_UNRESOLVABLE", detail: LOCATION_UNRESOLVABLE };
    }
    if (this.#base?.path === absolute) return { status: "grounded" as const, path: absolute, real: this.#base.real };

    this.#base = { path: absolute, real };
    this.#places.clear();
    return { status: "grounded" as const, path: absolute, real };
  }

  async inspectLocation({ name, path }: { name: string; path: string }) {
    const base = this.#base;
    if (base === undefined) throw new NotGrounded();
    if (!isLocationText(name) || !isLocationText(path)) throw new InvalidLocation();

    const existing = this.#places.get(name);
    if (existing !== undefined && existing.request === path) return this.#answer(existing);

    const absolute = resolve(base.path, path);
    let real: string;
    try {
      real = await realPath(absolute);
    } catch {
      return { status: "problem" as const, code: "LOCATION_UNRESOLVABLE", detail: LOCATION_UNRESOLVABLE };
    }
    const record: PlaceRecord = {
      place: placeIdentity(name),
      name,
      request: path,
      path: absolute,
      real,
      contained: contains(base.path, absolute),
      resolved: contains(base.real, real),
    };
    this.#places.set(name, record);
    return this.#answer(record);
  }

  #answer({ place, path, real, contained, resolved }: PlaceRecord) {
    return { status: "admitted" as const, place, path, real, contained, resolved };
  }

  #record(place: string): PlaceRecord | undefined {
    for (const record of this.#places.values()) if (record.place === place) return record;
    return undefined;
  }

  _requested({ name }: { name: string }): { path: string }[] {
    const path = this.#requests.get(name);
    return path === undefined ? [] : [{ path }];
  }

  _base(): { path: string; real: string }[] {
    return this.#base === undefined ? [] : [{ ...this.#base }];
  }

  _place({ place }: { place: string }): { name: string; path: string; real: string; contained: boolean; resolved: boolean }[] {
    const record = this.#record(place);
    return record === undefined
      ? []
      : [{ name: record.name, path: record.path, real: record.real, contained: record.contained, resolved: record.resolved }];
  }

  _named({ name }: { name: string }): { place: string }[] {
    const record = this.#places.get(name);
    return record === undefined ? [] : [{ place: record.place }];
  }

  _overlapping({ place, other }: { place: string; other: string }): { overlapping: boolean } {
    const left = this.#record(place);
    const right = this.#record(other);
    if (left === undefined || right === undefined) return { overlapping: false };
    return { overlapping: contains(left.real, right.real) || contains(right.real, left.real) };
  }
}
