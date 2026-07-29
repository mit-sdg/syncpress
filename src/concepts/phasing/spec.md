# Phasing

## Purpose

Move a job through a named list of steps in order, so each step starts only
after the earlier steps are done.

## Principle

Ada declares a sequence containing draft, review, and publish. Declaring the
same sequence again reports no change. Two jobs start at draft and can move
independently. One advances to review and then publish; advancing once more
finishes it without announcing publish again, and another advance is refused.
Ada abandons the other job with a reason, leaving it failed and unable to move.

## Values

Text is a well-formed Unicode string. A phase plan is an ordinary dense list of
Text values with no extra properties. A sequence has at least one phase, and a
phase occurs at most once in its sequence. A Mode is `once` or `live`; Phasing
carries the mode but does not give it behavior.

The result of `advance` contains either the next Phase or null. Null means that
the job has finished and, because it is not a Phase, cannot trigger phase work.

## State

```state
a set of Sequences with
  a unique name Name
  an ordered list of distinct Phases

a set of Jobs with
  a sequence Sequence
  a snapshot of its sequence's Phases
  a current phase Phase
  a start order Number
  a mode Mode          -- once or live
  a state State        -- running, finished, or failed
  an optional reason Text
```

A sequence identity is a deterministic encoding of its name. Redeclaration
keeps that identity. A job snapshots the phases when it starts, so changing the
named sequence affects later jobs but cannot redirect one already running.

## Actions

```actions
declare (name: Name, phases: Phases) : return (sequence: Sequence, changed: Flag)
  where name is not Text
  then
    refuse INVALID_TEXT "Sequence names and failure reasons must be well-formed text."
  where phases is not an ordinary dense list of Text values
  then
    refuse INVALID_PHASES "Phases must be an ordinary dense list of text values."
  where phases is empty
  then
    refuse NO_PHASES "A sequence needs at least one phase."
  where a phase occurs more than once
  then
    refuse PHASE_REPEATED "A phase may occur only once in a sequence."
  where a sequence has name and equal phases in equal order
  then
    return that sequence and changed false
  where the named sequence is new or has different phases
  then
    add or replace it, preserving its identity
    return sequence and changed true

start (sequence: Sequence, mode: Mode) : return (job: Job, phase: Phase, mode: Mode)
  where sequence is not a current sequence
  then
    refuse SEQUENCE_NOT_FOUND "There is no such sequence."
  where mode is neither once nor live
  then
    refuse UNKNOWN_MODE "A job mode must be once or live."
  where sequence and mode are valid
  then
    add a running job with a snapshot of the phases and their first phase current
    return the new job, first phase, and mode

advance (job: Job) : return (job: Job, phase: PhaseOrNull, mode: Mode)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where job is running and has a later phase
  then
    make the next phase current
    return job, that phase, and mode
  where job is running at its last phase
  then
    make it finished
    return job, null, and mode

abandon (job: Job, reason: Text) : return (job: Job, reason: Text)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where job is running and reason is not Text
  then
    refuse INVALID_TEXT "Sequence names and failure reasons must be well-formed text."
  where job is running and reason is Text
  then
    make it failed with reason
    return job and reason
```

## Queries

```queries
_job (job: Job) : optional (phase: Phase, state: State, mode: Mode)
_running () : many (job: Job, phase: Phase, mode: Mode)
_outcome (job: Job) : optional (state: State, reason: Text)
```

`_job` is absent for an unknown job. `_running` lists running jobs in start
order. `_outcome` is absent for an unknown or running job; a finished row omits
`reason`, while a failed row includes it.

Each successful `advance` is a transition, not an idempotent retry: it moves one
phase or completes the last one. `declare` is idempotent for an equal plan.
Starting always creates a new independent job.

Phasing announces steps and records outcomes. It does not run step work, decide
that work has settled, limit how many jobs may run, or cancel outside work. The
caller advances only after the announced step has settled and owns any retry or
single-job policy.
