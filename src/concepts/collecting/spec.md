# Collecting

## Purpose

Keep named lists in a dependable order, with a small summary for each item.

## Principle

Ada makes a `favorites` list and adds a few items with scores and short
summaries. Reading it gives the items in score order. Equal scores are settled
by a supplied label and then by item identity, while an item without a score
comes last. Adding the same item again changes nothing; changing its score,
label, or summary updates it.

## Values

A Value is one of null, a boolean, a finite number, text, a dense list of
Values, or a record whose own text keys map to Values. Records are plain or
null-prototype objects with enumerable data properties. Symbol keys, accessors,
cycles, sparse or decorated lists, array subclasses or arrays with another
prototype, other class instances, proxies, functions, bigint, undefined inside
a Value, NaN, and positive or negative infinity are not Values. A value whose
structure cannot be inspected without an exception is not a Value. Negative
zero is normalized to zero. Record member order is ignored; keys are put in
ascending UTF-8 byte order whenever records are compared. Inputs are normalized
and cloned before storage.

Text is a well-formed Unicode string. Collection names, collection and item
identities, and tiebreaks must be Text. Actions refuse `INVALID_TEXT` before
using another value that is not Text. Lookup queries answer no row for a
non-Text input.

An OptionalValue is either a Value or missing. The `key` property may be omitted
or set to undefined to mean missing; undefined has no other meaning and is never
a Value. `_items` always includes the `key` property and answers undefined when
the key is missing.

Two Values are equal when they have the same kind and recursively equal
contents. Record member arrival order and prototypes do not affect equality.

## State

```state
a set of Collections with
  a unique name Name
  a direction Direction                 -- asc or desc

a set of Entries with
  a collection Collection
  an item Item
  an optional key Value
  a tiebreak Text
  a card Values
```

At most one collection has a name, and at most one entry has a collection and
item.

## Actions

```actions
declare (name: Name, direction: Direction) : return (collection: Collection, changed: Flag)
  where name is not Text
  then
    refuse INVALID_TEXT "Names, identities, and tiebreaks must be text."
  where direction is neither asc nor desc
  then
    refuse INVALID_DIRECTION "Direction must be asc or desc."
  where a collection has name and direction
  then
    return that collection and changed false
  where a collection has name and another direction
  then
    set its direction, retain its entries, and return collection and changed true
  where no collection has name
  then
    add it and return collection and changed true

include (collection: Collection, item: Item, key: OptionalValue, tiebreak: Text, card: Values) : return (entry: Entry, changed: Flag)
  where collection, item, or tiebreak is not Text
  then
    refuse INVALID_TEXT "Names, identities, and tiebreaks must be text."
  where collection is absent
  then
    refuse COLLECTION_NOT_FOUND "There is no such collection."
  where a present key is not a Value
  then
    refuse INVALID_SORT_KEY "A sort key must be missing or a supported value."
  where card is not a record of Values
  then
    refuse INVALID_CARD "A card must be a record of supported values."
  where an entry has collection and item with an equal normalized key, tiebreak, and card
  then
    return that entry and changed false
  where collection is present and no entry matches exactly
  then
    add or replace the entry and return it with changed true

exclude (collection: Collection, item: Item) : return (entry: Entry)
  where collection or item is not Text
  then
    refuse INVALID_TEXT "Names, identities, and tiebreaks must be text."
  where item is absent from collection
  then
    refuse NOT_INCLUDED "This item is not in that collection."
  where item is present
  then
    remove and return its entry

withdraw (item: Item) : return (item: Item, count: Number)
  where item is not Text
  then
    refuse INVALID_TEXT "Names, identities, and tiebreaks must be text."
  then
    remove the item from every collection and return how many entries were removed

reset () : return (count: Number)
  then
    remove every collection and entry and return how many collections were removed
```

## Queries

```queries
_collections () : many (collection: Collection, name: Name, direction: Direction)
_named (name: Name) : optional (collection: Collection, direction: Direction)
_items (collection: Collection) : many (item: Item, key: OptionalValue, card: Values)
_membership (item: Item) : many (collection: Collection, name: Name)
_position (collection: Collection, item: Item) : optional (index: Number)
_catalog () : one (collections: Values)
```

## Ordering

Present keys have this ascending kind order: null, boolean, number, text, list,
record. False precedes true; numbers use numeric order; text uses UTF-8 byte
order. Lists compare element by element and then by length. Records compare
their normalized keys and corresponding values member by member and then by
member count.

Descending reverses only the present-key comparison. A missing key always comes
after every present key. Ties then use tiebreak text ascending and item identity
ascending, both in UTF-8 byte order. Because a collection has at most one entry
per item, this is a total deterministic order independent of arrival order.

`_collections` and `_membership` use name ascending in UTF-8 byte order.
`_position` is zero-based. `_catalog` has an own property for every declared
name, including names such as `__proto__`, and each value is the ordered list of
cards. Queries return clones, so callers cannot mutate stored keys or cards.

Collection and entry identities are opaque, deterministic encodings of their
name and `(collection, item)` respectively. Re-declaration, replacement, and
remove-then-add reuse those identities.

Collecting accepts an opaque card record and cannot enforce an application's
card shape or prevent a caller from putting inappropriate data in it. The
composition that calls `include` owns card projection, filtering, and membership
reconciliation. It must call `exclude` when an existing membership no longer
qualifies and use `changed: true` or a successful removal to invalidate readers.
Before `withdraw`, a composition needing per-collection invalidation must read
the item's memberships because `withdraw` returns a count, not collection IDs.
