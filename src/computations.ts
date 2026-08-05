import picomatch from "picomatch";
import { basename, dirname, join, resolve as resolveNative } from "node:path";

type AddressKind = "relative" | "absolute" | "external" | "fragment";
type ParsedAddress = { address: string; segments: string[]; directory: boolean };
type PathStatus = "canonical" | "outside" | "invalid";

const encoder = new TextEncoder();
const forbiddenSegmentCharacter = /[\\/\u0000-\u001f\u007f]/u;
const literalAddressCharacter = /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/;
const scheme = /^[a-z][a-z\d+.-]*:/i;
const literalReferenceCharacter = /^[A-Za-z0-9._~!$&'()*+,;=:@/?#-]$/;
const hexadecimalDigit = /^[A-Fa-f0-9]$/;
const unsafeUnicodeReferenceCharacter = /[\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}]/u;
const globOptions = {
  basename: false,
  contains: false,
  debug: true,
  dot: true,
  fastpaths: false,
  keepQuotes: false,
  nobrace: false,
  nobracket: false,
  nocase: false,
  noextglob: false,
  noglobstar: false,
  nonegate: true,
  posix: true,
  strictBrackets: true,
  strictSlashes: true,
  windows: false,
} as const;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isPathSegment(value: unknown): value is string {
  return isText(value) && value !== "" && value !== "." && value !== ".." &&
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

function pathSegments(path: unknown): string[] | undefined {
  return typeof path === "string" && pathStatus(path) === "canonical" ? path.split("/") : undefined;
}

function relativePath(path: unknown, prefix: unknown): string | undefined {
  if (typeof path !== "string" || pathStatus(path) !== "canonical" || !isDirectoryPath(prefix)) return undefined;
  if (prefix === "") return path;
  const beginning = `${prefix}/`;
  return path.startsWith(beginning) ? path.slice(beginning.length) : undefined;
}

function joinPath(prefix: unknown, name: unknown): string | undefined {
  return isDirectoryPath(prefix) && isPathSegment(name) ? (prefix === "" ? name : `${prefix}/${name}`) : undefined;
}

function directoryPath(path: unknown): string | undefined {
  if (typeof path !== "string" || pathStatus(path) !== "canonical") return undefined;
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
}

function pathName(path: unknown): string | undefined {
  return typeof path === "string" && pathStatus(path) === "canonical"
    ? path.slice(path.lastIndexOf("/") + 1)
    : undefined;
}

function encodeSegment(segment: string): string {
  let encoded = "";
  for (const character of segment) {
    if (literalAddressCharacter.test(character)) encoded += character;
    else for (const byte of encoder.encode(character)) encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return encoded;
}

function decodeSegment(segment: string): string | undefined {
  try {
    const decoded = decodeURIComponent(segment);
    return isPathSegment(decoded) && encodeSegment(decoded) === segment ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function parseAddress(address: unknown): ParsedAddress | undefined {
  if (!isText(address) || !address.startsWith("/") || address.startsWith("//")) return undefined;
  if (address === "/") return { address, segments: [], directory: true };
  const directory = address.endsWith("/");
  const body = address.slice(1, directory ? -1 : address.length);
  if (body === "") return undefined;
  const segments: string[] = [];
  for (const encoded of body.split("/")) {
    const decoded = decodeSegment(encoded);
    if (decoded === undefined) return undefined;
    segments.push(decoded);
  }
  return !directory && segments.at(-1) === "index.html" ? undefined : { address, segments, directory };
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return name;
  const stem = name.slice(0, dot);
  return isPathSegment(stem) ? stem : name;
}

function deriveAddress(path: unknown): string | undefined {
  const segments = pathSegments(path);
  if (segments === undefined) return undefined;
  const leaf = stripExtension(segments.at(-1)!);
  if (leaf === "index") segments.pop();
  else segments[segments.length - 1] = leaf;
  return segments.length === 0 ? "/" : `/${segments.map(encodeSegment).join("/")}/`;
}

function addressOutputPath(address: unknown): string | undefined {
  const parsed = parseAddress(address);
  if (parsed === undefined) return undefined;
  const segments = [...parsed.segments];
  if (parsed.directory) segments.push("index.html");
  return segments.join("/");
}

function outputPathAddress(path: unknown): string | undefined {
  const segments = pathSegments(path);
  if (segments === undefined) return undefined;
  const directory = segments.at(-1) === "index.html";
  if (directory) segments.pop();
  if (segments.length === 0) return "/";
  return `/${segments.map(encodeSegment).join("/")}${directory ? "/" : ""}`;
}

function targetKind(target: unknown): AddressKind | undefined {
  if (!isText(target)) return undefined;
  if (target.startsWith("#")) return "fragment";
  if (target.startsWith("//") || scheme.test(target)) return "external";
  if (target.startsWith("/")) return "absolute";
  return "relative";
}

function hasSafeReferenceSpelling(target: string): boolean {
  for (let index = 0; index < target.length; index += 1) {
    const character = target[index]!;
    if (character === "%") {
      if (!hexadecimalDigit.test(target[index + 1] ?? "") || !hexadecimalDigit.test(target[index + 2] ?? "")) return false;
      index += 2;
      continue;
    }
    const codePoint = target.codePointAt(index)!;
    const scalar = String.fromCodePoint(codePoint);
    if (codePoint <= 0x7f ? !literalReferenceCharacter.test(scalar) : unsafeUnicodeReferenceCharacter.test(scalar)) return false;
    if (codePoint > 0xffff) index += 1;
  }
  return true;
}

function suffixStart(target: string): number {
  const query = target.indexOf("?");
  const fragment = target.indexOf("#");
  if (query === -1) return fragment;
  if (fragment === -1) return query;
  return Math.min(query, fragment);
}

function isSafeRelativeReference(target: unknown): target is string {
  if (!isText(target) || targetKind(target) !== "relative" || !hasSafeReferenceSpelling(target)) return false;
  const fragment = target.indexOf("#");
  if (fragment !== -1 && target.indexOf("#", fragment + 1) !== -1) return false;
  const start = suffixStart(target);
  const path = start === -1 ? target : target.slice(0, start);
  const slash = path.indexOf("/");
  return !path.slice(0, slash === -1 ? path.length : slash).includes(":");
}

function retargetReference(replacement: unknown, original: unknown): string | undefined {
  const parsed = parseAddress(replacement);
  if (parsed === undefined || !isSafeRelativeReference(original)) return undefined;
  const start = suffixStart(original);
  return start === -1 ? parsed.address : `${parsed.address}${original.slice(start)}`;
}

function compileGlob(pattern: string): (path: string) => boolean {
  const matcher = picomatch(pattern, globOptions, true);
  if (matcher.state.quotes !== 0) throw new SyntaxError("Unterminated quoted run");
  return matcher;
}

const optional = (value: string | undefined): string | null => value ?? null;

export function publicationTransactionPrefix(destination: unknown): string | null {
  if (typeof destination !== "string" || destination === "" || !destination.isWellFormed()) return null;
  const resolved = resolveNative(destination);
  if (dirname(resolved) === resolved) return null;
  return join(dirname(resolved), `.${basename(resolved)}.emitting-`);
}

/** Pure calculations available to portable Syncpress composition. */
export const syncpressComputations = {
  isTextValue: ({ value }: { value: unknown }) => typeof value === "string" && value.isWellFormed(),
  isAbsentValue: ({ value }: { value: unknown }) => value === null || value === undefined,
  publicationTransactionPrefix: ({ destination }: { destination: unknown }) => publicationTransactionPrefix(destination),
  deriveAddress: ({ path }: { path: unknown }) => optional(deriveAddress(path)),
  addressOutputPath: ({ address }: { address: unknown }) => optional(addressOutputPath(address)),
  outputPathAddress: ({ path }: { path: unknown }) => optional(outputPathAddress(path)),
  retargetReference: ({ replacement, original }: { replacement: unknown; original: unknown }) =>
    optional(retargetReference(replacement, original)),
  targetHasKind: ({ target, kind }: { target: unknown; kind: AddressKind }) => targetKind(target) === kind,
  relativePath: ({ path, prefix }: { path: unknown; prefix: unknown }) => optional(relativePath(path, prefix)),
  joinPath: ({ prefix, name }: { prefix: unknown; name: unknown }) => optional(joinPath(prefix, name)),
  directoryPath: ({ path }: { path: unknown }) => optional(directoryPath(path)),
  pathName: ({ path }: { path: unknown }) => optional(pathName(path)),
  patternHasResult: ({ pattern, path, matched }: { pattern: unknown; path: unknown; matched: unknown }) => {
    if (typeof pattern !== "string" || typeof path !== "string" || typeof matched !== "boolean") return false;
    try {
      return compileGlob(pattern)(path) === matched;
    } catch {
      return false;
    }
  },
};
