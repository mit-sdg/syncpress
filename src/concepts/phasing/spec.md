# Phasing

## Purpose

Carry one job through a declared sequence of phases, so that work in a later
phase can assume the work of every earlier phase is complete.

## Principle

A sequence is declared over ready, settings, read, route, excerpt, collect,
render, and emit. Declaring it again with the same phases reports no change. A
job is started on it in `once` mode and begins at ready, where nothing is
declared to happen. Advancing announces settings, then read, then route, and so
on. Advancing past emit finishes the job, and advancing a finished job is
refused. A second job started on the same sequence proceeds independently.
Abandoning a running job leaves it failed with a reason, and it announces no
further phase.

## State

```state
a set of Sequences with
  a name Name
  an ordered set of Phases

a set of Jobs with
  a sequence Sequence
  a mode Mode          -- once or live
  an optional phase Phase
  a state State        -- running, finished, or failed
  an optional reason Text
```

## Actions

```actions
declare (name: Name, phases: Phases) : return (sequence: Sequence, changed: Flag)
  where phases is empty
  then
    refuse NO_PHASES "A sequence needs at least one phase."
  where some sequence has name and these phases
  then
    return that sequence and changed false
  where phases is not empty and new or different
  then
    replace any sequence with name
    add a sequence with name and phases
    return sequence and changed true

start (sequence: Sequence, mode: Mode) : return (job: Job, phase: Phase, mode: Mode)
  where sequence not in sequences
  then
    refuse SEQUENCE_NOT_FOUND "There is no such sequence."
  where sequence in sequences
  then
    add a running job with sequence, mode, and its first phase
    return job, phase, and mode

advance (job: Job) : return (job: Job, phase: Phase, mode: Mode)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where job is running and has a later phase
  then
    set its phase to the next one
    return job, phase, and mode
  where job is running and has no later phase
  then
    set its state to finished
    return job, its last phase, and mode

abandon (job: Job, reason: Text) : return (job: Job, reason: Text)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where job is running
  then
    set its state to failed with reason
    return job and reason
```

## Queries

```queries
_job (job: Job) : one (phase: Phase, state: State, mode: Mode)
_running () : many (job: Job, phase: Phase, mode: Mode)
_outcome (job: Job) : optional (state: State, reason: Text)
```

Phasing announces a phase; it does not detect that a phase's work is done. The
host asks for the next phase only after the previous announcement's work has
settled.
