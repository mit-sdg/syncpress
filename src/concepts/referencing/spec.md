# Referencing

## Purpose

Find supported references in generated HTML and safely rewrite them after their
replacements are known.

## Principle

Ada scans generated HTML containing links, images, and embedded resources. Each
found address says which element and attribute owns it, where it appears in the
HTML, and which other addresses share that element or attribute. Ada can replace
an address safely or trust supplied markup to replace one whole element. The HTML
is finished only after every found address has an answer. Scanning again forgets
the old answers, and removing the scan makes its old reference identities invalid.
Primary image sources also carry a vetted record of authored attributes that an
image embedding policy may preserve.

## Text And HTML

Text is a well-formed Unicode string. Subjects, parts, identities, scanned HTML,
and answers must be Text. Empty Text is valid. Queries given a value that is not
Text answer no row.

`scan` parses its input as an HTML fragment with standard HTML error recovery. It
does not reject malformed HTML. It discovers only supported elements that have a
location in the supplied text; parser-created elements have no location and are
ignored. Rewriting changes the supplied text rather than serializing the recovered
tree, so text outside answered attributes or replaced elements is preserved.

Only elements in the HTML namespace and the following element/attribute pairs are
supported. Element and attribute names are ASCII case-insensitive. The HTML parser
chooses the effective value when malformed input repeats an attribute.

| Element | Attribute | Role | Kind | Label |
| --- | --- | --- | --- | --- |
| `a` | `href` | `hyperlink`, or `download` when `download` is present | `link` or `download` | descendant text |
| `area` | `href` | `hyperlink`, or `download` when `download` is present | `link` or `download` | `alt` |
| `base` | `href` | `base` | `link` | empty |
| `link` | `href` | `link-resource` | `embed` | empty |
| `img` | `src` | `image` | `image` | `alt` |
| `img` | `srcset` | `image-candidate` | `image` | `alt` |
| `input[type=image]` | `src` | `input-image` | `image` | `alt` |
| `source` | `src` | `media-source` | `embed` | empty |
| `source` | `srcset` | `source-candidate` | `image` | empty |
| `audio`, `video` | `src` | `media` | `embed` | empty |
| `video` | `poster` | `poster` | `embed` | empty |
| `script` | `src` | `script` | `embed` | empty |
| `iframe` | `src` | `frame` | `embed` | empty |
| `embed` | `src` | `embedded-resource` | `embed` | empty |
| `track` | `src` | `track` | `embed` | empty |

This is deliberately not a complete inventory of every URL-bearing HTML feature.
Form actions, citation attributes, ping lists, `srcdoc`, CSS URLs, SVG references,
and other element/attribute pairs are outside this concept's contract.

Only a primary `img[src]` reference exposes `attributes`. It is a fresh
null-prototype record of decoded, parser-retained, source-backed attribute values
that Embedding can accept: `class`, `crossorigin`, `dir`, `fetchpriority`, `id`,
`lang`, `referrerpolicy`, `role`, `sizes`, `title`, `aria-*`, and `data-*`.
Dynamic names match `^(?:aria|data)-[a-z][a-z0-9_.:-]*$`. `crossorigin` is empty,
`anonymous`, or `use-credentials`; `dir` is `auto`, `ltr`, or `rtl`;
`fetchpriority` is `auto`, `high`, or `low`; and `referrerpolicy` is empty,
`no-referrer`, `no-referrer-when-downgrade`, `origin`,
`origin-when-cross-origin`, `same-origin`, `strict-origin`,
`strict-origin-when-cross-origin`, or `unsafe-url`. Everything else is omitted,
including Syncpress-owned `src`, `srcset`, `width`, `height`, `alt`, `loading`,
and `decoding` attributes, event handlers, and `style`.

Attribute names are canonical lowercase and records use ascending UTF-8 name
order. Each query returns a new record, so changing a returned record cannot
change stored state. Repeated or malformed attributes use the HTML parser's
effective value, and attributes without a parser source location are omitted.
No `srcset` candidate, `input[type=image]`, `source`, or other reference exposes
`attributes`.

`raw` is the HTML-decoded attribute value, not its entity spelling in the source.
For `srcset`, the HTML-decoded value is parsed using the HTML candidate algorithm:
commas inside URL tokens, including data URLs, are retained; trailing separator
commas are removed; descriptor whitespace and parentheses are recognized; and a
candidate with invalid, repeated, zero, or mutually incompatible descriptors is ignored.
Each valid candidate is a separate reference. `index` is its zero-based order in
the valid candidates of that attribute. A non-`srcset` reference has index zero.

`line` and `column` are one-based positions in the generated HTML supplied to
`scan`, not positions in an authored template or Markdown source. They point to
the first source character spelling the URL. An empty or valueless attribute uses
the insertion position where its value would begin.

## Groups, Answers, And Rewriting

Every source-backed supported element receives an opaque `element` identity. All
references on that element share it. Every supported attribute containing at
least one reference receives an opaque `slot` identity. All candidates in one
`srcset` share it. These identities, together with `tag`, `attribute`, `role`, and
`index`, let a composition distinguish an `img` primary source from its candidates
and from candidates on a `source` element without interpreting strings.

