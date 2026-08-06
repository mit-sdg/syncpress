# Cataloging

## Purpose

Admit projected items into named catalogs under declared conditions and keep
every catalog in a deterministic order for publication and inspection.

## Principle

Ada declares a newest-first catalog sorted by a card's `data.date` field and a
featured catalog that accepts cards whose `data.featured` field equals true.
Indexing complete cards places qualifying entries in deterministic order;
entries with no date follow dated entries. Re-indexing a changed card updates
its projection and position, and re-indexing a card that no longer qualifies
removes its earlier featured entry. Ada can unindex one membership, withdraw an
item from every catalog, or reset all catalog state.

## Values And Fields

A Value is one of null, a boolean, a finite number, text, a dense list of
Values, or a record whose own text keys map to Values. Records are plain or
null-prototype objects with enumerable data properties. Symbol keys, accessors,
cycles, sparse or decorated lists, array subclasses or arrays with another
prototype, other class instances, proxies, functions, bigint, undefined inside
a Value, NaN, and positive or negative infinity are not Values. Negative zero
is normalized to zero. Inputs are normalized and cloned before storage, and
queries return clones.

Text is a well-formed Unicode string. Catalog names, selectors, catalog and item
identities, paths, and tiebreaks must be Text. Actions refuse `INVALID_TEXT` before using another
value that is not Text. Lookup queries answer no row for a non-Text input.

A selector follows the shared portable glob value contract: it is nonempty,
case-sensitive, matches a complete `/`-separated path, includes dotfiles, and
supports portable wildcards, classes, braces, extglobs, quoting, and escapes.
Malformed or unbalanced syntax is not a selector.

A Field has one or more dot-separated segments. Every segment contains only
ASCII letters, digits, `_`, or `-`. There are no escapes, empty segments,
whitespace, or leading or trailing dots. A Field follows own record properties
only and never indexes a list. Missing traversal produces a missing sort key or
a condition that does not match; explicit null is present.

A Condition is null or exactly one of:

- `{ test: "equals", field: Field, value: Value }`
- `{ test: "contains", field: Field, value: Value }`
- `{ test: "exists", field: Field }`

Equality is recursive structural Value equality. `contains` means structural
membership for a list and exact case-sensitive substring containment for two
texts. It is false for other value kinds.

## State

```state
a set of Catalogs with
  a unique name Name
  a selector Pattern
  a direction Direction                 -- asc or desc
  an optional sort Field
  an optional condition Condition

a set of Entries with
  a catalog Catalog
  an item Item
  a path Path
  a tiebreak Text
  a card Values
  a sort key derived from the catalog policy and card
```

At most one catalog has a name, and at most one entry has a catalog and item.
Catalog and entry identities are deterministic encodings of their name and
`(catalog, item)` respectively and survive redeclaration and remove-then-add.
An indexed card is a catalog-owned snapshot supplied by the caller. `index`
replaces that snapshot; it is never refreshed from another owner implicitly.
Removing a catalog removes all of its snapshots atomically.

## Actions

```actions
declare (name: Name, selector: Pattern, direction: Direction, sort: OptionalField, condition: OptionalCondition) : return (catalog: Catalog, changed: Flag)
  where name is not Text
  then
    refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
  where selector is not a valid portable glob
  then
    refuse INVALID_SELECTOR "A catalog selector must be a valid portable glob."
  where direction is neither asc nor desc
  then
    refuse INVALID_DIRECTION "Direction must be asc or desc."
  where a present sort is not a Field
  then
    refuse INVALID_FIELD "A configured field must use dotted ASCII segments."
  where condition is not null or a supported Condition
  then
    refuse INVALID_CONDITION "A condition must be null or one supported field predicate."
  where a catalog has the same complete policy
  then
    return that catalog and changed false
  where a catalog has the name and another policy
  then
    replace its policy, re-evaluate retained entries, and return catalog and changed true
  where no catalog has name
  then
    add it and return catalog and changed true

index (catalog: Catalog, item: Item, path: Path, tiebreak: Text, card: Values) : return (entry: Entry, included: Flag, changed: Flag)
  where catalog, item, path, or tiebreak is not Text
  then
    refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
  where catalog is absent
  then
    refuse CATALOG_NOT_FOUND "There is no such catalog."
  where card is not a record of Values
  then
    refuse INVALID_CARD "A card must be a record of supported values."
  where path does not match the selector or card does not satisfy the catalog condition
  then
    remove its prior entry if present and return included false with whether state changed
  where card satisfies the condition and an equal normalized projection is indexed
  then
    return that entry with included true and changed false
  where card satisfies the condition and no entry matches exactly
  then
    derive its sort key, add or replace the entry, and return included true and changed true

unindex (catalog: Catalog, item: Item) : return (entry: Entry)
  where catalog or item is not Text
  then
    refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
  where item is absent from catalog
  then
    refuse NOT_INCLUDED "This item is not indexed in that catalog."
  where item is present
  then
    remove and return its entry

remove (name: Name) : return (catalog: Catalog, count: Number)
  where name is not Text
  then
    refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
  where no catalog has name
  then
    refuse CATALOG_NOT_FOUND "There is no such catalog."
  where a catalog has name
  then
    remove it and all of its entries and return how many entries were removed

withdraw (item: Item) : return (item: Item, count: Number)
  where item is not Text
  then
    refuse INVALID_TEXT "Names, selectors, identities, paths, and tiebreaks must be text."
  then
    remove the item from every catalog and return how many entries were removed

reset () : return (count: Number)
  then
    remove every catalog and entry and return how many catalogs were removed
```

Declaration and indexing validate completely before changing state. A policy
change re-evaluates retained cards, removing entries that cease to qualify and
recomputing sort keys for those that remain. It does not resurrect cards that
were previously excluded; a caller indexes those cards again.

## Queries

```queries
_catalogs () : many (catalog: Catalog, name: Name, selector: Pattern, direction: Direction, sort: OptionalField, condition: OptionalCondition)
_named (name: Name) : optional (catalog: Catalog, selector: Pattern, direction: Direction, sort: OptionalField, condition: OptionalCondition)
_entries (catalog: Catalog) : many (entry: Entry, item: Item, card: Values)
_membership (item: Item) : many (entry: Entry, catalog: Catalog, name: Name)
_position (catalog: Catalog, item: Item) : optional (index: Number)
_record () : one (catalogs: Values)
```

## Ordering

Present sort keys have this ascending kind order: null, boolean, number, text,
list, record. False precedes true; numbers use numeric order; text uses UTF-8
byte order. Lists compare element by element and then by length. Records compare
their normalized keys and corresponding values member by member and then by
member count.

Descending reverses only the present-key comparison. A missing key always comes
after every present key. Ties then use tiebreak text ascending and item identity
ascending, both in UTF-8 byte order. This is a total deterministic order
independent of indexing order.

`_catalogs` and `_membership` use name ascending in UTF-8 byte order.
`_position` is zero-based. `_record.catalogs` has an own property for every
declared name, including names such as `__proto__`, and each value is the ordered
list of complete cards.
