# Phasing

## Purpose

Move a job through a named list of barriers in order, advancing only from the
exact announced phase attempt so settlement retries cannot skip work.

## Principle

Ada declares a sequence containing draft, review, and publish. Declaring the
same sequence again reports no change. She starts one job at draft; a second job
for that sequence is refused while it runs. Settling draft with its exact
attempt announces review. Retrying that attempt returns review without
announcing another transition, while another attempt is refused as stale. Ada
settles review and publish, then may start a replacement job. A job in another
sequence moves independently. She abandons that job with its current attempt
and a reason, leaving it failed and unable to move.

## Values

Text is a well-formed Unicode string. A phase plan is an ordinary dense list of
Text values with no extra properties. A sequence has at least one phase, and a
phase occurs at most once in its sequence.

A PhaseAttempt is the opaque identity of one announced phase of one job. The
result of `advance` contains either the next Phase and its PhaseAttempt or null
for both. Null means that the job has finished and cannot trigger phase work.

## State

```state
a set of Sequences with
  a unique name Name
  an ordered list of distinct Phases

a set of Jobs with
  a sequence Sequence
  a snapshot of its sequence's Phases
  a current phase Phase
  a current phase attempt PhaseAttempt
  a start order Number
  a state State        -- running, finished, or failed
  an optional reason Text
  settled phase attempts and their returned next phase and attempt

at most one running Job for each Sequence
at most one latest Job for each Sequence
```

A sequence identity is a deterministic encoding of its name. Redeclaration
keeps that identity. A job snapshots the phases when it starts, so changing the
named sequence affects later jobs but cannot redirect one already running. A
phase-attempt identity is a deterministic encoding of its job and phase index.

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

start (sequence: Sequence) : return (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)
  where sequence is not a current sequence
  then
    refuse SEQUENCE_NOT_FOUND "There is no such sequence."
  where sequence already has a running job
  then
    refuse SEQUENCE_ACTIVE "This sequence already has a running job."
  then
    add a running job with a snapshot of the phases and their first phase current
    make it the latest job for the sequence
    return the new job, sequence name, first phase, and its exact phase attempt

advance (job: Job, attempt: PhaseAttempt) : return (job: Job, name: Name, phase: PhaseOrNull, attempt: PhaseAttemptOrNull, transitioned: Flag)
  where job is unknown, finished, or failed and attempt is not an already settled attempt
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where attempt is not the running job's current attempt
  then
    refuse STALE_ATTEMPT "This phase attempt is not current."
  where attempt was already settled
  then
    return its recorded next phase and attempt with transitioned false
  where attempt is current and a later phase exists
  then
    make the next phase and its attempt current
    record this settlement
    return job, next phase and attempt, and transitioned true
  where attempt is current at the last phase
  then
    make the job finished and record this settlement
    return job, null phase and attempt, and transitioned true

abandon (job: Job, attempt: PhaseAttempt, reason: Text) : return (job: Job, reason: Text)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where attempt is not the running job's current attempt
  then
    refuse STALE_ATTEMPT "This phase attempt is not current."
  where reason is not Text
  then
    refuse INVALID_TEXT "Sequence names and failure reasons must be well-formed text."
  then
    make the job failed with reason and return job and reason
```

## Queries

```queries
_job (job: Job) : optional (sequence: Sequence, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)
_running (sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)
_latest (sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)
_outcome (job: Job) : optional (state: State, reason: OptionalText)
```

`_job` is absent for an unknown job. `_running` lists the sequence's running job.
`_latest` remains present after that job finishes or fails. `_outcome` is absent
for an unknown or running job; a finished row omits `reason`, while a failed row
includes it.

Only a successful `advance` with `transitioned true` announces another phase.
Retrying a settled attempt is observationally idempotent. Phasing records exact
barrier settlement but does not run phase work or decide that outside work has
settled; the caller reports settlement only after that work becomes quiescent.
