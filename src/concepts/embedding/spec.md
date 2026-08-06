# Responsive HTML Image Embedding

## Purpose

Build one safe HTML `picture` element from a required original image and any
derived versions, so a browser can choose a suitable format and width.

## Principle

Ada publishes an image by giving its original address, format, size, alternative
text, and how many optimized versions will follow. The original is always the
fallback. If no optimized versions are promised, usable markup is ready at once.
Otherwise markup appears only when exactly the promised number of distinct
versions has arrived. Versions may arrive in any order: formats follow their
stated order, widths rise within each format, and the original format is always
last on the `img`. Repeating an identical version reports no change and never
announces completion twice. A correction may replace that address before
completion; after completion, corrections and extra versions are refused, so
published markup cannot change silently. Repeating the same declaration keeps
its versions, while changing the declaration starts it again. Withdrawing it
removes the declaration and every version.

## Types

```types
Subject = Text
  A well-formed Unicode string identifying an embedding.

Address = Text
  A safe site-absolute address for one image candidate.

Format = "avif" | "gif" | "heif" | "jpeg" | "jxl" | "png" | "tiff" | "webp"

Attributes = Map<Text, Text>
  The approved authored image attributes retained by an embedding.
```

Text is a well-formed Unicode string. Alternative text and attribute names and
values must additionally contain no null character. Intrinsic dimensions and
offer widths are positive safe integers, and an offer width does not exceed its
embedding's intrinsic width. Expected counts and orders are nonnegative safe
integers; negative zero is normalized to zero. The expected count names derived
offers only and does not include the declared original.

An Address is a nonempty site-absolute address beginning with one `/`. It has no
raw ASCII whitespace, control character, comma, quote, angle bracket, backtick,
or backslash, and every percent sign begins a two-hex-digit escape. These rules
make one address exactly one HTML `srcset` candidate. Callers percent-encode any
otherwise forbidden address character before declaring or offering it.

Formats are lowercase canonical names with these exact media types:

| Format | Media type |
| --- | --- |
| `avif` | `image/avif` |
| `gif` | `image/gif` |
| `heif` | `image/heif` |
| `jpeg` | `image/jpeg` |
| `jxl` | `image/jxl` |
| `png` | `image/png` |
| `tiff` | `image/tiff` |
| `webp` | `image/webp` |

`attributes` is a plain or null-prototype record of own, enumerable text data
properties. The declaration copies `class`, `crossorigin`, `dir`,
`fetchpriority`, `id`, `lang`, `referrerpolicy`, `role`, `sizes`, `title`,
`aria-*`, and `data-*`. Preserved names are lowercase. Enumerated attributes
accept only their standard lowercase values. Accessors, non-enumerable
properties, symbols, proxies, non-plain records, and non-text or null-containing
names or values make the record malformed and are refused. Event handlers,
`style`, invalid enumerated values, and every other safe text attribute are
omitted.

The concept intentionally replaces authored `src`, `srcset`, `width`, `height`,
`alt`, `loading`, and `decoding`. The output uses the declared original and
dimensions, escaped alternative text, `loading="lazy"`, and
`decoding="async"`. Preserved attributes follow those owned attributes in
ascending UTF-8 name order. Every attribute value and address is HTML-escaped
during serialization. A preserved `sizes` value is also copied to every
generated `source`, so all format groups use the same responsive width rule.

## State

```state
a set of Embeddings with
  a subject Subject
  an alternative Text
  a width PositiveInteger
  a height PositiveInteger
  an expects NonnegativeInteger
  an original Address
  an originalFormat Format
  attributes Attributes

a set of Offers with
  an embedding Embedding
  an address Address
  a format Format
  a width PositiveInteger
  an order NonnegativeInteger
```

## Actions

