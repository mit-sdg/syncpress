export type ParsedAddress = { address: string; segments: string[]; directory: boolean };

const encoder = new TextEncoder();
const literalAddressCharacter = /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/;
const forbiddenPathCharacter = /[\\/\u0000-\u001f\u007f]/u;

export function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

export function isPathSegment(segment: string): boolean {
  return (
    segment !== "" &&
    segment !== "." &&
    segment !== ".." &&
    segment.normalize("NFC") === segment &&
    !forbiddenPathCharacter.test(segment)
  );
}

export function pathSegments(path: unknown): string[] | undefined {
  if (!isText(path) || path === "" || path.startsWith("/")) return undefined;
  const segments = path.split("/");
  return segments.every(isPathSegment) ? segments : undefined;
}

export function encodeSegment(segment: string): string {
  let encoded = "";
  for (const character of segment) {
    if (literalAddressCharacter.test(character)) {
      encoded += character;
      continue;
    }
    for (const byte of encoder.encode(character)) {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return encoded;
}

function decodeSegment(segment: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return undefined;
  }
  return isPathSegment(decoded) && encodeSegment(decoded) === segment ? decoded : undefined;
}

export function parseAddress(address: unknown): ParsedAddress | undefined {
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
  if (!directory && segments.at(-1) === "index.html") return undefined;
  return { address, segments, directory };
}

export function isCanonicalAddress(address: unknown): address is string {
  return parseAddress(address) !== undefined;
}
