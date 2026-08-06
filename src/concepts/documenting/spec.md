# Documenting

## Purpose

Separate a document's YAML details from the body they describe, so both can be
kept in one ordinary text and read independently.

## Principle

Ada writes a note with a `---` header containing a title, followed by prose.
Parsing it returns the title as an attribute and the exact prose as the body,
and remembers which line starts that body. A note without a header is all body
and has no attributes. Parsing a valid revision for the same subject replaces
the old values but keeps the document identity. A malformed or unclosed revision
is refused and leaves the previous valid document unchanged. Forgetting removes
the document.

## Types

```types
Subject = JavaScriptString

AttributeValue = null | Flag | Number | JavaScriptString | List<AttributeValue> | Values
Values = Map<JavaScriptString, AttributeValue>
  A normalized YAML mapping with unique literal string keys. No key order is implied.
```

A text has front matter only when its first physical line is exactly the three
ASCII characters `---`. The opening fence has no leading or trailing whitespace,
comment, or byte-order mark. The closing fence is the first later physical line
that is also exactly `---`. A fence line may end in LF or CRLF; each fence may
use either ending independently. A lone CR is text, not a line ending. `...`, an
indented `---`, and a `---` with whitespace or a comment are not fences.

The opening fence at end of input, or an opening fence with no exact closing
fence, is malformed. The YAML source is the exact text between the two fences.
The body is the exact suffix after the closing fence's line ending, with no
newline normalization. A closing fence at end of input has an empty body. A
closing fence followed only by its line ending also has an empty body. Blank
lines after the closing fence are part of the body.

`bodyLine` is one-based. With front matter it is the line immediately after the
closing fence, even when the body is empty and that line lies just past the end
of the text. Without front matter it is 1.

Front matter is one YAML 1.2 document using the YAML 1.2 Core schema. Parser
warnings are malformed. Empty or comment-only front matter is the empty mapping;
every non-empty root must be a mapping. Scalar, sequence, and explicit null roots
are malformed.

The normalized value model contains null, booleans, strings, finite binary64
numbers, sequences of normalized values, and mappings from strings to normalized
values. Integer syntax is read without rounding and is accepted only within
JavaScript's safe integer range; accepted integers are represented as numbers.
NaN, infinities, and integers outside that range are malformed.

Only implicit Core tags and the explicit Core tags `!!map`, `!!seq`, `!!str`,
`!!null`, `!!bool`, `!!int`, and `!!float` are accepted. Custom tags and YAML 1.1
tags such as `!!binary`, `!!set`, and `!!timestamp` are malformed. Merge keys are
not enabled, so `<<` is an ordinary string key.

Every mapping key must be a literal string scalar and keys must be unique as
strings. Numeric, boolean, null, alias, and collection keys are malformed rather
than being converted to strings. Mappings are materialized as ordinary safe
objects; names such as `__proto__` remain ordinary own data properties.

Anchors and aliases are accepted. Each alias is expanded into an independent
normalized value. Cyclic, unresolved, or excessive expansion is malformed; at
most 100 alias expansions may be materialized by one parse.

## State

```state
a set of Documents with
  a subject Subject
  an attributes Values
  a body Text
  a bodyLine Number
```

## Actions

```actions
parse (subject: Subject, text: Text) : return (document: Document, attributes: Values, body: Text)
  where text has an unclosed front-matter header or its attributes are outside the normalized YAML subset
  then
    refuse MALFORMED_ATTRIBUTES "The attributes at the top of this document cannot be parsed."
  where text has no front-matter header or has a well-formed one
  then
    atomically replace the document values for subject while keeping its stable identity
    return the document, a copy of its attributes, and its body

forget (subject: Subject) : return (document: Document)
  where subject has no document
  then
    refuse DOCUMENT_NOT_FOUND "There is no document for this subject."
  where subject has a document
  then
    remove it
```

## Queries

```queries
_document (subject: Subject) : optional (document: Document, attributes: Values, body: Text, bodyLine: Number)
  Returns no row when subject has no document. Attributes returned here and by
  `parse` are deep copies; mutating an observation cannot change stored state or
  a later observation.

_all () : many (document: Document, subject: Subject)
  Returns one row per subject in ascending JavaScript string order, which
  compares UTF-16 code units.
```

## Contracts

```contracts
contract stable-document-identity on parse, forget
  Document identity is `document:` followed by the JSON string encoding of the complete Subject; it is stable across replacement, forgetting, reparsing, and separate concept instances, and distinct Subjects have distinct identities.
```