```actions
declare (subject: Subject, alternative: Text, width: PositiveInteger, height: PositiveInteger, expects: NonnegativeInteger, original: Address, originalFormat: Format, attributes: Attributes) : return (embedding: Embedding, changed: Flag, completed: Flag)
  where subject is not Text, or alternative is not serializable Text
  then
    refuse INVALID_TEXT "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."
  where width or height is not a positive safe integer
  then
    refuse INVALID_DIMENSION "Intrinsic width and height must be positive safe integers."
  where expects is not a nonnegative safe integer
  then
    refuse INVALID_COUNT "Expected offer count must be a nonnegative safe integer."
  where original is not an Address
  then
    refuse INVALID_ADDRESS "Image addresses must be safe site-absolute srcset addresses."
  where originalFormat is not a canonical Format
  then
    refuse INVALID_FORMAT "Image format must be one of the canonical supported formats."
  where attributes is not an approved attribute record
  then
    refuse INVALID_ATTRIBUTES "Image attributes must be a plain record of text attributes."
  where the same declaration already exists
  then
    retain its offers and return embedding, changed false, and completed false
  where the declaration is new or different
  then
    replace any embedding for subject and all its offers
    add the supplied declaration
    return embedding, changed true, and completed true exactly when expects is zero

offer (embedding: Embedding, address: Address, format: Format, width: PositiveInteger, order: NonnegativeInteger) : return (offer: Offer, embedding: Embedding, arrived: Number, changed: Flag, completed: Flag)
  where embedding is not Text
  then
    refuse INVALID_TEXT "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."
  where embedding is not present
  then
    refuse EMBEDDING_NOT_FOUND "There is no such embedding."
  where address is not an Address
  then
    refuse INVALID_ADDRESS "Image addresses must be safe site-absolute srcset addresses."
  where format is not a canonical Format
  then
    refuse INVALID_FORMAT "Image format must be one of the canonical supported formats."
  where width is not a positive safe integer, or exceeds the intrinsic width
  then
    refuse INVALID_WIDTH "Offer width must be a positive safe integer no greater than the intrinsic width."
  where order is not a nonnegative safe integer
  then
    refuse INVALID_ORDER "Offer order must be a nonnegative safe integer."
  where this address already has the same format, width, and order
  then
    return its offer and arrived count, changed false, and completed false
  where the embedding is complete and the offer is new or changed
  then
    refuse EMBEDDING_COMPLETE "A completed embedding cannot accept a changed or additional offer."
  where address is the original address, or format and width duplicate another candidate
  then
    refuse OFFER_CONFLICT "An address or format-width candidate is already used by this embedding."
  where this address has different facts and the embedding is incomplete
  then
    replace that offer while retaining its identity
    return offer and the unchanged arrived count, changed true, and completed false
  where this is a new distinct candidate and the embedding is incomplete
  then
    add it and return offer, the new arrived count, changed true, and whether this offer completed the embedding

withdraw (subject: Subject) : return (embedding: Embedding, count: Number)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character."
  where subject has no embedding
  then
    refuse EMBEDDING_NOT_FOUND "There is no such embedding."
  where subject has an embedding
  then
    remove it and all its offers
    return embedding and how many derived offers were removed
```

## Queries

```queries
_embedding (embedding: Embedding) : optional (subject: Subject, original: Address, originalFormat: Format, expects: NonnegativeInteger, arrived: NonnegativeInteger, complete: Flag)
  Returns no row for an unknown or non-Text Embedding. `complete` is the
  current completion level.

_for (subject: Subject) : optional (embedding: Embedding, original: Address, originalFormat: Format, expects: NonnegativeInteger, arrived: NonnegativeInteger, complete: Flag)
  Returns no row for an unknown or non-Text Subject. `complete` is the current
  completion level.

_offers (embedding: Embedding) : many (offer: Offer, address: Address, format: Format, width: PositiveInteger, order: NonnegativeInteger)
  Returns no rows for an unknown or non-Text Embedding. Lists derived offers by
  `order`, then `format`, `width`, and `address`.

_markup (embedding: Embedding) : optional (markup: Text)
  Returns no row for an unknown, non-Text, or incomplete Embedding. For a
  complete Embedding, returns one `picture` element. The declared original is
  the `img` `src` and reserves a candidate at its intrinsic width in its
  declared format. Derived candidates in that format at other widths join the
  original in `srcset`; other format groups become `source` elements. Groups
  use their least offered order, then format, while the original-format
  fallback is always last. Widths ascend within each group, followed by order
  and address as deterministic tie-breakers.
```

## Contracts

```contracts
contract embedding-keys
  At most one Embedding exists per Subject, one Offer per Embedding and Address,
  and one candidate per Embedding, Format, and width.

contract stable-identities on declare, offer, withdraw
  An Embedding identity is determined by its Subject, and an Offer identity by
  its Embedding and Address. Replacing or later recreating either key preserves
  its opaque identity.
```
