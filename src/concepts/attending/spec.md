# Attending

## Purpose

Hold long-running work until its operator asks the process to stop, so the work
can clean up instead of being terminated mid-transition.

## Principle

Ada starts a hold. It remains pending while she leaves the process alone. She
requests an interrupt; the hold is released and returns `interrupt`, and no
process listener remains. A later hold waits independently and returns
`terminate` when she makes that request.

## Types

```types
Reason = "interrupt" | "terminate"

State = "holding" | "released"
```

## State

```state
a set of Holds with
  a state State
  an optional reason Reason
```

## Actions

```actions
hold () : return (hold: Hold, reason: Reason)
  then
    add a holding Hold and install its independent interrupt and terminate listeners
    if listener setup faults, remove the attempted Hold and propagate the host failure
    wait for the first request received by those listeners
    make the Hold released, remove its listeners, and return the request Reason
```

## Queries

```queries
_hold (hold: Hold) : optional (state: State, reason: Reason | null)
  Returns no row for an unknown Hold and continues to return a row after
  release. The reason is null while the Hold is holding.

_holding () : one (holding: NonnegativeInteger)
  Reports the number of Holds in the holding state.
```
