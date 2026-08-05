# Routing

## Purpose

Give each thing one dependable address in a shared space, prevent two things
from using the same address, and project canonical addresses into site URLs.

## Principle

Ada gives one note the address `/notes/design/`. Giving another note that address
is refused, so the first note keeps it. Giving the first note the same address
again changes nothing, while moving it to a free address keeps the note's claim
identity. Changing the public base from `/` to `/library/` changes the URLs
people use but not who owns either address. Releasing an address makes it free
for someone else. Malformed requests leave every existing claim untouched.
Configuring the origin `https://notes.example/` then makes the rebased
`/notes/design/` address available as
`https://notes.example/library/notes/design/`; clearing the origin leaves the
relative URL unchanged.

## Text And Identities

Text is a well-formed Unicode string. An Owner is opaque Text supplied by the
caller; empty Text and punctuation have no special meaning. Actions refuse a
non-Text owner before inspecting their other inputs. Queries given a non-Text
lookup value answer no row.

Each owner identifies one stable Claim. The claim identity is an opaque,
collision-safe, deterministic encoding of the owner, not of its current address.
Moving, releasing and reclaiming therefore keep the same identity. Distinct
owners have distinct claim identities even when their text contains delimiters.

## Paths And Addresses

A Path is a platform-neutral logical path with one or more NFC-normalized Unicode
segments separated by `/`. A segment is nonempty, contains only Unicode scalar
values, is neither `.` nor `..`, and contains no slash, backslash, NUL, ASCII
control character, or DEL. A Path never starts or ends with `/` and has no empty
segment.

An Address is the canonical URI-path spelling of those same segments. It starts
with exactly one `/`, contains no query or fragment, and is either `/`, ends in
`/` as a directory address, or ends in a segment as a file address. A canonical
encoded segment leaves only ASCII letters, digits, and
`-._~!$&'()*+,;=:@` literal. Every other character is its UTF-8 bytes written as
uppercase `%HH`. Percent escapes for literal characters, lowercase escapes,
malformed UTF-8, raw non-ASCII characters, encoded separators, non-NFC text,
empty segments, and encoded `.` or `..` segments are not canonical.

The file-style address `/index.html`, and any file-style address ending in
`/index.html`, is not canonical. Its canonical address is the corresponding
directory address. Pure application computations share this grammar when they
derive addresses, project output paths, and rewrite references; Routing owns
only the mutable address space and its projections.

A Base is a canonical directory Address. The initial base is `/`. A base changes
only URL projection and never changes an Address or a Claim. `_url` accepts any
well-formed site-absolute target beginning with one `/`, including its exact query
or fragment suffix, and prefixes a non-root base. It deliberately does not
normalize or validate an authored target as a claimed Address. For example, base
`/library/` projects `/notes/?print=1#top` to
`/library/notes/?print=1#top`. A relative, fragment-only, scheme-bearing, or
network-path target has no `_url` row.

An Origin is optional and initially absent. A present Origin is a canonical
HTTP or HTTPS URL origin, with an optional one trailing `/` accepted on input
and removed in stored output. Its URL serialization must otherwise be exactly
its input: it has no user information, path, query, fragment, noncanonical host
case, or default port. `reorigin` changes only origin projection and never
changes a Base, Address, or Claim. Omitting its `origin` input, or giving it
`undefined`, clears the configured Origin. `_absolute` answers only when an
Origin is configured and its input is a canonical Address. Its URL is the
Origin followed by that Address's current Base projection. It accepts no query
or fragment and does not require the Address to be claimed.

## State

```state
a Base Address, initially /

an optional Origin, initially absent

a set of Claims with
  an owner Owner
  an address Address
```

At most one claim has an owner, and at most one claim has an address.

## Actions

```actions
rebase (base: Address) : return (base: Address, changed: Flag)
  where base is not a canonical directory Address
  then
    refuse INVALID_BASE "A base must be a canonical directory address."
  where base is canonical and equals the current base
  then
    return base and changed false
  where base is canonical and differs from the current base
  then
    set the base and return it with changed true

reorigin (origin: OptionalOrigin) : return (origin: OptionalOrigin, changed: Flag)
  where a present origin is not a canonical HTTP or HTTPS origin
  then
    refuse INVALID_ORIGIN "An origin must be a canonical HTTP or HTTPS origin."
  where origin equals the current origin
  then
    return origin and changed false
  where origin differs from the current origin
  then
    set the origin and return it with changed true

claim (owner: Owner, address: Address) : return (claim: Claim, address: Address, changed: Flag)
  where owner is not Text
  then
    refuse INVALID_OWNER "An owner must be a well-formed text identity."
  where owner is Text and address is not canonical
  then
    refuse INVALID_ADDRESS "An address must be a canonical site-absolute path."
  where another owner claims address
  then
    refuse ADDRESS_TAKEN "Another owner has already claimed this address."
  where owner already claims address
  then
    return that claim and address with changed false
  where address is free
  then
    replace any other claim for owner, preserving its identity
    add the claim at address and return it with changed true

release (owner: Owner) : return (claim: Claim, address: Address)
  where owner is not Text
  then
    refuse INVALID_OWNER "An owner must be a well-formed text identity."
  where owner has no claim
  then
    refuse NOT_CLAIMED "This owner has claimed no address."
  where owner has a claim
  then
    remove and return it with its address
```

Validation and collision checks happen before state changes. In particular, a
failed move leaves the owner's former address claimed, a failed rebase leaves the
former base active, and a second owner never displaces the incumbent.

## Queries

```queries
_address (owner: Owner) : optional (address: Address, url: Url)
_owner (address: Address) : optional (owner: Owner)
_url (target: Address) : optional (url: Url)
_absolute (address: Address) : optional (url: Url)
_claims () : many (owner: Owner, address: Address)
```

`_owner` requires the exact canonical spelling and answers no row for an
unclaimed address. `_address` answers the current URL using the current base, so
rebasing is visible immediately without rewriting claims.
`_absolute` answers one row exactly when its canonical Address and a configured
Origin can form a canonical absolute URL, and otherwise no row.
`_claims` answers all claims in ascending UTF-8 byte order of canonical address,
independent of claim arrival order.

Routing owns this address grammar, unique claims, and base and origin projection. It does not
decide what an owner means, which things deserve addresses, whether an address
should be reachable, or what is stored at the corresponding path.
