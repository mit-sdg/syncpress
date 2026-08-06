# Depending

## Purpose

Remember what each piece of work used, so a change marks only the work that must
be done again and can explain why.

## Principle

Ada starts a result, notes the things she uses, and finishes it. It is now up to
date. When one of those things changes, the result needs doing again and
remembers what changed; unrelated results stay up to date. Anything that used
that result needs doing again too, however many results the change passes
through. An unfinished result is marked as well, so it can be retried.

After a result has settled, its last successful input graph remains in force
through a later replacement attempt. Inputs noted by that replacement are
provisional and replace the retained graph only if that attempt settles. A
stale, restarted, or incomplete replacement therefore cannot discard
last-known-good edges. Before a result has settled for the first time, its most
recent attempt is its only graph and can be marked stale. An input can be noted
while its result is being worked on or after it is current. A use that arrives
after settlement extends the retained graph without reopening an attempt; this
allows independently scheduled tracking reactions to finish after the reaction
that settles the result.

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

A result retains the Uses from its latest successful settlement. While a later
attempt is building, it also collects a separate set of provisional inputs.
Until the attempt settles, those provisional inputs are not Uses and do not
participate in dependency traversal. A result with no successful settlement
instead exposes the inputs from its most recent attempt as its Uses, so its
first attempt can be invalidated. Starting another attempt discards that
unsettled input set. A use received while a result is current is added directly
to its retained Uses; it does not start or alter an attempt.

## Actions

```actions
begin (subject: Subject) : return (result: Result, attempt: Number)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result has subject
  then
    add a result with no uses or reason, start an empty attempt, set it to building, and return it
  where a result has subject
  and its attempt number is exhausted
  then
    refuse ATTEMPT_EXHAUSTED "No further computation attempt can be represented."
  where a result has subject and another attempt can be represented
  then
    discard its uncommitted attempt, retain its uses from the latest settlement if any,
    clear its reason if it was current, start an empty attempt, set it to building, and return it

use (subject: Subject, attempt: Number, input: Input) : return (use: Use)
  where subject or input is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result for subject is building or current
  then
    refuse NOT_BUILDING "This result is not being computed."
  where attempt is not the result's current attempt
  then
    refuse STALE_ATTEMPT "This computation attempt is no longer active."
  where a result for subject is building
  then
    add input to its active attempt if none exists and return its use
  where a result for subject is current
  then
    add input to its retained uses if none exists and return its use

settle (subject: Subject, attempt: Number) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result for subject is building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where attempt is not the result's current attempt
  then
    refuse STALE_ATTEMPT "This computation attempt is no longer active."
  where a result for subject is building
  then
    replace its retained uses atomically with its active attempt's inputs, set it to current,
    retain its reason, and return it

abandon (subject: Subject, attempt: Number) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  where no result for subject is building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where attempt is not the result's current attempt
  then
    refuse STALE_ATTEMPT "This computation attempt is no longer active."
  where a result for subject is building
  then
    discard its provisional inputs, retain its last successful graph, and make it stale
    return it

touch (input: Input) : return (input: Input, count: Number)
  where input is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  then
    visit every direct and transitive dependent through uses, including through already-stale results
    set each visited result that is not stale to stale with the reaching input as its reason
    return input and how many results became stale

drop (subject: Subject) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  then
    remove the result, its retained uses, and its active attempt if present
    return the stable result identity whether or not the result was present
```

## Queries

```queries
_state (subject: Subject) : one (state: State)
_current (subject: Subject) : optional (result: Result)
_attempt (subject: Subject) : optional (attempt: Number)
_reason (subject: Subject) : optional (reason: Input)
_stale () : many (subject: Subject, reason: Input)
_uses (subject: Subject) : many (input: Input)
_dependents (input: Input) : many (subject: Subject)
```

`_state` answers `stale` for an unknown or non-Text subject. This is a virtual
answer meaning that no current result exists; it does not add a row to `_stale`.
The other subject lookups answer no row for an unknown or non-Text subject, and
input lookup answers no rows for a non-Text input. `_current` is present only for
a current result. `_uses` and `_dependents` show the retained graph while a
replacement is building or stale; they do not expose its provisional inputs.
Before first settlement, they show the most recent attempt's inputs. `touch`
follows the same graph's transitive closure.

All many queries use ascending UTF-8 byte order: `_stale` by subject, `_uses` by
input, and `_dependents` by subject. `touch` proceeds by shortest path. If two
paths of the same length first reach one result, the reaching input lowest in
UTF-8 byte order becomes its reason. Cycles terminate, diamonds mark each result
once, and the count includes only results whose state changed to stale.

Depending records relationships and condition, not what a result means, when an
input should be touched, or how work is redone. `drop` does not itself invalidate
results that use the dropped subject; a caller that treats removal as a change
touches that subject separately.
