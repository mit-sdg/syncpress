# Converting

## Purpose

Turn lightweight markup into HTML, so authors write prose while the rendering
pipeline receives the markup browsers read.

## Principle

Ada declares Markdown with tables and raw markup enabled. Converting a heading
and paragraph returns HTML for one part of a page; converting another part does
not disturb the first. The same source is reused from the conversion cache. A
document containing the excerpt separator yields an excerpt up to that marker.
The verbatim dialect returns HTML unchanged. An unknown dialect is refused.

## State

```state
a set of Dialects with
  a name Name
  a set of Extensions
  a raw Flag
  a separator Text

a set of Conversions with
  a subject Subject
  a part Part
  a dialect Dialect
  a digest Digest
  an output Text
  an optional excerpt Text
```

## Actions

```actions
declare (name: Name, extensions: Extensions, raw: Flag, separator: Text) : return (dialect: Dialect, changed: Flag)
  then
    add or replace the named dialect

convert (subject: Subject, part: Part, dialect: Dialect, source: Text) : return (conversion: Conversion, output: Text, excerpt: Text)
  where dialect is absent
  then
    refuse DIALECT_NOT_FOUND "There is no such dialect."
  where source cannot be converted
  then
    refuse CONVERSION_FAILED "This text could not be converted."
  where source is convertible
  then
    store its conversion

release (subject: Subject) : return (subject: Subject, count: Number)
  then
    remove every conversion for subject
```

## Queries

```queries
_conversion (conversion: Conversion) : one (subject: Subject, part: Part, output: Text, excerpt: Text)
_for (subject: Subject, part: Part) : optional (conversion: Conversion, output: Text, excerpt: Text)
_dialect (name: Name) : optional (dialect: Dialect)
```

Converting does not choose which dialect a subject uses or where its output is
inserted.
