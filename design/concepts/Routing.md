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

The concept retains this value vocabulary and its constraints:

`Owner = Text` An opaque Text identity supplied by the caller. Empty text and punctuation have no special meaning.

`Path = Text` A platform-neutral logical path with one or more NFC-normalized Unicode segments separated by `/`. A segment is nonempty, contains only Unicode scalar values, is neither `.` nor `..`, and contains no slash, backslash, NUL, ASCII control character, or DEL. A Path has no leading, trailing, or repeated `/`.

`Address = Text` A canonical URI-path spelling in the same segment grammar. It starts with exactly one `/`, has no query or fragment, and is `/`, a directory address ending in `/`, or a file address ending in a segment. An encoded segment leaves only ASCII letters, digits, and `-._~!$&'()*+,;=:@` literal; every other character is represented by its UTF-8 bytes as uppercase `%HH`. Percent escapes for literal characters, lowercase escapes, malformed UTF-8, raw non-ASCII characters, encoded separators, non-NFC text, empty segments, and encoded `.` or `..` segments are not canonical. `/index.html` and every file address ending in `/index.html` are not canonical; the corresponding directory address is canonical.

## Types

```types
```

## State

```state
a set of Claims with
  an owner Owner
  an address Address

Rule: stable-claim-identity on claim, release: Each Owner determines one collision-safe Claim identity. Moving, releasing, or reclaiming an Owner does not change it, and distinct Owners have distinct identities.
```

## Actions

```actions
claim(owner: Owner, address: Address) : return (claim: Claim, address: Address, changed: Flag)
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
    produce that claim and address with changed false
    return claim, address, changed
  where address is free
  then
    replace any other claim for owner, preserving its identity
    add the claim at address and return it with changed true
    return claim, address, changed

release(owner: Owner) : return (claim: Claim, address: Address)
  where owner is not Text
  then
    refuse INVALID_OWNER "An owner must be a well-formed text identity."
  where owner has no claim
  then
    refuse NOT_CLAIMED "This owner has claimed no address."
  where owner has a claim
  then
    remove and return it with its address
    return claim, address
```

## Queries

```queries
_address (owner: Owner) : optional (address: Address)
  Uses the exact Owner. Returns no row when the lookup is not well-formed Text
  or the Owner has no current claim. Routing query results are Text values and
  expose no mutable retained buffer.

_owner (address: Address) : optional (owner: Owner)
  Requires the exact canonical Address spelling. Returns no row when the lookup
  is not well-formed Text, is noncanonical, or has no claim.

_claims () : many (owner: Owner, address: Address)
  Returns every current claim in ascending UTF-8 byte order of canonical
  Address, independent of claim arrival order.
```
