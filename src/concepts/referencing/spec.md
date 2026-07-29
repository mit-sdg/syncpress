# Referencing

## Purpose

Record every outward reference a piece of text makes, so each can be answered or
reported as broken, and the text can be rewritten once all of them are answered.

## Principle

Ada scans a body that names an internal page, an image, and a download. Each
reference keeps its kind, label, source position, and enclosing-element span.
Until every reference is answered, finished text is absent. Address answers
replace only targets; a markup answer replaces its whole element. Scanning the
same subject and part replaces the previous references, and text with no
references is finished immediately. Answering an old reference is refused.

## State

```state
a set of Sources with
  a subject Subject
  a part Part
  a text Text

a set of References with
  a source Source
  a raw Address
  a kind Kind          -- link, image, embed, or download
  a label Text
  a line Number
  a column Number
  a span Span
  an optional answer Text
  an optional form Form  -- address or markup
```

At most one source exists per subject and part. A reference span covers its
enclosing element, letting a markup answer replace the element rather than only
its target.

## Actions

```actions
scan (subject: Subject, part: Part, text: Text) : return (source: Source, count: Number)
  then
    replace any source for subject and part
    add a source with subject, part, and text
    add a reference for each outward address the text makes
    return source and how many were added

answer (reference: Reference, form: Form, value: Text) : return (reference: Reference, source: Source, subject: Subject, part: Part)
  where reference not in references
  then
    refuse REFERENCE_NOT_FOUND "There is no such reference."
  where reference in references
  then
    set that reference's answer and form
    return reference with its source, subject, and part

drop (subject: Subject, part: Part) : return (source: Source)
  then
    remove the source and its references
```

## Queries

```queries
_source (source: Source) : one (subject: Subject, part: Part)
_reference (reference: Reference) : one (source: Source, raw: Address, kind: Kind, label: Text, line: Number, column: Number)
_references (source: Source) : many (reference: Reference, raw: Address, kind: Kind, label: Text, line: Number, column: Number)
_unanswered (source: Source) : many (reference: Reference, raw: Address, kind: Kind, line: Number, column: Number)
_finished (subject: Subject, part: Part) : optional (source: Source, text: Text)
```

Scanning reads rendered HTML attributes `href`, `src`, `srcset`, and `poster`.
Each `srcset` candidate is its own reference. `a` and `area` `href` values are
links, except `a[download]`, which is a download; `link[href]`, non-image
`src`, and `poster` values are embeds; `img` and image-input `src` values and
all `srcset` candidates are images. Link text and image or area alternative text
provide labels where they apply.

Referencing does not resolve an address or decide whether an unanswered
reference is an error.
