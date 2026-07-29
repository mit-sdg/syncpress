# Layering

## Purpose

Combine several ranked versions of a record, so broad values can be refined and
the source of each resulting value can be found later.

## Principle

Ada starts with a basic profile and adds a higher-ranked correction. The
correction changes the display name, adds one nested address detail, and replaces
a list, while untouched details remain. The result is the same whichever layer
arrived first. Each value says which layer supplied it. Removing the correction
restores the earlier profile. Two layers cannot use the same rank.

## Values

A Value is JSON/YAML-like: null, a boolean, a string, a finite binary64 number, a
sequence of Values, or a plain mapping whose own properties are enumerable
string-keyed data properties containing Values. A Values contribution is a
mapping. A plain mapping has either the ordinary object prototype or no
prototype. Sparse or decorated arrays, non-enumerable properties, accessors,
symbol properties, class instances, functions, bigint, undefined, and cyclic
values are invalid. A shared but acyclic input object is copied independently
wherever it occurs. Negative zero is normalized to zero.

Mappings retain literal keys. Empty strings, dots, and names such as
`__proto__`, `constructor`, and `prototype` have no special behavior. Layering
reads only own properties and materializes these names as safe own data
properties.

Contributions are normalized and copied before storage. Every value returned by
a query is also a deep copy. Copies preserve ordinary-versus-null mapping
prototypes. The resolved root is a synthesized ordinary mapping; each non-root
mapping keeps the prototype of the contribution that established that mapping
container. Mutating an input or observation cannot alter stored state.

Two Values are equal when their normalized structures are equal. Scalars compare
by value; negative zero has already become zero. Sequences compare by length,
order, and recursively equal items. Mappings compare by the same set of literal
own keys and recursively equal values; mapping key order and ordinary-versus-null
prototype do not affect equality.

## Ranks And Identity

A rank is any finite number. NaN and either infinity are invalid. Negative zero
is rank zero. Layers resolve in ascending numeric rank regardless of arrival
order, so the highest applicable rank wins. At most one layer exists for a
subject and normalized rank.

Layer identity is exactly `layer:` followed by the JSON encoding of the pair
`[subject, rank]`. It is stable across concept instances, withdrawal and later
recontribution. Distinct subject and normalized-rank pairs have distinct
identities.

Contribution is atomic. Rank validity is checked first, value validity second,
and rank availability third. A refusal changes no state.

## Merge

Resolution begins with an empty mapping and applies layers in ascending rank.
When both the existing and incoming values at a key are mappings, they merge
recursively. Otherwise the incoming value replaces the existing value and its
entire subtree. Sequences, strings, numbers, booleans, and null therefore replace
rather than merge. An incoming mapping also replaces an existing non-mapping.
There is no deletion marker because undefined is not a Value. A subject with no
layers resolves to an empty mapping.

## Paths And Absence

A path is a dense sequence of literal string key segments. It traverses mappings
only; sequences are values and their indexes are not path segments. An empty path
names the complete resolved mapping. A dot inside a segment is an ordinary dot,
not a separator. Empty and special-name segments are valid. A sparse, decorated,
non-array, accessor-backed, or non-string path is invalid.

`_value` is absent for an invalid path, a missing key, or traversal through a
non-mapping. Explicit null is present. `_flag` returns a stored boolean and uses
`otherwise` for an invalid, absent, or non-boolean value. `_equal` reports
`present: false` and `equal: false` for an invalid or absent path. At a present
path it applies structural Value equality; a comparison value outside the Value
domain is unequal rather than a refusal.

## Provenance

Every resolved non-root path has one origin. A new value or a replacement makes
that layer the origin of the path and every path in its new subtree, removing all
origins from the replaced subtree. When one mapping merges into an existing
mapping, the existing mapping container keeps the layer that established it;
each added or replaced descendant records its own layer. Thus a composite mapping
may have an older container origin and descendants from several newer layers.

An absent path has no origin. The empty root path has no origin because the root
is synthesized from all layers. Origins are recomputed from the remaining layers
after withdrawal, so removing a replacement restores both earlier values and
their earlier origins.

## State

```state
a set of Records with
  a subject Subject

a set of Layers with
  a record Record
  a rank Number
  a values Values
```

## Actions

```actions
contribute (subject: Subject, rank: Number, values: Values) : return (layer: Layer)
  where rank is not finite
  then
    refuse INVALID_RANK "A layer rank must be a finite number."
  where values are not a JSON/YAML-like mapping
  then
    refuse INVALID_VALUES "A layer contribution must be a finite JSON-like record."
  where rank is already contributed for subject
  then
    refuse RANK_TAKEN "This record already has a contribution at this rank."
  where rank and values are valid and rank is available
  then
    add a copied and normalized ranked contribution

withdraw (subject: Subject, rank: Number) : return (layer: Layer)
  where rank is not finite
  then
    refuse INVALID_RANK "A layer rank must be a finite number."
  where rank is finite and absent
  then
    refuse NO_SUCH_LAYER "This record has no contribution at this rank."
  where rank is present
  then
    remove it

clear (subject: Subject) : return (subject: Subject, count: Number)
  then
    remove every contribution for subject
    return how many were removed
```

## Queries

```queries
_resolved (subject: Subject) : one (values: Values)
_value (subject: Subject, path: Keys) : optional (value: Value)
_flag (subject: Subject, path: Keys, otherwise: Flag) : one (value: Flag)
_equal (subject: Subject, path: Keys, value: Value) : one (present: Flag, equal: Flag)
_origin (subject: Subject, path: Keys) : optional (rank: Number, layer: Layer)
_layers (subject: Subject) : many (layer: Layer, rank: Number, values: Values)
```

`_layers` uses ascending numeric rank order. Layering does not decide where
contributions come from, what a resolved record controls, or what filtering or
containment operations an application needs.
