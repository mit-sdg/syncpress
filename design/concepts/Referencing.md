# Referencing

## Purpose

Find supported references in generated HTML and safely rewrite them after their
replacements are known.

## Principle

Ada scans generated HTML containing links, images, and embedded resources. Each
found address says which element and attribute owns it, where it appears in the
HTML, and which other addresses share that element or attribute. Ada can replace
an address safely or trust supplied markup to replace one whole element. The HTML
is finished only after every found address has an answer. Once finished, its
answers are fixed: an identical repeated answer is idempotent, while a changed
answer is refused. Scanning again forgets the old answers, and removing the scan
makes its old reference identities invalid. Primary image sources also carry
their source-backed authored attributes for application policy to interpret.

The concept retains this value vocabulary and its constraints:

`Subject = Text` An application-supplied owner of scanned HTML.

`Part = Text` A named HTML part within a Subject.

`Address = Text` One decoded HTML reference value.

`Form = "address" | "markup"` Kind = "link" | "image" | "embed" | "download" Role = "hyperlink" | "download" | "base" | "link-resource" | "image" | "image-candidate" | "input-image" | "media-source" | "source-candidate" | "media" | "poster" | "script" | "frame" | "embedded-resource" | "track" Attribute = "href" | "src" | "srcset" | "poster"

`Tag = Text` A canonical lowercase supported HTML element name.

`Span = record` start: NonnegativeInteger end: NonnegativeInteger

`Attributes = Map<Text, Text>` Decoded source-backed image attributes keyed by canonical lowercase name in ascending JavaScript string order.

`ReferenceRow = record` reference: Reference raw: Address kind: Kind role: Role tag: Tag attribute: Attribute element: Element slot: Slot index: NonnegativeInteger label: Text line: PositiveInteger column: PositiveInteger attributes?: Attributes

Text is a well-formed Unicode string. Subjects, parts, identities, scanned HTML, and answers must be Text. Empty Text is valid.

Only elements in the HTML namespace and the following element/attribute pairs are supported. Element and attribute names are ASCII case-insensitive. The HTML parser chooses the effective value when malformed input repeats an attribute.

| Element | Attribute | Role | Kind | Label | | --- | --- | --- | --- | --- | | `a` | `href` | `hyperlink`, or `download` when `download` is present | `link` or `download` | descendant text | | `area` | `href` | `hyperlink`, or `download` when `download` is present | `link` or `download` | `alt` | | `base` | `href` | `base` | `link` | empty | | `link` | `href` | `link-resource` | `embed` | empty | | `img` | `src` | `image` | `image` | `alt` | | `img` | `srcset` | `image-candidate` | `image` | `alt` | | `input[type=image]` | `src` | `input-image` | `image` | `alt` | | `source` | `src` | `media-source` | `embed` | empty | | `source` | `srcset` | `source-candidate` | `image` | empty | | `audio`, `video` | `src` | `media` | `embed` | empty | | `video` | `poster` | `poster` | `embed` | empty | | `script` | `src` | `script` | `embed` | empty | | `iframe` | `src` | `frame` | `embed` | empty | | `embed` | `src` | `embedded-resource` | `embed` | empty | | `track` | `src` | `track` | `embed` | empty |

This is deliberately not a complete inventory of every URL-bearing HTML feature. Form actions, citation attributes, ping lists, `srcdoc`, CSS URLs, SVG references, and other element/attribute pairs are outside this concept's contract.

Only a primary `img[src]` reference exposes `attributes`. It contains every decoded, parser-retained, source-backed attribute value on that element. Referencing records HTML evidence without deciding which attributes another mechanism may preserve. Attribute names are canonical lowercase. Repeated or malformed attributes use the HTML parser's effective value, and attributes without a parser source location are omitted. No `srcset` candidate, `input[type=image]`, `source`, or other reference exposes `attributes`.

`raw` is the HTML-decoded attribute value, not its entity spelling in the source. For `srcset`, the HTML-decoded value is parsed using the HTML candidate algorithm: commas inside URL tokens, including data URLs, are retained; trailing separator commas are removed; descriptor whitespace and parentheses are recognized; and a candidate with invalid, repeated, zero, or mutually incompatible descriptors is ignored. Each valid candidate is a separate reference. `index` is its zero-based order in the valid candidates of that attribute. A non-`srcset` reference has index zero.

`line` and `column` are one-based positions in the generated HTML supplied to `scan`, not positions in an authored template or Markdown source. They point to the first source character spelling the URL. An empty or valueless attribute uses the insertion position where its value would begin.

