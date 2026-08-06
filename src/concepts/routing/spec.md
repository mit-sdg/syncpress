# Routing

## Purpose

Give each thing one dependable canonical address in a shared space, so two
things cannot silently use the same address.

## Principle

Ada gives one note the address `/notes/design/`. Giving another note that address
is refused, so the first note keeps it. Giving the first note the same address
again changes nothing, while moving it to a free address keeps the note's claim
identity. Releasing an address makes it free for someone else. Malformed
requests leave every existing claim untouched.

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
derive addresses, project URLs and output paths, and rewrite references;
Routing owns only the mutable claimed address space.

## State

```state
a set of Claims with
  an owner Owner
  an address Address
```

At most one claim has an owner, and at most one claim has an address.

## Actions

```actions
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
failed move leaves the owner's former address claimed, and a second owner never
displaces the incumbent.

## Queries

```queries
_address (owner: Owner) : optional (address: Address)
_owner (address: Address) : optional (owner: Owner)
_claims () : many (owner: Owner, address: Address)
```

`_owner` requires the exact canonical spelling and answers no row for an
unclaimed address. `_address` answers the current canonical claim.
`_claims` answers all claims in ascending UTF-8 byte order of canonical address,
independent of claim arrival order.

Routing owns this address grammar and unique claims. It does not
decide what an owner means, which things deserve addresses, whether an address
should be reachable, or what is stored at the corresponding path.
