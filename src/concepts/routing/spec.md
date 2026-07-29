# Routing

## Purpose

Give each owner one address in a shared space and refuse conflicting claims, so
every published address has one unambiguous owner.

## Principle

Ada derives `/posts/compiler-design/` from
`posts/compiler-design/index.md` and claims it for a page. A second page cannot
claim it. A page may instead claim `/404.html`. The route maps to its output
file, and rebasing from `/` to `/notes/` changes URLs without changing claims.
Malformed bases and addresses are refused.

## State

```state
a Base Address

a set of Claims with
  an owner Owner
  an address Address
```

## Actions

```actions
rebase (base: Address) : return (base: Address, changed: Flag)
  where base is malformed
  then
    refuse INVALID_BASE "A base must begin and end with a slash."
  where base is well formed
  then
    set the base

claim (owner: Owner, address: Address) : return (claim: Claim, address: Address, changed: Flag)
  where address is malformed
  then
    refuse INVALID_ADDRESS "An address must begin with a slash and name only path segments."
  where another owner claims address
  then
    refuse ADDRESS_TAKEN "Another owner has already claimed this address."
  where address is available
  then
    give it to owner

release (owner: Owner) : return (claim: Claim, address: Address)
  where owner has no claim
  then
    refuse NOT_CLAIMED "This owner has claimed no address."
  where owner has a claim
  then
    remove it
```

## Queries

```queries
_derive (path: Path) : one (address: Address)
_address (owner: Owner) : optional (address: Address, url: Url)
_owner (address: Address) : optional (owner: Owner)
_file (address: Address) : one (path: Path)
_locate (path: Path) : one (address: Address)
_url (target: Address) : one (url: Url)
_classify (target: Address) : one (kind: AddressKind)
_claims () : many (owner: Owner, address: Address)
```

Routing owns address syntax. It does not decide what an owner is or whether an
address should be emitted.
