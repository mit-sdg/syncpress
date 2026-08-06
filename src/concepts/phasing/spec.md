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

## Types

```types
Name = Text
Phase = Text

Phases = List<Phase>
  An ordinary dense phase plan.

State = "running" | "finished" | "failed"

PhaseAttempt = identity
  The opaque identity of one announced phase of one Job.
```

Text is a well-formed Unicode string. A phase plan is an ordinary dense list of
Text values with no extra properties. A sequence has at least one phase, and a
phase occurs at most once in its sequence.

Sequence and Job values are opaque identities. A Sequence identity is a
deterministic encoding of its Name and survives redeclaration. A PhaseAttempt is
a deterministic encoding of its Job and phase index. The result of `advance`
contains either the next Phase and its PhaseAttempt or `null` for both. `null`
means that the Job has finished and cannot trigger phase work.

## State

```state
a set of Sequences with
  a name Name
  a phases seq of Phase
  an optional running Job
  an optional latest Job

a set of Jobs with
  a sequence Sequence
  a phases seq of Phase
  a currentPhase Phase
  a currentAttempt PhaseAttempt
  a startOrder Number
  a state State
  an optional reason Text
  a settlements set of Settlements

a set of Settlements with
  an attempt PhaseAttempt
  an optional nextPhase Phase
  an optional nextAttempt PhaseAttempt
```

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

advance (job: Job, attempt: PhaseAttempt) : return (job: Job, name: Name, phase: Phase | null, attempt: PhaseAttempt | null, transitioned: Flag)
  where attempt was already settled for job
  then
    return its recorded next phase and attempt with transitioned false
  where job is unknown, finished, or failed
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where attempt is not the running job's current attempt
  then
    refuse STALE_ATTEMPT "This phase attempt is not current."
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
  Returns no row for an unknown or non-Text Job. A terminal Job retains its last
  announced Phase and PhaseAttempt.

_running (sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)
  Returns no row for an unknown or malformed Sequence, or when the Sequence has
  no running Job.

_latest (sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)
  Returns no row for an unknown or malformed Sequence. The latest Job remains
  present after it finishes or fails.

_outcome (job: Job) : optional (state: State, reason?: Text)
  Returns no row for an unknown, malformed, or running Job. A finished row omits
  `reason`; a failed row includes it.
```

## Contracts

```contracts
contract sequence-name
  No two Sequences have the same Name.
```
