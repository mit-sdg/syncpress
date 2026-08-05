const INVALID_OWNER = "An owner must be a well-formed text identity.";
const INVALID_BASE = "A base must be a canonical directory address.";
const INVALID_ORIGIN = "An origin must be a canonical HTTP or HTTPS origin.";
const INVALID_ADDRESS = "An address must be a canonical site-absolute path.";
const ADDRESS_TAKEN = "Another owner has already claimed this address.";
const NOT_CLAIMED = "This owner has claimed no address.";

export class InvalidOwner extends Error {
  constructor() {
    super(INVALID_OWNER);
    this.name = "InvalidOwner";
  }
}

export class InvalidBase extends Error {
  constructor() {
    super(INVALID_BASE);
    this.name = "InvalidBase";
  }
}

export class InvalidOrigin extends Error {
  constructor() {
    super(INVALID_ORIGIN);
    this.name = "InvalidOrigin";
  }
}

export class InvalidAddress extends Error {
  constructor() {
    super(INVALID_ADDRESS);
    this.name = "InvalidAddress";
  }
}

export class AddressTaken extends Error {
  constructor() {
    super(ADDRESS_TAKEN);
    this.name = "AddressTaken";
  }
}

export class NotClaimed extends Error {
  constructor() {
    super(NOT_CLAIMED);
    this.name = "NotClaimed";
  }
}

type Claim = { claim: string; owner: string; address: string };
type ParsedAddress = { address: string; segments: string[]; directory: boolean };
const encoder = new TextEncoder();
const literalAddressCharacter = /^[A-Za-z0-9._~!$&'()*+,;=:@-]$/;
const forbiddenSegmentCharacter = /[\\/\u0000-\u001f\u007f]/u;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isPathSegment(value: unknown): value is string {
  return isText(value) && value !== "" && value !== "." && value !== ".." &&
    value.normalize("NFC") === value && !forbiddenSegmentCharacter.test(value);
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

function requireOwner(value: unknown): asserts value is string {
  if (!isText(value)) throw new InvalidOwner();
}
function project(base: string, target: unknown): string | undefined {
  if (!isText(target) || !target.startsWith("/") || target.startsWith("//")) return undefined;
  return base === "/" ? target : `${base.slice(0, -1)}${target}`;
}

function parseOrigin(origin: unknown): string | undefined {
  if (origin === undefined) return undefined;
  if (!isText(origin)) throw new InvalidOrigin();
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new InvalidOrigin();
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.origin !== origin.replace(/\/$/, "")) {
    throw new InvalidOrigin();
  }
  return parsed.origin;
}

function compareText(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function claimIdentity(owner: string): string {
  return `claim:${JSON.stringify(owner)}`;
}

/** Maintain one canonical hierarchical address space and project it below a base. */
export class RoutingConcept {
  #base = "/";
  #origin: string | undefined;
  readonly #claimsByOwner = new Map<string, Claim>();
  readonly #claimsByAddress = new Map<string, Claim>();

  rebase({ base }: { base: unknown }) {
    const parsed = parseAddress(base);
    if (parsed === undefined || !parsed.directory) throw new InvalidBase();
    const changed = this.#base !== parsed.address;
    this.#base = parsed.address;
    return { base: parsed.address, changed };
  }

  reorigin({ origin }: { origin?: unknown }) {
    const next = parseOrigin(origin);
    const changed = this.#origin !== next;
    this.#origin = next;
    return { origin: next, changed };
  }

  claim({ owner, address }: { owner: unknown; address: unknown }) {
    requireOwner(owner);
    const parsed = parseAddress(address);
    if (parsed === undefined) throw new InvalidAddress();

    const incumbent = this.#claimsByAddress.get(parsed.address);
    if (incumbent !== undefined && incumbent.owner !== owner) throw new AddressTaken();

    const current = this.#claimsByOwner.get(owner);
    if (current?.address === parsed.address) {
      return { claim: current.claim, address: parsed.address, changed: false };
    }

    if (current !== undefined) this.#claimsByAddress.delete(current.address);
    const claim = current?.claim ?? claimIdentity(owner);
    const record = { claim, owner, address: parsed.address };
    this.#claimsByOwner.set(owner, record);
    this.#claimsByAddress.set(parsed.address, record);
    return { claim, address: parsed.address, changed: true };
  }

  release({ owner }: { owner: unknown }) {
    requireOwner(owner);
    const claim = this.#claimsByOwner.get(owner);
    if (claim === undefined) throw new NotClaimed();
    this.#claimsByOwner.delete(owner);
    this.#claimsByAddress.delete(claim.address);
    return { claim: claim.claim, address: claim.address };
  }

  _address({ owner }: { owner: unknown }): { address: string; url: string }[] {
    if (!isText(owner)) return [];
    const claim = this.#claimsByOwner.get(owner);
    return claim === undefined ? [] : [{ address: claim.address, url: project(this.#base, claim.address)! }];
  }

  _owner({ address }: { address: string }): { owner: string }[] {
    const parsed = parseAddress(address);
    if (parsed === undefined) return [];
    const claim = this.#claimsByAddress.get(parsed.address);
    return claim === undefined ? [] : [{ owner: claim.owner }];
  }

  _url({ target }: { target: unknown }): { url: string }[] {
    const url = project(this.#base, target);
    return url === undefined ? [] : [{ url }];
  }

  _absolute({ address }: { address: unknown }): { url: string }[] {
    const parsed = parseAddress(address);
    if (this.#origin === undefined || parsed === undefined) return [];
    return [{ url: `${this.#origin}${project(this.#base, parsed.address)!}` }];
  }

  _claims(): { owner: string; address: string }[] {
    return [...this.#claimsByOwner.values()]
      .sort((left, right) => compareText(left.address, right.address))
      .map(({ owner, address }) => ({ owner, address }));
  }
}
