# Emitting

## Purpose

Make a destination hold exactly the artifacts intended: write new bytes, replace
changed bytes, keep current bytes, and remove files no producer still intends.

## Principle

Ada directs a destination containing an old file. One producer begins an
attempt and intends two files while another intends a third. Reconciliation
writes the intended files and removes the old one. A second producer may share
an intended path with identical bytes, but different bytes are refused. A later
attempt keeps the previous attempt's untouched intents until it commits, then
drops them. Retracting a producer removes every one of its intents.

## State

```state
a Destination Root

a set of Producers with
  a producer Producer
  an attempt Number

a set of Intents with
  a producer Producer
  a path Path
  a content Bytes
  a digest Digest
  a medium Medium
  an attempt Number

a set of Emitted with
  a path Path
  a digest Digest
```

## Actions

```actions
direct (destination: Root) : return (destination: Root, existing: Number)
  then
    record the files already in the destination as emitted

begin (producer: Producer) : return (producer: Producer, attempt: Number)
  then
    raise the producer's attempt

intend (producer: Producer, path: Path, content: Bytes, medium: Medium) : return (intent: Intent, path: Path, digest: Digest)
  where path leaves the destination
  then
    refuse PATH_LEAVES_DESTINATION "An output path must stay inside the destination."
  where another producer intends path with a different digest
  then
    refuse PATH_CONTESTED "Another producer intends different content at this path."
  where no producer disagrees about path
  then
    replace this producer's intent for path

commit (producer: Producer) : return (producer: Producer, dropped: Number)
  where producer has no record
  then
    refuse NOT_BEGUN "This producer has opened no attempt."
  where producer has a record
  then
    drop intents from its earlier attempts

retract (producer: Producer) : return (producer: Producer, count: Number)
  then
    remove the producer and all of its intents

reconcile () : return (written: Number, replaced: Number, kept: Number, removed: Number)
  then
    reconcile the actual destination with the intended paths
```

## Queries

```queries
_intent (path: Path) : optional (digest: Digest, medium: Medium)
_producers (path: Path) : many (producer: Producer)
_byProducer (producer: Producer) : many (path: Path, digest: Digest, medium: Medium)
_attempt (producer: Producer) : optional (attempt: Number)
_pending () : many (path: Path, digest: Digest)
_orphans () : many (path: Path)
```

Emitting owns destination reconciliation and output-path containment. It does
not decide what a producer is or why it intends an artifact.
