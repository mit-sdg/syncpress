# Documenting

## Purpose

Keep a document's front-matter attributes beside its authored body, so prose
and metadata travel in one ordinary file while each remains independently
readable.

## Principle

Ada parses a document that opens with YAML front matter. Its attributes contain
`title`, its body is the prose after the closing fence, and the body start line
is retained. A document without front matter has empty attributes. Malformed or
unclosed front matter is refused and records no document. Parsing a subject
again replaces its document, and forgetting it removes it.

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
  where opening attributes are malformed
  then
    refuse MALFORMED_ATTRIBUTES "The attributes at the top of this document cannot be parsed."
  where there are no opening attributes or they are well formed
  then
    replace the document for subject

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
_all () : many (document: Document, subject: Subject)
```

Documenting gives attributes no application-specific meaning.
