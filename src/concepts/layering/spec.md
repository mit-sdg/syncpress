# Layering

## Purpose

Resolve layered configuration by explicit rank, so broad defaults can be
refined, replaced, withdrawn, and traced to the declaration that supplied each
effective value.

## Principle

Ada contributes tool defaults and a higher-ranked deployment override. The
override changes the output name, adds one nested endpoint detail, and replaces
a format list, while untouched settings remain. The effective configuration is
the same whichever layer arrived first. Each value says which layer supplied it.
Withdrawing the override reveals the defaults again. Two layers cannot use the
same rank.

## Types

```types
Subject = JavaScriptString

Value = null | Flag | Number | JavaScriptString | List<Value> | Values
Values = Map<JavaScriptString, Value>
  A plain mapping with literal JavaScript-string keys. Key order does not affect equality.

Keys = List<JavaScriptString>
```

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

A rank is any finite number. NaN and either infinity are invalid. Negative zero
is rank zero. Layers resolve in ascending numeric rank regardless of arrival
order, so the highest applicable rank wins. At most one layer exists for a
subject and normalized rank.

A path is a dense sequence of literal string key segments. It traverses mappings
only; sequences are values and their indexes are not path segments. An empty path
names the complete resolved mapping. A dot inside a segment is an ordinary dot,
not a separator. Empty and special-name segments are valid. A sparse, decorated,
non-array, accessor-backed, or non-string path is invalid.

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
    return its Layer

withdraw (subject: Subject, rank: Number) : return (layer: Layer)
  where rank is not finite
  then
    refuse INVALID_RANK "A layer rank must be a finite number."
  where rank is finite and absent
  then
    refuse NO_SUCH_LAYER "This record has no contribution at this rank."
  where rank is present
  then
    remove and return its Layer

clear (subject: Subject) : return (subject: Subject, count: Number)
  then
    remove every contribution for subject
    return how many were removed
```

## Queries

```queries
_resolved (subject: Subject) : one (values: Values)
  Starts with an empty mapping and applies layers in ascending rank. Existing and
  incoming mappings at the same key merge recursively; every other incoming
  value, including a mapping over a non-mapping, replaces the existing value and
  its entire subtree. Sequences, strings, numbers, booleans, and null therefore
  replace rather than merge. Undefined is not a Value, so there is no deletion
  marker. A subject with no layers resolves to an empty mapping.

_value (subject: Subject, path: Keys) : optional (value: Value)
  Returns no row for an invalid path, a missing key, or traversal through a
  non-mapping. Explicit null is present.

_flag (subject: Subject, path: Keys, otherwise: Flag) : one (value: Flag)
  Returns a stored boolean. An invalid, absent, or non-boolean value produces
  `otherwise`.

_equal (subject: Subject, path: Keys, value: Value) : one (present: Flag, equal: Flag)
  For an invalid or absent path, both flags are false. At a present path,
  comparison uses structural Value equality; a comparison value outside the
  Value domain is unequal rather than a refusal.

_origin (subject: Subject, path: Keys) : optional (rank: Number, layer: Layer)
  Every resolved non-root path has one origin. A new value or replacement makes
  the contributing layer the origin of the path and every path in its new
  subtree, removing origins from the replaced subtree. A recursive mapping merge
  preserves the existing container's origin while assigning each added or
  replaced descendant to its contributing layer, so a composite mapping can
  retain an older container origin and descendant origins from several newer
  layers. An absent path and the synthesized empty root have no origin.
  Withdrawal recomputes origins from the remaining layers, restoring earlier
  values and origins.

_leafOrigins (subject: Subject) : many (path: Keys, rank: Number, layer: Layer)
  Lists scalar and empty-mapping leaves in resolved-tree traversal order.
  Sequences are omitted because paths do not traverse them.

_layers (subject: Subject) : many (layer: Layer, rank: Number, values: Values)
  Lists layers in ascending numeric rank order.
```

## Contracts

```contracts
contract stable-layer-identity on contribute, withdraw
  A Subject and normalized rank identify the same Layer across concept
  instances, withdrawal, and later contribution. Distinct pairs identify
  distinct Layers.
```
