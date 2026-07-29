# Layering

## Purpose

Resolve one record from ranked contributions, so values can be defaulted,
overridden, and explained afterwards.

## Principle

Ada contributes a broad default at rank 0, a narrower default at rank 1, and a
page's attributes at rank 1000000. Resolution retains the page title, takes the
narrower template, and merges nested mappings. Sequences and scalars replace.
The template's origin identifies rank 1. Withdrawing that rank restores the
broad template; a duplicate rank and an absent withdrawal are refused.

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
  where rank is already contributed for subject
  then
    refuse RANK_TAKEN "This record already has a contribution at this rank."
  where rank is available
  then
    add the ranked contribution

withdraw (subject: Subject, rank: Number) : return (layer: Layer)
  where rank is absent
  then
    refuse NO_SUCH_LAYER "This record has no contribution at this rank."
  where rank is present
  then
    remove it

clear (subject: Subject) : return (subject: Subject, count: Number)
  then
    remove every contribution for subject
```

## Queries

```queries
_resolved (subject: Subject) : one (values: Values)
_value (subject: Subject, key: Key) : optional (value: Value)
_flag (subject: Subject, key: Key, otherwise: Flag) : one (value: Flag)
_holds (subject: Subject, key: Key, value: Value) : one (present: Flag, equal: Flag, contains: Flag)
_origin (subject: Subject, key: Key) : optional (rank: Number, layer: Layer)
_layers (subject: Subject) : many (rank: Number, values: Values)
```

Layering does not decide where contributions come from or what a resolved
record controls.
