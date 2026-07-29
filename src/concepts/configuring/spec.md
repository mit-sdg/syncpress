# Configuring

## Purpose

Turn one declarative configuration document into an addressable settings tree,
so later behavior reads settings without depending on the notation that wrote
them.

## Principle

Ada loads a YAML document. Its `site.title` value is available by dotted key,
and the rules under `defaults` retain their written order and source locations.
Loading the same source reports no change and preserves the active tree.
Loading different source replaces the active configuration. Malformed YAML and
unsupported notation are refused without replacing the configuration.

## State

```state
a set of Configurations with
  a source Text
  a digest Digest
  a notation Notation
  a root Node

a set of Nodes with
  an optional parent Node
  an optional key Key
  an optional index Number
  a kind Kind
  an optional value Value
  a line Number
  a column Number
```

## Actions

```actions
load (source: Text, notation: Notation) : return (configuration: Configuration, root: Node, changed: Flag)
  where notation is unsupported
  then
    refuse UNSUPPORTED_NOTATION "This configuration notation is not supported."
  where source is malformed
  then
    refuse MALFORMED_CONFIGURATION "This configuration document cannot be parsed."
  where source is well formed
  then
    make its configuration active and report whether it changed

discard (configuration: Configuration) : return (configuration: Configuration)
  where configuration is absent
  then
    refuse CONFIGURATION_NOT_FOUND "There is no such configuration."
  where configuration is present
  then
    remove its tree
```

## Queries

```queries
_active () : optional (configuration: Configuration, root: Node)
_child (node: Node, key: Key) : optional (child: Node, kind: Kind, value: Value)
_scalar (node: Node, key: Key, otherwise: Value) : one (value: Value)
_values (node: Node, key: Key, otherwise: Values) : one (values: Values)
_entries (node: Node) : many (key: Key, child: Node, value: Value)
_items (node: Node) : many (index: Number, item: Node, value: Value)
_record (node: Node) : one (values: Values)
_where (node: Node) : one (line: Number, column: Number)
```

Configuring owns parsing and source locations. It does not assign meaning to
`site`, `defaults`, or any other setting name.
