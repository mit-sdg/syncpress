# Depending

## Purpose

Record what each result used, so a changed input invalidates precisely its
dependents and each stale result can explain why it must be recomputed.

## Principle

Ada begins a page result, records its source, layout, and a collection, then
settles it. Touching the layout makes the page stale and names the layout as the
reason. An unrelated input changes nothing. A second result that uses the page
is made stale transitively. Beginning the page again clears its old uses.

## State

```state
a set of Results with
  a subject Subject
  a state State
  an optional reason Input

a set of Uses with
  a result Result
  an input Input
```

## Actions

```actions
begin (subject: Subject) : return (result: Result)
  then
    clear prior uses and make the result building

use (subject: Subject, input: Input) : return (use: Use)
  where subject is not building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where subject is building
  then
    record the input

settle (subject: Subject) : return (result: Result)
  where subject is not building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where subject is building
  then
    make it current

touch (input: Input) : return (input: Input, count: Number)
  then
    make direct and transitive dependents stale

drop (subject: Subject) : return (result: Result)
  then
    remove the result and its uses
```

## Queries

```queries
_state (subject: Subject) : one (state: State)
_current (subject: Subject) : optional (result: Result)
_reason (subject: Subject) : optional (reason: Input)
_stale () : many (subject: Subject, reason: Input)
_uses (subject: Subject) : many (input: Input)
_dependents (input: Input) : many (subject: Subject)
```

Depending records relationships, not how a result is recomputed.
