# Configuring

## Purpose

Keep the settings from one written document in a tree, so they can be looked up
without knowing how the document was written.

## Principle

Ada loads a settings document. She can read its named values and ordered lists,
and each value remembers where it was written. Loading unchanged text keeps the
same tree. Loading new valid text makes a new tree current, while bad text leaves
the previous settings in place.

## Normalized YAML

The notation name is exactly `yaml`. A source contains exactly one YAML 1.2
document and uses the YAML 1.2 Core schema. A YAML version directive naming any
other version is malformed. Parser warnings are treated as errors.

The normalized value model contains null, booleans, strings, finite binary64
numbers, sequences of normalized values, and mappings from strings to normalized
values. Integer syntax is read without rounding and is accepted only within
JavaScript's safe integer range; accepted integers are then represented as
numbers. NaN, infinities, and integers outside that range are malformed. An empty
document is the scalar null. A scalar, sequence, or mapping may be the root.

Only implicit Core tags and the explicit Core tags `!!map`, `!!seq`, `!!str`,
`!!null`, `!!bool`, `!!int`, and `!!float` are accepted. Custom and YAML 1.1 tags
are malformed. Merge keys are not enabled, so `<<` is an ordinary string key.

Every mapping key must resolve to a string and keys must be unique as strings.
Numeric, boolean, null, alias, and collection keys are malformed rather than
being converted to strings.

Anchors and aliases are accepted. An alias is expanded into an independent copy
of its target in the normalized tree. Cyclic, unresolved, or excessive alias
expansion is malformed; at most 100 alias expansions may be materialized by one
load. The expanded root is located at the alias, while its descendants retain
the locations of the anchored values.

Mapping entries and sequence items retain source order. A node's line and column
are one-based and point to the first character of that YAML value. The empty
document is at line 1, column 1. All values returned by queries are deep copies.

## Identity And Change

Configuration identity is content-addressed by notation and the SHA-256 digest
of the exact source text. Node identity is its configuration identity plus its
preorder position in the normalized tree. Consequently, two instances loading
the same text produce the same identities.

Loading the exact text and notation already current reports no change and keeps
all identities. Loading any different text reports a change even if comments or
formatting are the only differences. Loading a previously retained configuration
makes it current again with its original identities and reports a change.
Discarding removes that configuration and all its nodes. Reloading discarded
text recreates the same content-addressed identities.

Parsing and normalization are atomic. Unsupported notation, parser errors,
warnings, and normalization errors refuse the load without changing any state.

## State

```state
a set of Configurations with
  a source Text
  a digest Digest
  a notation Notation
  a root Node

a set of Nodes with
  a configuration Configuration
  an optional parent Node
  an optional key Key
  an optional index Number
  a kind Kind
  a value Value
  a line Number
  a column Number

an optional Current Configuration
```

Each mapping node has one child per key. Each sequence node has one child per
zero-based index. Scalar nodes have no children. `Kind` is `mapping`, `sequence`,
or `scalar`.

## Actions

```actions
load (source: Text, notation: Notation) : return (configuration: Configuration, root: Node, changed: Flag)
  where notation is not exactly yaml
  then
    refuse UNSUPPORTED_NOTATION "This configuration notation is not supported."
  where source is not in the normalized YAML subset
  then
    refuse MALFORMED_CONFIGURATION "This configuration document cannot be parsed."
  where this exact source and notation are current
  then
    return their configuration, root, and changed false
  where source is well formed and is not current
  then
    retain its configuration and tree if they are new
    make it the only current configuration
    return configuration, root, and changed true

discard (configuration: Configuration) : return (configuration: Configuration)
  where configuration is absent
  then
    refuse CONFIGURATION_NOT_FOUND "There is no such configuration."
  where configuration is present
  then
    remove it and all its nodes
    clear Current if it named this configuration
    return configuration
```

## Queries

```queries
_active () : optional (configuration: Configuration, root: Node)
_child (node: Node, key: Key) : optional (child: Node, kind: Kind, value: Value)
_at (node: Node, path: Keys) : optional (found: Node, kind: Kind, value: Value)
_scalar (node: Node, path: Keys, otherwise: Scalar) : optional (value: Scalar)
_values (node: Node, path: Keys, otherwise: Values) : optional (values: Values)
_entries (node: Node) : many (key: Key, child: Node, value: Value)
_items (node: Node) : many (index: Number, item: Node, value: Value)
_record (node: Node) : optional (values: Values)
_where (node: Node) : optional (line: Number, column: Number)
```

`_child` treats `key` literally, including dots. `_at` follows the supplied key
segments through mappings; an empty path finds `node` itself. Sequence items are
read with `_items`.

For a known starting node, `_scalar` returns `otherwise` when the path is absent
or does not end at a scalar. `_values` returns `otherwise` when the path is absent
or ends at a scalar; otherwise it returns the mapping or sequence value.
`_record` is present only for a mapping node.

Every query is absent for an unknown or discarded starting node. Queries that
require a mapping or sequence are also absent, or have no rows, when given the
wrong kind. Configuring assigns no meaning to any setting name.
