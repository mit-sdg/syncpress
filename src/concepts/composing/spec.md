# Composing

## Purpose

Assemble one record from parts that are known separately, so each contributor
can supply only the fields it owns.

## Principle

Ada sets `site`, `page.data`, and `page.url` for a page context. The resulting
record nests the page fields together. She sets `page.content` as raw, and the
record names that key among its raw values. Replacing `page.url` changes only
that value. A second part of the page is independent. Trying to nest inside a
scalar is refused.

## State

```state
a set of Parts with
  a subject Subject
  a part Part

a set of Entries with
  a part Part
  a key Key
  a value Value
  a raw Flag
```

## Actions

```actions
set (subject: Subject, part: Part, key: Key, value: Value, raw: Flag) : return (entry: Entry)
  where key would nest inside a scalar
  then
    refuse KEY_CONFLICTS "This key would nest inside a value that is not a record."
  where key does not conflict
  then
    replace its entry

clear (subject: Subject, part: Part) : return (subject: Subject, part: Part, count: Number)
  then
    remove every entry for the part
```

## Queries

```queries
_record (subject: Subject, part: Part) : one (values: Values, raw: Keys)
_value (subject: Subject, part: Part, key: Key) : optional (value: Value)
_keys (subject: Subject, part: Part) : many (key: Key, raw: Flag)
```

Composing knows how to construct a record, not why a record is being built.
