# Transcoding

## Purpose

Make smaller copies of a raster image in common formats without changing its
shape or losing its motion.

## Principle

Ada admits a readable image and receives the size a person sees, including its
EXIF orientation. She asks for several widths and formats. Invalid settings are
refused, larger widths are not upscaled, duplicate widths are removed, and the
remaining widths are ordered from smallest to largest. Formats stay in their
declared order, except that the source format is always last and always includes
an exact copy of the source as a fallback. Animated output is made only in a
format that preserves every frame, delay, and loop. Each result reports its
actual dimensions, format, media type, extension, a stable suggested filename,
whether it is the exact source fallback, exact bytes, and a SHA-256 digest of
those bytes. Repeating the request changes nothing.

## Image Contract

An admitted source must be JPEG, PNG (including APNG), WebP, GIF, or AVIF. SVG,
HEIC, TIFF, PDF, raw pixels, and every other format are unsupported. A source is
readable only when Sharp can read its metadata and decode all pixel data with
`failOn: warning`; header-only success is not enough. An unsupported but readable
format refuses differently from unreadable or corrupt bytes.

`format` is one of `avif`, `gif`, `jpeg`, `png`, or `webp`. Render accepts those
lowercase names, the alias `jpg` for `jpeg`, and the sentinel `original`. Other
spellings, unavailable requested encoders, and an unavailable source encoder
needed for a smaller fallback are refused. A valid format that cannot preserve
an admitted animation is omitted, not refused. GIF and WebP are the
animation-preserving output formats. The exact original fallback always
preserves animation, including an animated source in another supported format.

Width and height are positive whole pixel counts after EXIF orientation is
applied. For a multi-frame image, height is one displayed frame's height, not
the stacked decoder height. Every supplied width must be a positive safe
integer. Widths may be unsorted or repeated; rendering deduplicates and sorts
them ascending. A width greater than the displayed source width is omitted. A
generated rendition has exactly the requested width and
`max(1, round(source height * width / source width))` height. It is never cropped,
padded, stretched, or enlarged.

Rendering uses this fixed profile: apply EXIF orientation, resize with Lanczos 3
and fast shrink-on-load disabled, strip metadata, and use the encoder settings
below. These settings make output repeatable for one Sharp/libvips build; the
digest records the actual result so a changed encoder result receives a changed
identity.

- AVIF: quality 50, lossy, effort 4, 4:4:4 chroma, 8 bit, automatic tune.
- GIF: palette reuse, no interlace, 256 colours, effort 7, dither 1, no inter-frame error, inter-palette error 3, and duplicate frames retained.
- JPEG: quality 80, no progressive scan, 4:2:0 chroma, optimized coding.
- PNG: full-colour output, no interlace, compression level 9, no adaptive filtering.
- WebP: quality 80, alpha quality 100, lossy, no near-lossless mode, no smart subsampling, effort 4.

Generated animated GIF and WebP renditions retain the source frame count, frame
delays, and loop count. Any decoding, encoding, dimension, format, or animation
verification failure refuses the whole render without replacing its previous
renditions.

## Digests And Identities

A digest is the lowercase, 64-character hexadecimal SHA-256 digest of the exact
stored bytes. An original digest covers the admitted source bytes. A rendition
digest covers that rendition's bytes; the exact original fallback therefore has
the original digest. Bytes are copied on input and on every query output.

Original identity is a deterministic, unambiguous encoding of `(subject, source
digest)`. Rendition identity is a deterministic, unambiguous encoding of
`(original, width, format, rendition digest)`. Delimiter-like subjects cannot
collide. Replacing or releasing an original removes its identity and every
rendition identity from queries. Re-admitting the same subject and bytes may
recreate the same content-addressed identities. Unknown and stale identities
make optional and many queries answer no rows; rendering a stale original is
refused.

An extension is the canonical suffix without a dot: `avif`, `gif`, `jpg`, `png`,
or `webp`. Its media type is respectively `image/avif`, `image/gif`, `image/jpeg`,
`image/png`, or `image/webp`. A rendition's `name` is its content digest, a dot,
and that extension. It is a stable, collision-resistant suggested filename
derived only from intrinsic rendition facts. Equal names therefore imply equal
content digests and canonical extensions, absent a SHA-256 collision. The name
is not a path, address, claim, or publication decision.

## State

```state
a set of Originals with
  a subject Subject
  a content Bytes
  a digest Digest
  a format Format
  a width Number
  a height Number
  an animated Flag

a set of Renditions with
  an original Original
  a width Number
  a height Number
  a format Format
  an animated Flag
  an order Number
  a content Bytes
  a digest Digest
  an extension Extension
  a name Name
  a mediaType MediaType
  a fallback Flag
```

At most one original exists per subject and one rendition per original, width,
and format.

## Actions

```actions
admit (subject: Subject, content: Bytes) : return (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag, changed: Flag)
  where subject is not well-formed text
  then
    refuse INVALID_SUBJECT "An image subject must be well-formed text."
  where content has no readable image metadata or all pixels cannot be decoded
  then
    refuse UNREADABLE_IMAGE "These bytes are not a fully readable image."
  where content is readable but its source format is unsupported
  then
    refuse UNSUPPORTED_SOURCE_FORMAT "The source image format is not supported."
  where an original has subject and the same exact content
  then
    return that original with its facts and changed false
  where content is a supported readable image and differs
  then
    remove any original for subject and all of its renditions
    add an original with copied content, its digest, displayed dimensions, format, and animation facts
    return it with changed true

render (original: Original, widths: Widths, formats: Formats) : return (original: Original, count: Number, derived: Number, changed: Flag)
  where original is absent
  then
    refuse ORIGINAL_NOT_FOUND "There is no such image."
  where widths is not a dense list of positive safe integers
  then
    refuse INVALID_WIDTHS "Widths must be positive safe integers."
  where formats is not a dense list of supported available format names
  then
    refuse UNSUPPORTED_FORMAT "A rendition format is unsupported or unavailable."
  where its renditions already equal the normalized requested set and exact original fallback
  then
    return original, the final rendition count, the non-fallback rendition count, and changed false
  where producing or verifying any planned rendition fails
  then
    leave every existing rendition unchanged
    refuse RENDITION_FAILED "A requested image rendition could not be produced."
  where the planned rendition set differs and every rendition succeeds
  then
    atomically replace its renditions in normalized format and width order, with the original format last
    return original, the final rendition count, the non-fallback rendition count, and changed true

release (subject: Subject) : return (subject: Subject, count: Number)
  where subject is not well-formed text
  then
    refuse INVALID_SUBJECT "An image subject must be well-formed text."
  then
    remove its original and renditions if present and return whether one original was removed
```

Every render contains at least the exact original fallback at its displayed
source dimensions. Requested alternative formats come first in first-declared
order, with aliases and duplicates merged. Their non-upscaled widths are
ascending. The source-format group comes last, contains every non-upscaled width
that can preserve animation, and ends with the exact original fallback. `order`
numbers the resulting renditions from zero. `count` is the final set size.
`derived` is the number whose `fallback` flag is false, so it excludes the one
exact original without requiring a caller to subtract.

## Queries

```queries
_original (subject: Subject) : optional (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag)
_renditions (original: Original) : many (rendition: Rendition, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag, content: Bytes)
_rendition (rendition: Rendition) : optional (original: Original, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag)
```

Transcoding owns image validation, orientation, resizing, encoding, and intrinsic
rendition facts. Its suggested name may be ignored; it does not decide whether
or where an image is published, what address it receives, or how it is
presented.
