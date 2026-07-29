# Collecting

## Purpose

Keep a named ordered set of items with a small card for each, so listings can
be rendered without reaching back into the full item.

## Principle

Ada declares `posts` descending and includes cards for three items. They are
read newest first, ties break by source path ascending, and a missing sort key
comes last. Re-including an identical item reports no change. Changing its card
reports a change. Excluding it removes it, and resetting removes all declared
collections.

## State

```state
a set of Collections with
  a name Name
  a direction Direction

a set of Entries with
  a collection Collection
  an item Item
  an optional key Key
  a tiebreak Text
  a card Values
```

## Actions

```actions
declare (name: Name, direction: Direction) : return (collection: Collection, changed: Flag)
  then
    add or update the named collection

include (collection: Collection, item: Item, key: Key, tiebreak: Text, card: Values) : return (entry: Entry, changed: Flag)
  where collection is absent
  then
    refuse COLLECTION_NOT_FOUND "There is no such collection."
  where collection is present
  then
    add or replace the item's entry and report whether it changed

exclude (collection: Collection, item: Item) : return (entry: Entry)
  where item is absent from collection
  then
    refuse NOT_INCLUDED "This item is not in that collection."
  where item is present
  then
    remove it

withdraw (item: Item) : return (item: Item, count: Number)
  then
    remove the item from every collection

reset () : return (count: Number)
  then
    remove every collection and entry
```

## Queries

```queries
_collections () : many (collection: Collection, name: Name, direction: Direction)
_named (name: Name) : optional (collection: Collection, direction: Direction)
_items (collection: Collection) : many (item: Item, key: Key, card: Values)
_membership (item: Item) : many (collection: Collection, name: Name)
_position (collection: Collection, item: Item) : optional (index: Number)
_catalog () : one (collections: Values)
```

Collecting receives only listing cards. It neither decides membership nor reads
an item's full content.
