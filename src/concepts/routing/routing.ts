export class InvalidBase extends Error {}
export class InvalidAddress extends Error {}
export class AddressTaken extends Error {}
export class NotClaimed extends Error {}

type Claim = { claim: string; owner: string; address: string };

function isWellFormedBase(base: string): boolean {
  return /^\/(?:[^/]+\/)*$/.test(base) && base.split("/").every((segment) => segment !== "." && segment !== "..");
}

function isWellFormedAddress(address: string): boolean {
  return /^\/(?:[^/]+\/)*(?:[^/]+(?:\.[^/]+)?)?$/.test(address) && !address.includes("//") && address.split("/").every((segment) => segment !== "." && segment !== "..");
}

function derive(path: string): string {
  const withoutExtension = path.replace(/\.[^/.]+$/, "");
  const segments = withoutExtension.split("/").filter(Boolean);
  if (segments.at(-1) === "index") segments.pop();
  return segments.length === 0 ? "/" : `/${segments.join("/")}/`;
}

function fileFor(address: string): string {
  return address.endsWith("/") ? `${address.slice(1)}index.html` : address.slice(1);
}

function locate(path: string): string {
  if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
  if (path === "index.html") return "/";
  return `/${path}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Maintain a unique address space and its deployment-base projection. */
export class RoutingConcept {
  #base = "/";
  readonly #claimsByOwner = new Map<string, Claim>();
  readonly #claimsByAddress = new Map<string, Claim>();

  rebase({ base }: { base: string }) {
    if (!isWellFormedBase(base)) throw new InvalidBase();
    const changed = this.#base !== base;
    this.#base = base;
    return { base, changed };
  }

  claim({ owner, address }: { owner: string; address: string }) {
    if (!isWellFormedAddress(address)) throw new InvalidAddress();
    const incumbent = this.#claimsByAddress.get(address);
    if (incumbent !== undefined && incumbent.owner !== owner) throw new AddressTaken();
    const current = this.#claimsByOwner.get(owner);
    if (current?.address === address) return { claim: current.claim, address, changed: false };

    if (current !== undefined) this.#claimsByAddress.delete(current.address);
    const claim = current?.claim ?? `claim:${owner}`;
    const record = { claim, owner, address };
    this.#claimsByOwner.set(owner, record);
    this.#claimsByAddress.set(address, record);
    return { claim, address, changed: true };
  }

  release({ owner }: { owner: string }) {
    const claim = this.#claimsByOwner.get(owner);
    if (claim === undefined) throw new NotClaimed();
    this.#claimsByOwner.delete(owner);
    this.#claimsByAddress.delete(claim.address);
    return { claim: claim.claim, address: claim.address };
  }

  _derive({ path }: { path: string }) {
    return { address: derive(path) };
  }

  _address({ owner }: { owner: string }): { address: string; url: string }[] {
    const claim = this.#claimsByOwner.get(owner);
    return claim === undefined ? [] : [{ address: claim.address, url: this._url({ target: claim.address }).url }];
  }

  _owner({ address }: { address: string }): { owner: string }[] {
    const claim = this.#claimsByAddress.get(address);
    return claim === undefined ? [] : [{ owner: claim.owner }];
  }

  _file({ address }: { address: string }) {
    return { path: fileFor(address) };
  }

  _locate({ path }: { path: string }) {
    return { address: locate(path) };
  }

  _url({ target }: { target: string }) {
    return { url: this.#base === "/" ? target : `${this.#base.slice(0, -1)}${target}` };
  }

  _classify({ target }: { target: string }) {
    const kind = target.startsWith("#") ? "fragment" : target.startsWith("/") ? "absolute" : /^[a-z][a-z\d+.-]*:/i.test(target) || target.startsWith("//") ? "external" : "relative";
    return { kind };
  }

  _claims(): { owner: string; address: string }[] {
    return [...this.#claimsByOwner.values()]
      .sort((left, right) => compareText(left.address, right.address))
      .map(({ owner, address }) => ({ owner, address }));
  }
}
