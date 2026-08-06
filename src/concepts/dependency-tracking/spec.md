# Dependency Tracking

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

## Types

```types
Subject = Text
  An opaque result key.

Input = Text
  An opaque dependency key in the same namespace as Subject.

State = "building" | "current" | "stale"
```

Text is a well-formed Unicode string. Subjects and inputs are opaque Text in one
shared namespace: an input may also be the subject of a result, which is how
invalidation travels from one result to another. DependencyTracking does not require an
input to have its own result.

Result and use identities are deterministic, collision-free encodings of their
keys. Repeated begins, repeated dependency records, and removeResult followed by beginAttempt reuse those
identities. Replacing a result's input set keeps its result identity; removing
one input and adding another removes the old use and returns a different use
identity.

A reason is the immediate input through which a result was first reached by the
invalidation that made it stale. Direct dependents therefore name the invalidated input;
transitive dependents name another result's subject. An already-stale result
keeps its earlier reason. A stale result keeps that reason while it is retried
and after it settles, so inspection can report why the latest recomputation
happened. Beginning a current result explicitly clears the previous reason.

## State

```state
a set of Results with
  a subject Subject
  a state State
  an optional reason Input
  an attempt PositiveInteger
  a settled Flag
  a provisionalInputs set of Input

a set of Uses with
  a result Result
  an input Input
```

## Actions

```actions
beginAttempt (subject: Subject) : return (result: Result, attempt: Number)
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

recordDependency (subject: Subject, attempt: Number, input: Input) : return (use: Use)
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

settleAttempt (subject: Subject, attempt: Number) : return (result: Result)
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

abandonAttempt (subject: Subject, attempt: Number) : return (result: Result)
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

invalidate (input: Input) : return (input: Input, count: Number)
  where input is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  then
    visit every direct and transitive dependent through Uses by shortest path, including through already-stale Results
    break equal-length paths by the reaching Input lowest in UTF-8 byte order
    set each visited result that is not stale to stale with the reaching input as its reason
    return input and how many results became stale

removeResult (subject: Subject) : return (result: Result)
  where subject is not Text
  then
    refuse INVALID_TEXT "Subjects and inputs must be well-formed text."
  then
    remove the result, its retained uses, and its active attempt if present
    do not mark dependent Results stale
    return the stable result identity whether or not the result was present
```

## Queries

```queries
_state (subject: Subject) : one (state: State)
  Returns stale for an unknown or non-Text Subject. This virtual answer means no
  current result exists and does not add a row to _stale. No query row contains
  a mutable value.

_current (subject: Subject) : optional (result: Result)
  Returns a row only for a current Result. An unknown or non-Text Subject, or a
  retained Result in another state, returns no row.

_attempt (subject: Subject) : optional (attempt: Number)
  Returns the attempt for every retained Result. An unknown or non-Text Subject
  returns no row.

_reason (subject: Subject) : optional (reason: Input)
  Returns a row only when the retained Result has a reason. An unknown or
  non-Text Subject returns no row.

_stale () : many (subject: Subject, reason: Input)
  Lists only stale Results that have a reason, in ascending UTF-8 byte order by
  subject.

_uses (subject: Subject) : many (input: Input)
  Returns the visible input graph. While a replacement is building or stale,
  this is the retained graph and excludes provisional inputs. Before the first
  settlement, it is the most recent attempt's inputs. Inputs are in ascending
  UTF-8 byte order. An unknown or non-Text Subject returns no rows.

_dependents (input: Input) : many (subject: Subject)
  Uses the same visible graph as _uses; invalidate follows this graph's transitive
  closure. Subjects are in ascending UTF-8 byte order. A non-Text Input returns
  no rows.
```

## Contracts

```contracts
contract result-and-use-keys
  At most one Result exists per Subject, and at most one Use exists per Result
  and Input.
```
