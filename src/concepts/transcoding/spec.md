# Transcoding

## Purpose

Derive alternative sizes and encodings of one source image, so a reader receives
a rendition their viewer can accept at a size their screen needs.

## Principle

Ada admits a PNG for a subject and receives its format, intrinsic dimensions, and
animation state. Admitting the same bytes again returns the same image without a
change. Rendering AVIF and the original format at 480, 960, and 1440 produces
stable, content-addressed renditions in declared format order, skipping 1440
when the source is 960 wide. Rendering the same settings again does not change
the rendition set. An animated GIF is admitted, but a rendition format that
would discard its animation is skipped. Unreadable bytes are refused.

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
  a format Format
  an order Number
  a content Bytes
  a name Name
  a medium Medium
```

At most one original exists per subject and one rendition per original, width,
and format. A rendition name is derived from its original digest, width, and
format.

## Actions

```actions
admit (subject: Subject, content: Bytes) : return (original: Original, format: Format, width: Number, height: Number, animated: Flag, changed: Flag)
  where content is not a readable image
  then
    refuse UNREADABLE_IMAGE "These bytes are not a readable image."
  where an original has subject and this content's digest
  then
    return that original with changed false
  where content is a readable image and differs
  then
    replace any original for subject, with its renditions
    add an original with its image facts
    return it with changed true

render (original: Original, widths: Widths, formats: Formats) : return (original: Original, count: Number, changed: Flag)
  where original not in originals
  then
    refuse ORIGINAL_NOT_FOUND "There is no such image."
  where its renditions already answer these widths and formats
  then
    return original, their count, and changed false
  where its renditions do not answer these widths and formats
  then
    replace its renditions with each declared format and each width no greater than the original,
      skipping formats that would drop animation
    return original, how many were added, and changed true

release (subject: Subject) : return (original: Original)
  then
    remove its original and renditions
```

## Queries

```queries
_original (subject: Subject) : optional (original: Original, format: Format, width: Number, height: Number, animated: Flag)
_renditions (original: Original) : many (rendition: Rendition, width: Number, format: Format, order: Number, name: Name, medium: Medium, content: Bytes)
_rendition (rendition: Rendition) : one (original: Original, width: Number, format: Format, order: Number, name: Name, medium: Medium)
```

Transcoding does not decide where an image is published or how a rendition is
presented.
