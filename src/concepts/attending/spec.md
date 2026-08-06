# Attending

## Purpose

Hold long-running work until its operator asks the process to stop, so the work
can clean up instead of being terminated mid-transition.

## Principle

Ada starts a hold. It remains pending while she leaves the process alone. She
requests an interrupt; the hold is released and returns `interrupt`, and no
process listener remains. A later hold waits independently and returns
`terminate` when she makes that request.

## State

```state
a set of Holds with
  a state State
  an optional reason Reason
```

A hold starts `holding` and remains retained as `released` after an `interrupt`
or `terminate` request. Every active hold listens independently; one process
request releases every active hold whose listener receives it. Listener setup
failure faults and removes the attempted hold.

## Actions

```actions
hold () : return (hold: Hold, reason: Reason)
  then
    wait until the operator interrupts or terminates the process
    release the hold, remove its listeners, and return the request that ended it
```

## Queries

```queries
_hold (hold: Hold) : optional (state: State, reason: OptionalReason)
_holding () : one (holding: Number)
```

Attending owns the lifecycle of process stop holds. It does not decide what work
runs while held, what cleanup follows release, what a command means, or whether
the process should exit.
