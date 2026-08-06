# Concept Specification Format

Each `spec.md` is the readable contract for one concept. It uses Markdown for
the document and small fenced notations for types, state, actions, queries, and
the few rules that do not fit an operation.

The sync engine parses action and query signatures and preserves their
reader-facing descriptions. It retains `Types` and `Contracts` as documentation
for tooling and generated read-back; `State` remains source-only. Keep every
notation regular, but prefer a short, clear statement over a more elaborate
schema.

## Sections

Use these sections in order:

1. `Purpose`
2. `Principle`
3. `Types`
4. `State`
5. `Actions`
6. `Queries`
7. `Contracts`, only when necessary

Do not add subject-specific second-level sections. Put value definitions in
`Types`, retained data in `State`, behavior in `Actions`, and query explanations
in `Queries`.

Every concept declares state, including a concept whose state is small. The
`State` section contains one Simple State Form (SSF) fence and no other prose.

## Shared Types

These types are available in every specification:

`Text`
: A well-formed Unicode string. Empty text is allowed unless a local type says
  otherwise.

`JavaScriptString`
: Any JavaScript string, including one containing lone surrogates.

`Flag`
: `true` or `false`.

`Bytes`
: A finite byte sequence. The type alone does not imply copying or ownership.

`Number`
: A finite JavaScript number. Use a local refinement when an integer, sign, or
  range is part of the contract.

`SafeInteger`, `NonnegativeInteger`, and `PositiveInteger`
: Safe integers with the indicated range.

`null` and `undefined`
: The corresponding JavaScript values.

`List<T>`
: A finite dense sequence. Order and duplicates are significant.

`Set<T>`
: A finite collection of distinct values. No order is implied.

`Map<K, V>`
: A finite mapping. A local definition supplies observable key and ordering
  rules.

These forms are distinct:

```text
value?: T         the field may be absent
T | null          the field is present and may be null
T | undefined     the field is present and may be undefined
```

On action input, an omitted field and a field whose value is `undefined` both
mean absence unless the action says otherwise.

An `optional` query returns zero or one row. It does not make the fields of a
returned row optional.

There are no shared `Source`, `Path`, `Address`, `Value`, or `Format` types.
Each concept defines the meaning it uses.

## Types

A `types` fence defines local scalar, parameter, record, collection, union, and
external types. A declaration begins at the left margin. Indented text is a
short semantic definition, not implementation commentary.

```types
Subject = parameter
  An opaque identity supplied by the application.

Status = "pending" | "complete"

Names = List<Text>

Location = record
  source: Text
  line?: PositiveInteger

Item = identity
  An opaque identity whose stability is defined by the local contract.

Handle = external
  A host handle retained until close returns.
```

`parameter` means an opaque value allocated outside the concept. `external`
means a host or library value whose relevant behavior is stated locally.
`identity` means an opaque concept value whose derivation is not exposed. Object
types introduced by SSF declarations are also identities and need not be
redeclared.

When a value grammar or fixed correspondence needs several paragraphs or a
table, put that explanation after the `types` fence in the same section. Keep
the declaration sufficient to identify the type being explained.

Define every other capitalized type used by state, actions, or queries. Use
semantic names when two concepts use a broad word differently. Name a repeated
or wide result row as a record; keep a short one-use row inline.

## State

State uses the SSF grammar described in [Concept State: Simple State
Form](https://github.com/61040-fa25/conceptbox/blob/main/design/background/detailed/concept-state.md).
For example:

```state
a set of Items with
  a name Text
  a status of PENDING or COMPLETE

an element Settings with
  an enabled Flag
```

Use `set` for a collection and `element` only for an exactly-one singleton. Use
`optional` for an optional scalar relation, `set of` for an unordered
multi-valued relation, and `seq of` for an ordered relation. Enumeration values
are uppercase.

SSF describes sets and relations, not storage containers or navigation costs.
Uniqueness beyond SSF multiplicity, identity stability, and other invariants go
in `Contracts` only when action behavior does not already make them clear.

## Actions

Actions retain the sync-engine notation:

```actions
write (subject: Subject, text: Text) : return (note: Note)
  where text is invalid
  then
    refuse INVALID_TEXT "A note must be well-formed text."
  then
    add a Note for subject with text
    return it
```

Write conditions, state changes, and returns in execution order. Branch order is
the validation order when more than one condition applies. State whether a
refusal changes state when it is not failure-atomic. Refusal codes and messages
are externally observable.

An `otherwise` line may introduce the final branch when naming its positive
condition would repeat every preceding condition. Its body follows directly;
do not add a second `then` line.

Keep lifecycle transitions in action bodies. A short explanation may precede
the fence when several branches share a grammar or external mechanism that would
otherwise be repeated.

## Queries

Each query has a signature followed by a short informal description:

```queries
_note (note: Note) : optional (subject: Subject, text: Text)
  Returns no row for an unknown Note.

_notes (subject: Subject) : many (note: Note, text: Text)
  Returns the Subject's Notes in creation order.
```

Describe lookup behavior, ordering, absence, copies, and relationships that the
signature cannot express. Do not repeat fields already visible in the
signature. Put a shared rule on the query where it matters first and refer to it
briefly from another query only when omission would be ambiguous.

Query bodies are contractual prose, not executable predicates. Implementation
and principle tests establish that the prose remains true.

`one` returns one row, `optional` returns zero or one row, and `many` returns
zero or more rows. Queries do not change state.

## Contracts

Use `Contracts` only for a testable rule that cannot be stated naturally by the
types, SSF state, actions, or query descriptions. Typical examples are a global
uniqueness invariant, identity stability across deletion, or an environmental
assumption shared by several operations.

```contracts
contract one-name-per-item
  No two Items have the same name.

contract stable-item-identity on remove, write
  Removing and recreating the same named Item preserves its identity.
```

The optional `on` list names the operations to which a contract applies. Keep
contracts short. Do not use them for responsibility boundaries, summaries, or
restatements of operation behavior.