An `address` answer replaces one decoded attribute value, or one URL token inside
`srcset`. If any address in an attribute changes, the complete decoded attribute
value is serialized as a double-quoted HTML attribute. Ampersands, both quote
characters, less-than signs, and greater-than signs are escaped. This safely
handles originally quoted, unquoted, empty, and valueless attributes and preserves
the meaning of existing character references.

An address answer containing U+0000 cannot be represented faithfully in HTML and
is refused. A `srcset` address must also be nonempty, contain no ASCII whitespace,
and neither start nor end with a comma, so it remains exactly one URL token rather
than injecting another candidate. These are representation rules, not URL
validation; Referencing otherwise leaves address syntax and meaning alone.

A `markup` answer is trusted HTML and is inserted verbatim in place of the
reference's complete source-backed element. Referencing does not parse, sanitize,
or escape trusted markup. Two different references may not hold markup answers
whose element spans overlap, including two references on the same element; the
later answer is refused. Address answers inside a replaced element remain answers
for completion but produce no separate edit.

Referencing records HTML structure but does not resolve URLs, check resources,
choose image policy, or decide whether trusted markup is appropriate. Those are
composition decisions.

## Identities And Lifecycle

A source identity is a collision-safe opaque encoding of its exact subject and
part and is reused by rescans and remove-then-scan. Subject and part remain
independent even when they contain punctuation or control characters. Each scan
has a new revision. Reference, element, and slot identities include that revision,
so an identity from an earlier scan or from before a drop can never name a later
record.

Scanning always replaces the source text and all of its references and answers.
`replaced` says whether a source was present. `completed` is true exactly when the
new scan itself completes immediately because it found no references.

An answer has `changed: true` only when its form or value differs from the stored
answer. Its `completed` response is a transition flag: it is true exactly when
this changed answer takes a previously unfinished source to finished. Repeating an
answer, or correcting an answer after the source is already finished, returns
`completed: false`. `_finished` nevertheless always reflects the current answers.

`drop` removes a present source and all its references. It is an idempotent no-op
for an absent source; `dropped`, `count`, and the stable source identity report
what happened.

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
  a decoded value Text
  a span Span

a set of References with
  a source Source
  an element Element
  a slot Slot
  an index Number
  a raw Address
  a kind Kind
  a role Role
  a tag Tag
  an attribute Attribute
  a label Text
  a line Number
  a column Number
  a target Span
  an element span Span
  optional attributes Attributes for a primary img src
  an optional answer Text
  an optional form Form
```

At most one source exists per subject and part. Reference order is element source
order, then attribute source order, then candidate order. `_references` and
`_unanswered` use that order.

## Actions

```actions
scan (subject: Subject, part: Part, text: Text) : return (source: Source, count: Number, replaced: Flag, completed: Flag)
  where subject, part, or text is not Text
  then
    refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
  where all inputs are Text
  then
    replace any source for subject and part, including its references and answers
    parse text with HTML fragment recovery and add every supported reference
    return source, how many references were added, whether a source was replaced,
      and completed true exactly when count is zero

answer (reference: Reference, form: Form, value: Text) : return (reference: Reference, source: Source, subject: Subject, part: Part, changed: Flag, completed: Flag)
  where reference or value is not Text
  then
    refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
  where form is neither address nor markup
  then
    refuse INVALID_FORM "Answer form must be address or markup."
  where reference is not in references
  then
    refuse REFERENCE_NOT_FOUND "There is no such reference."
  where form is address and value cannot be represented as one reference in its HTML attribute
  then
    refuse UNREPRESENTABLE_ADDRESS "This address cannot be represented as one HTML reference."
  where form is markup and another markup answer has an overlapping element span
  then
    refuse OVERLAPPING_MARKUP "A markup answer overlaps another markup answer."
  where the answer is allowed
  then
    replace that reference's answer and form if either differs
    return its identities, changed true exactly when either differed, and completed
      true exactly when this change moved its source from unfinished to finished

drop (subject: Subject, part: Part) : return (source: Source, count: Number, dropped: Flag)
  where subject or part is not Text
  then
    refuse INVALID_TEXT "Subjects, parts, identities, HTML, and answers must be well-formed text."
  where inputs are Text
  then
    remove any source for subject and part with all its references
    return its stable identity, how many references were removed, and whether a source was present
```

## Queries

```queries
_source (source: Source) : optional (subject: Subject, part: Part)
_reference (reference: Reference) : optional (source: Source, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: Number, label: Text, line: Number, column: Number, attributes?: Attributes)
_references (source: Source) : many (reference: Reference, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: Number, label: Text, line: Number, column: Number, attributes?: Attributes)
_unanswered (source: Source) : many (reference: Reference, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: Number, label: Text, line: Number, column: Number, attributes?: Attributes)
_finished (subject: Subject, part: Part) : optional (source: Source, text: Text)
```
