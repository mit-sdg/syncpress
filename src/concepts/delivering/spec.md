# Delivering

## Purpose

Coordinate one aggregate task answer with failures already delivered at its boundary,
so settlement cannot race a second terminal answer.

## Principle

Ada begins delivery for one task. An interruption records that another failure path
already answered it; repeating the interruption changes nothing. Settling returns
that interrupted result and closes the delivery. Another task remains independent.
An interruption that arrives just before its begin is retained, so consequence
ordering cannot erase an already delivered failure.

## Types

```types
Task = Text
  An opaque delivery task identity.
```

## State

```state
a set of Deliveries with
  a task Task
  an active Flag
  an interrupted Flag
```

## Actions

```actions
begin (task: Task) : return (task: Task, changed: Flag)
  where task is not Text
  then
    refuse INVALID_TASK "A delivery task must be a well-formed text identity."
  where task already has an active delivery
  then
    return task and changed false
  then
    add or activate its delivery without clearing an earlier interruption
    return task and changed true

interrupt (task: Task) : return (task: Task, changed: Flag)
  where task is not Text
  then
    refuse INVALID_TASK "A delivery task must be a well-formed text identity."
  where task is already interrupted
  then
    return task and changed false
  then
    add or interrupt its delivery and return task and changed true

settle (task: Task) : return (task: Task, interrupted: Flag)
  where task is not Text
  then
    refuse INVALID_TASK "A delivery task must be a well-formed text identity."
  where task has no active delivery
  then
    refuse DELIVERY_NOT_ACTIVE "This task has no active aggregate delivery."
  then
    remove and return its delivery result
```

## Queries

```queries
_delivery (task: Task) : optional (active: Flag, interrupted: Flag)
  Returns no row when the Task has no retained Delivery, including after
  `settle`.
```

## Contracts

```contracts
contract one-delivery-per-task
  At most one delivery exists per task.
```
