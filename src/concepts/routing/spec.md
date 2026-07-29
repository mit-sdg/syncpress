# Routing

## Purpose

Give each thing one dependable address in a shared space, and prevent two things
from using the same address.

## Principle

Ada gives one note the address `/notes/design/`. Giving another note that address
is refused, so the first note keeps it. Giving the first note the same address
again changes nothing, while moving it to a free address keeps the note's claim
identity. The address points to `notes/design/index.html`; `/404.html` points to
`404.html`. Changing the public base from `/` to `/library/` changes the URLs
people use but not who owns either address. Releasing an address makes it free
for someone else. Retargeting `./design.md?print=1#section` to
`/notes/design/` gives `/notes/design/?print=1#section`. Malformed requests leave
every existing claim untouched.

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
directory address. This reservation makes address and output-path conversion a
bijection:

- `/` corresponds to `index.html`.
- `/notes/design/` corresponds to `notes/design/index.html`.
- `/404.html` corresponds to `404.html`.
- `/a%20b/` corresponds to `a b/index.html`.

`_file` performs the address-to-path direction. `_locate` performs the inverse,
turning a path ending in `index.html` into a directory address and every other
path into a file address. For every valid input, applying one and then the other
returns the original value exactly.

`_derive` turns a Path into a directory address. It first removes the final
extension from the last segment: the extension begins at the last `.` only when
the dot is neither first nor last and the remaining stem is still a valid
segment. It then removes a last segment equal to `index`. The remaining segments
are canonically encoded. Thus `index.md` derives `/`, while both `about.md` and
`about/index.md` derive `/about/` and will conflict if different owners claim
them. This derivation convention and the `index.html` path projection are
intrinsic parts of this hierarchical address scheme; callers decide whether and
when to use them.

A Base is a canonical directory Address. The initial base is `/`. A base changes
only URL projection and never changes an Address or a Claim. `_url` accepts any
well-formed site-absolute target beginning with one `/`, including its exact query
or fragment suffix, and prefixes a non-root base. It deliberately does not
normalize or validate an authored target as a claimed Address. For example, base
`/library/` projects `/notes/?print=1#top` to
`/library/notes/?print=1#top`. A relative, fragment-only, scheme-bearing, or
network-path target has no `_url` row.

`_classify` classifies Text lexically. Text beginning `#` is `fragment`; Text
beginning `//` or with an ASCII URI scheme is `external`; remaining Text beginning
`/` is `absolute`; and all other Text, including empty and query-only Text, is
`relative`. Network-path references are checked before site-absolute references.
Classification does not claim that a target is otherwise a valid URI.

`_retarget` replaces the path of a safe relative URI-reference while preserving
its suffix. `replacement` must be a canonical Address with no query or fragment.
`original` may have a relative path, an empty path, or be empty. It may be followed
by a query beginning `?`, a fragment beginning `#`, or both in that order. A
query-only original is accepted. A fragment-only original is not: it already
targets the current resource and does not need another path.

An accepted original uses URI-reference punctuation literally: ASCII letters,
digits, `-._~!$&'()*+,;=:@/?#`, and syntactically complete `%HH` escapes. Raw
non-ASCII Unicode scalar values are also accepted except control, format, and
separator characters. The first path segment may not contain a literal `:`, and
there may be at most one literal `#`. These rules reject ambiguous scheme-like
paths, whitespace, backslashes, double quotes, angle delimiters, malformed
percent escapes, and other unsafe punctuation. A site-absolute, fragment-only,
scheme-bearing, or network-path original answers no row. In particular, protocol
and network-path targets are never stripped and converted into local targets.

Only the substring beginning at the first `?` or `#` is copied; the original path
is discarded. The suffix is copied exactly as Text. Percent-escape case, escaped
versus literal spelling, repeated `?` characters, and Unicode normalization are
not decoded, normalized, or otherwise changed. Empty query and fragment markers
are preserved. When the original has no suffix, the result is exactly the
replacement Address. Retargeting does not apply the current Base.

## State

```state
a Base Address, initially /

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
_derive (path: Path) : optional (address: Address)
_address (owner: Owner) : optional (address: Address, url: Url)
_owner (address: Address) : optional (owner: Owner)
_file (address: Address) : optional (path: Path)
_locate (path: Path) : optional (address: Address)
_retarget (replacement: Address, original: Target) : optional (target: Target)
_url (target: Address) : optional (url: Url)
_classify (target: Address) : optional (kind: AddressKind)
_claims () : many (owner: Owner, address: Address)
```

`_derive`, `_file`, and `_locate` answer no row for a noncanonical input.
`_owner` likewise requires the exact canonical spelling and answers no row for an
unclaimed address. `_address` answers the current URL using the current base, so
rebasing is visible immediately without rewriting claims. `_classify` has exactly
one row for every Text target and no row for a non-Text value. `_retarget` answers
one row exactly for the accepted pair described above and otherwise no row.
`_claims` answers all claims in ascending UTF-8 byte order of canonical address,
independent of claim arrival order.

Routing owns this address grammar, unique claims, path projection, reference
classification and retargeting, and base projection. It does not decide what an
owner means, which things deserve addresses, whether an address should be
reachable, or what is stored at the corresponding path.