Every source-backed supported element receives an opaque `element` identity. All references on that element share it. Every supported attribute containing at least one reference receives an opaque `slot` identity. All candidates in one `srcset` share it. These identities, together with `tag`, `attribute`, `role`, and `index`, let a composition distinguish an `img` primary source from its candidates and from candidates on a `source` element without interpreting strings.

A source identity is a collision-safe opaque encoding of its exact subject and part and is reused by rescans and remove-then-scan. Subject and part remain independent even when they contain punctuation or control characters. Each scan has a new revision. Reference, element, and slot identities include that revision, so an identity from an earlier scan or from before a drop can never name a later record.

`Source`, `Element`, `Slot`, and `Reference` are identities introduced by the state declarations. A `Source` is the stable identity of a subject-and-part scan slot; it is not diagnostic source text.

## Types

```types
```

## State

```state
a set of Sources with
  a subject Subject
  a part Part
  a text Text
  a revision Number

a set of Elements with
  a source Source
  a tag Tag
  a span Span

a set of Slots with
  an element Element
  an attribute Attribute
  a decodedValue Text
  a span Span

a set of References with
  a source Source
  an element Element
  a slot Slot
  an index NonnegativeInteger
  a raw Address
  a kind Kind
  a role Role
  a tag Tag
  an attribute Attribute
  a label Text
  a line PositiveInteger
  a column PositiveInteger
  a target Span
  an elementSpan Span
  optional attributes Attributes
  an optional answer Text
  an optional form Form

Rule: one-source-per-slot: At most one Source exists per Subject and Part.
```

## Actions

```actions
scan(subject: Subject, part: Part, text: Text) : return (source: Source, count: Number, replaced: Flag, completed: Flag)
  where subject, part, or text is not Text
  then
    refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
  where all inputs are Text
  then
    replace any source for subject and part, including its references and answers
    parse text with HTML fragment recovery and add every supported reference
    and completed true exactly when count is zero
    return source, count, replaced, completed

resolve(reference: Reference, form: Form, value: Text) : return (reference: Reference, source: Source, subject: Subject, part: Part, changed: Flag, completed: Flag)
  where reference or value is not Text
  then
    refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
  where form is neither address nor markup
  then
    refuse INVALID_FORM "Answer form must be address or markup."
  where reference is not in references
  then
    refuse REFERENCE_NOT_FOUND "There is no such reference."
  where the source is finished and form or value differs from the stored answer
  then
    refuse SOURCE_FINISHED "A finished source cannot accept a changed answer."
  where form is address and value cannot be represented as one reference in its HTML attribute
  then
    refuse UNREPRESENTABLE_ADDRESS "This address cannot be represented as one HTML reference."
  where form is markup and another markup answer has an overlapping element span
  then
    refuse OVERLAPPING_MARKUP "A markup answer overlaps another markup answer."
  where the answer is allowed
  then
    replace that reference's answer and form if either differs
    true exactly when this change moved its source from unfinished to finished
    return reference, source, subject, part, changed, completed

drop(subject: Subject, part: Part) : return (source: Source, count: Number, dropped: Flag)
  where subject or part is not Text
  then
    refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
  where inputs are Text
  then
    remove any source for subject and part with all its references
    produce its stable identity, how many references were removed, and whether a source was present
    return source, count, dropped
```

## Queries

```queries
_source (source: Source) : optional (subject: Subject, part: Part)
  Returns no row while the Source has no current scan. Any query given a non-Text
  argument returns no row or no rows according to its cardinality.

_reference (reference: Reference) : optional (reference: Reference, source: Source, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)
  Returns no row for an unknown identity or an identity from an earlier scan
  revision. In this query, _references, and _unanswered, attributes is present
  only for a primary img[src] reference. Every returned Attributes map is a fresh
  null-prototype map in UTF-16 code-unit order; changing it cannot change stored
  state.

_references (source: Source) : many (reference: Reference, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)
  Returns every current reference in element source order, then attribute source
  order, then candidate order. A Source without a current scan returns no rows.

_unanswered (source: Source) : many (reference: Reference, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)
  Filters the _references sequence to unanswered references without reordering
  it. A Source without a current scan returns no rows.

_finished (subject: Subject, part: Part) : optional (source: Source, text: Text)
  Returns no row when the slot has no current scan or while any current reference
  is unanswered. When present, text is the rewritten scan text. A scan with no
  references is finished immediately.
```
