# Attending

## Purpose

Hold a process open until the operator running it asks it to stop, so a
long-running command ends on request instead of being killed mid-work.

## Principle

Ada starts a hold. Nothing returns while she leaves the process running.
She presses Ctrl-C; the hold ends and reports that it was interrupted. The
process is free to finish its own work before exiting. A later hold waits again,
because ending one hold does not end the ability to hold another.

## State

```state
a set of Holds with
  a state State
  an optional reason Reason
```

A hold is `holding` until it ends, then `released`. A reason is the operator's
request that ended it: `interrupt` or `terminate`. A hold that is still holding
has no reason.

Attending listens for the operator's stop request only while at least one hold
is holding, and stops listening once none is, so it never keeps a process alive
by itself.

## Actions

```actions
hold () : return (hold: Hold, reason: Reason)
  then
    wait until the operator interrupts or terminates this process
    release the hold and return which request ended it
```

`hold` answers only once the operator asks to stop, so nothing else is asked of
Attending in the meantime. That is the whole point of the concept: one ask, held
open, ended by the operator.

## Queries

```queries
_hold (hold: Hold) : optional (state: State, reason: OptionalReason)
_holding () : one (holding: Number)
```

Attending owns the operator's stop request and nothing else. It does not decide
what a process should do while held, what should be cleaned up afterwards, or
whether the process should exit.
