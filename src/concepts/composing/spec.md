# Composing

## Purpose

Build one record from pieces supplied separately, so each person or process can
add what it knows without rebuilding the whole record.

## Principle

Rosa is planning a neighborhood picnic. One friend adds the venue name, another
adds a contact phone number, and a third adds the capacity. They may add those
pieces in any order and Rosa reads the same complete plan. Correcting the phone
number replaces it. A shopping list is a separate part and remains unchanged.
No one may also add the whole contact record, because that would overlap the
phone-number piece. Clearing the plan leaves it empty.

## Values And Paths

A Value is JSON-like: null, a boolean, a string, a finite number, a sequence of
Values, or a plain record whose only own properties are enumerable string-keyed
data properties containing Values. A sequence is an ordinary dense array with
the standard array prototype and no own properties except `length` and its
enumerable data elements. A plain record has either the ordinary object prototype
or no prototype. Sparse or decorated arrays, array subclasses, non-enumerable
record properties, accessors, symbol properties, class instances, and cyclic
values are not Values. A shared but acyclic input object is copied independently
wherever it occurs.

A path is a nonempty ordinary dense array with the standard array prototype, no
own properties except `length` and its enumerable string data elements, and no
subclass or replacement prototype. Every segment is literal. Dots, empty
strings, and names such as `__proto__`, `constructor`, and `prototype` have no
special meaning and are safe record keys.

A Field is a small dotted shorthand for a path selected by text at runtime. It
contains one or more segments separated by single dots. Each segment contains
one or more ASCII letters, digits, `_`, or `-`; there are no escapes, empty
segments, whitespace, or leading or trailing dots. Thus `data.date` means
`["data", "date"]`, while a literal key containing a dot or an empty string is
available only through the unambiguous path-array queries.

If JavaScript cannot safely inspect a path or Value, including because a proxy's
reflective operation throws, the path or Value is invalid. Validation completes
before retained state changes.

At most one entry exists for a subject, part, and exact path. Setting the exact
path again replaces its value. Two entries may not have paths where either is a
strict prefix of the other, even when the shorter entry contains a record. This
small rule makes the result independent of the order in which distinct pieces
arrive.

Entries are read in ascending lexicographic order by path segment, comparing
string code units and then path length. `_keys` uses that order, and `_record`
constructs members in that order. Paths and Values are copied when stored and
whenever returned, so callers cannot change retained state through an input or a
query result.

Field traversal starts at the assembled record, follows only own record
properties, and never follows prototypes or indexes into sequences. `_field`
answers no row for a malformed field, a missing segment, or traversal through a
non-record.

`_holds` applies the complete generic test vocabulary to a Field. `present` says
that traversal found a value, including explicit null. `equal` uses structural
Value equality: sequences compare by length, order, and recursively equal
members; records compare by their own key sets and recursively equal values,
ignoring key order and ordinary-versus-null prototype. `contains` means
structural membership when the field value is a sequence and exact,
case-sensitive substring containment when both values are text. It is false for
other value kinds. A malformed field returns all three flags false. A comparison
value outside the Value domain leaves `present` accurate but makes `equal` and
`contains` false; queries never retain or mutate the comparison value.

Composing creates no identity of its own. An entry is addressed by its supplied
subject, part, and exact path. Subjects and parts are independent even when their
text contains punctuation or control characters.

## State

```state
a set of Entries with
  a subject Subject
  a part Part
  a path Keys
  a value Value
```

## Actions

```actions
set (subject: Subject, part: Part, path: Keys, value: Value) : return (subject: Subject, part: Part, path: Keys)
  where path is not a path as defined above
  then
    refuse INVALID_PATH "A path must contain one or more string segments."
  where value is not a Value
  then
    refuse INVALID_VALUE "A value must be a finite JSON-like value."
  where an existing path is a strict prefix of path, or path is a strict prefix of an existing path
  then
    refuse KEY_CONFLICTS "This path overlaps another entry."
  where path is valid and does not conflict
  then
    replace any entry for subject, part, and exact path
    add the entry if none exists
    return subject, part, and a copy of path

clear (subject: Subject, part: Part) : return (subject: Subject, part: Part, count: Number)
  then
    remove every entry for subject and part
    return subject, part, and how many entries were removed
```

## Queries

```queries
_record (subject: Subject, part: Part) : one (values: Values)
_value (subject: Subject, part: Part, path: Keys) : optional (value: Value)
_field (subject: Subject, part: Part, field: Field) : optional (value: Value)
_holds (subject: Subject, part: Part, field: Field, value: Value) : one (present: Flag, equal: Flag, contains: Flag)
_keys (subject: Subject, part: Part) : many (path: Keys)
```

`_record` returns an empty record and `_keys` returns no rows for an unknown or
cleared subject and part. `_value` is absent for an unknown, cleared, missing, or
invalid literal path. `_field` and `_holds` are the corresponding convenience
reads for a configured Field; they do not change the literal path grammar. Parts
exist only through their entries; clearing one part never changes another.

Composing knows how to construct a record, not where its pieces came from or how
the record will be used.
