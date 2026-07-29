# Depending

## Purpose

Remember what each piece of work used, so a change marks only the work that must
be done again and can explain why.

## Principle

Ada starts a result, notes the things she uses, and finishes it. It is now up to
date. When one of those things changes, the result needs doing again and
remembers what changed; unrelated results stay up to date. Anything that used
that result needs doing again too, however many results the change passes
through. An unfinished result is marked as well, so it can be retried. Starting
again replaces the old list of things used, and after it finishes it still
remembers why it was redone. An input can be noted only while its result is being
worked on.

## Text, Identity, And Reasons

Text is a well-formed Unicode string. Subjects and inputs are opaque Text in one
shared namespace: an input may also be the subject of a result, which is how
invalidation travels from one result to another. Depending does not require an
input to have its own result.

At most one result exists for a subject and at most one use exists for a result
and input. Result and use identities are deterministic, collision-free encodings
of their keys. Repeated beginnings, repeated uses, and drop followed by begin
reuse those identities. Replacing a result's input set keeps its result identity;
removing one input and adding another removes the old use and returns a different
use identity.

A reason is the immediate input through which a result was first reached by the
touch that made it stale. Direct dependents therefore name the touched input;
transitive dependents name another result's subject. An already-stale result
keeps its earlier reason. A stale result keeps that reason while it is retried
and after it settles, so inspection can report why the latest recomputation
happened. Beginning a current result explicitly clears the previous reason.

## State

```state
a set of Results with
  a unique subject Subject
  a state State                 -- building, current, or stale
  an optional reason Input

a set of Uses with
  a result Result
  an input Input
```

## Actions

```actions
begin (subject: Subject) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result has subject
  then
    add a result with no uses or reason, set it to building, and return it
  where a result has subject
  then
    delete its uses, clear its reason if it was current, set it to building, and return it

use (subject: Subject, input: Input) : return (use: Use)
  where subject or input is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result for subject is building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where a result for subject is building
  then
    add a use with result and input if none exists and return it

settle (subject: Subject) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result for subject is building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where a result for subject is building
  then
    set it to current, retain its reason, and return it

touch (input: Input) : return (input: Input, count: Number)
  where input is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  then
    visit every direct and transitive dependent, including through already-stale results
    set each visited result that is not stale to stale with the reaching input as its reason
    return input and how many results became stale

drop (subject: Subject) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  then
    remove the result and its uses if present
    return the stable result identity whether or not the result was present
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

`_state` answers `stale` for an unknown or non-Text subject. This is a virtual
answer meaning that no current result exists; it does not add a row to `_stale`.
The other subject lookups answer no row for an unknown or non-Text subject, and
input lookup answers no rows for a non-Text input. `_current` is present only for
a current result. `_dependents` lists direct dependents; `touch` follows their
transitive closure.

All many queries use ascending UTF-8 byte order: `_stale` by subject, `_uses` by
input, and `_dependents` by subject. `touch` proceeds by shortest path. If two
paths of the same length first reach one result, the reaching input lowest in
UTF-8 byte order becomes its reason. Cycles terminate, diamonds mark each result
once, and the count includes only results whose state changed to stale.

Depending records relationships and condition, not what a result means, when an
input should be touched, or how work is redone. `drop` does not itself invalidate
results that use the dropped subject; a caller that treats removal as a change
touches that subject separately.
