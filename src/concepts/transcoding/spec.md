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

## Types

```types
Subject = Text
  A well-formed Unicode string identifying an admitted image.

Format = "avif" | "gif" | "jpeg" | "png" | "webp"

Widths = List<PositiveInteger>
  Requested displayed widths in pixels.

Formats = List<Format | "jpg" | "original">
  Requested output formats, including the JPEG alias and source sentinel.

Digest = Text
  A lowercase, 64-character hexadecimal SHA-256 digest.

Extension = "avif" | "gif" | "jpg" | "png" | "webp"

MediaType = "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp"

Name = Text
  A rendition's suggested filename.
```

An admitted source must be JPEG, PNG (including APNG), WebP, GIF, or AVIF. SVG,
HEIC, TIFF, PDF, raw pixels, and every other format are unsupported. Source and
output formats use the canonical lowercase `Format` names. Render also accepts
`jpg` for `jpeg` and the sentinel `original`.

Width and height are positive whole pixel counts after EXIF orientation is
applied. For a multi-frame image, height is one displayed frame's height, not
the stacked decoder height. A generated rendition has exactly the requested
width and `max(1, round(source height * width / source width))` height. It is
never cropped, padded, stretched, or enlarged.

An original digest covers the admitted source bytes. A rendition digest covers
that rendition's bytes; the exact original fallback therefore has the original
digest. Original identity is a deterministic, unambiguous encoding of
`(subject, source digest)`. Rendition identity is a deterministic, unambiguous
encoding of `(original, width, format, rendition digest)`. Delimiter-like
subjects cannot collide. Re-admitting the same subject and bytes may recreate
the same content-addressed identities.

An extension is the canonical suffix without a dot. Its media type follows the
same row:

| Format | Extension | Media type |
| --- | --- | --- |
| `avif` | `avif` | `image/avif` |
| `gif` | `gif` | `image/gif` |
| `jpeg` | `jpg` | `image/jpeg` |
| `png` | `png` | `image/png` |
| `webp` | `webp` | `image/webp` |

A rendition's `name` is its content digest, a dot, and its extension. It is a
stable, collision-resistant suggested filename derived only from intrinsic
rendition facts. Equal names therefore imply equal content digests and canonical
extensions, absent a SHA-256 collision. The name is not a path, address, claim,
or publication decision.

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
  a frameCount Number
  a frameDelays seq of Number
  a loopCount Number

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

## Actions

`admit` copies the supplied bytes. A source is readable only when Sharp can read
its metadata and decode all pixel data with `failOn: warning`; header-only
success is not enough. An unsupported but readable format refuses differently
from unreadable or corrupt bytes.

`render` requires an ordinary dense list of positive safe integer widths. It
deduplicates and sorts widths ascending, and omits widths greater than the
displayed source width. Format names remain in first-declared order after aliases
and duplicates are merged. Other spellings, unavailable requested encoders, and
an unavailable source encoder needed for a smaller fallback are refused. A valid
format that cannot preserve an admitted animation is omitted, not refused. GIF
and WebP are the animation-preserving output formats. The exact original fallback
always preserves animation, including an animated source in another supported
format.

Rendering applies EXIF orientation, resizes with Lanczos 3 and fast
shrink-on-load disabled, strips metadata, and uses this fixed encoder profile:

- AVIF: quality 50, lossy, effort 4, 4:4:4 chroma, 8 bit, automatic tune.
- GIF: palette reuse, no interlace, 256 colours, effort 7, dither 1, no inter-frame error, inter-palette error 3, and duplicate frames retained.
- JPEG: quality 80, no progressive scan, 4:2:0 chroma, optimized coding.
- PNG: full-colour output, no interlace, compression level 9, no adaptive filtering.
- WebP: quality 80, alpha quality 100, lossy, no near-lossless mode, no smart subsampling, effort 4.

These settings make output repeatable for one Sharp/libvips build; the digest
records the actual result so a changed encoder result receives a changed
identity. Generated animated GIF and WebP renditions retain the source frame
count, frame delays, and loop count. Any decoding, encoding, dimension, format,
or animation verification failure refuses the whole render without replacing
its previous renditions.

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

## Queries

```queries
_original (subject: Subject) : optional (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag)
  Returns no row for an unknown or non-Text Subject.

_renditions (original: Original) : many (rendition: Rendition, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag, content: Bytes)
  Returns no rows for an unknown, malformed, replaced, or released Original.
  Returns a fresh copy of each row's `content`. `order` starts at zero.
  Alternative formats come first in first-declared order after aliases and
  duplicates are merged; their non-upscaled widths ascend. The source-format
  group comes last and ends with the exact original fallback at the displayed
  source dimensions. Every render has this fallback. The source-format group
  also contains each requested smaller width that can preserve animation.

_rendition (rendition: Rendition) : optional (original: Original, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag)
  Returns no row for an unknown, malformed, replaced, or released Rendition.
  Replacing or releasing its Original removes the Rendition from lookup.
```

## Contracts

```contracts
contract rendition-keys
  At most one Original exists per Subject, and at most one Rendition exists per
  Original, width, and Format.
```
