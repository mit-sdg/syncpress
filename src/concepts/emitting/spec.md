# Emitting

## Purpose

Keep a destination holding exactly the intended files, without letting two
producers put different artifacts at one path or an unfinished replacement
disturb what is current.

## Principle

Ada points Emitting at a folder containing an old file. A producer opens an
attempt and stages two files. Nothing in the folder changes until the attempt
finishes; reconciling after it finishes writes both files and removes the old
one. A later attempt stages replacements and is abandoned; both earlier files
stay in place and its reserved paths become available immediately. A successful
attempt that names only one replaces that producer's complete set and lets the
other be removed. Two producers may share one path when their bytes agree, but
different bytes or a file-versus-directory overlap are refused. Retracting a
producer gives up all of its paths.

## Types

```types
Root = external
  A nonempty native host path supplied as Text. `direct` uses one Root as the
  destination and another distinct sibling Root as its transaction prefix.

Path = Text
  For an artifact, a platform-neutral logical path with one or more
  NFC-normalized Unicode segments separated by `/`. Each segment is nonempty,
  contains only Unicode scalar values, is neither `.` nor `..`, and contains no
  backslash, NUL, ASCII control character, or DEL. An absolute path or a path
  that climbs above the destination leaves it; a safe non-canonical spelling is
  invalid rather than normalized.

ObservedPath = JavaScriptString
  A relative path observed in a host destination. It need not be a canonical
  artifact Path.

Producer = Text
  An opaque well-formed Text identity.

Content = Bytes | Text
  Artifact bytes, or well-formed Text to encode as UTF-8.

Digest = Text
  The lowercase, 64-character hexadecimal SHA-256 digest of exact stored bytes.

Medium = Text
  Opaque, well-formed metadata retained for inspection; it does not affect
  stored bytes.

Kind = external
  The observed host kind of an existing non-directory destination entry.

Intent = identity
  A deterministic identity derived from Producer and Path.
```

Emitting copies byte content and UTF-8-encodes text content. Exact byte equality,
not digest equality, decides whether producers agree and whether a destination
file is current. No two paths in one active or staged set may be ancestors or
descendants. A stage may replace its producer's active file with descendants,
or active descendants with a file, because the active and staged sets do not
become current together.

Different claim identities under one Producer may share one Path only when
their bytes agree.

## State

```state
an element Publication with
  an optional destination Root
  an optional prefix Root

a set of ProducerStates with
  a producer Producer
  an attempt Number
  an open Flag

a set of Intents with
  an intent Intent
  a producer Producer
  a claim Text
  a path Path
  a content Bytes
  a digest Digest
  a medium Medium
  an attempt Number

a set of StagedIntents with
  an intent Intent
  a producer Producer
  a claim Text
  a path Path
  a content Bytes
  a digest Digest
  a medium Medium
  an attempt Number

a set of Emitted with
  a path ObservedPath
  a kind Kind
  an optional content Bytes
  an optional digest Digest
```

## Actions

```actions
direct (destination: Root, prefix: Root) : return (destination: Root, existing: Number)
  where destination or prefix is empty or malformed, destination is the filesystem root or an existing non-directory, or prefix is not a distinct sibling prefix
  then
    refuse INVALID_DESTINATION "A destination must name a directory other than the filesystem root."
  where destination cannot be inspected
  then
    refuse DESTINATION_UNAVAILABLE "The destination could not be inspected."
  where destination is absent or is an inspectable directory
  then
    leave an absent destination absent
    record every regular file and non-directory entry it currently holds
    replace the previously directed destination and transaction prefix only after inspection succeeds
    return destination and the number of recorded entries

begin (producer: Producer) : return (producer: Producer, attempt: Number)
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where producer's attempt is the greatest safe integer
  then
    refuse ATTEMPT_EXHAUSTED "This producer has no remaining safe attempt number."
  where producer is valid and has a remaining attempt number
  then
    add a producer record at attempt zero if none exists
    abandon any unfinished staged intents
    raise its attempt and open an empty staged set
    return producer and attempt

intend (producer: Producer, attempt?: Number, path: Path, content: Content, medium: Medium, claim?: Text | null) : return (intent: Intent, path: Path, digest: Digest)
  where producer, claim, path, content, and medium are valid, but producer has an open attempt not identified by attempt or has no open attempt and attempt is present
  then
    refuse STALE_ATTEMPT "This producer attempt is no longer active."
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where a present claim is not well-formed text
  then
    refuse INVALID_CLAIM "An artifact claim identity must be well-formed text."
  where path is absolute or climbs outside the destination
  then
    refuse PATH_LEAVES_DESTINATION "An artifact path must stay inside the destination."
  where path is not canonical
  then
    refuse INVALID_PATH "An artifact path must use the canonical portable form."
  where content is neither bytes nor well-formed text
  then
    refuse INVALID_CONTENT "Artifact content must be bytes or well-formed text."
  where medium is not well-formed text
  then
    refuse INVALID_MEDIUM "An artifact medium must be well-formed text."
  where another producer or a different claim from this producer reserves path with different bytes, or a reservation that would coexist with this intent overlaps path as an ancestor or descendant
  then
    refuse PATH_CONTESTED "This artifact path conflicts with another intended artifact."
  where the artifact does not conflict
  then
    add the producer at attempt zero if absent
    use producer as claim when claim is omitted, undefined, or null
    copy or encode content and compute its digest
    replace this producer's intent for path in its open stage, or in its active set when no attempt is open
    keep the intent identity for producer and path
    return intent, path, and digest

commit (producer: Producer, attempt: Number) : return (producer: Producer, dropped: Number)
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where producer has no open attempt
  then
    refuse NOT_BEGUN "This producer has no open attempt."
  where attempt does not identify the open attempt
  then
    refuse STALE_ATTEMPT "This producer attempt is no longer active."
  where producer has an open attempt
  then
    atomically replace its active intents with its staged intents
    close the attempt
    return producer and the number of formerly active paths omitted from the stage

abort (producer: Producer, attempt: Number) : return (producer: Producer, discarded: Number)
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where producer has no open attempt
  then
    refuse NOT_BEGUN "This producer has no open attempt."
  where attempt does not identify the open attempt
  then
    refuse STALE_ATTEMPT "This producer attempt is no longer active."
  where producer has an open attempt
  then
    delete every staged intent and release its reservation
    close the attempt without changing its number or any active intent
    return producer and the number of staged paths discarded

retract (producer: Producer) : return (producer: Producer, count: Number)
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where producer is valid
  then
    remove its producer record and every active or staged intent
    return producer and the number of distinct paths removed

reconcile () : return (written: Number, replaced: Number, kept: Number, removed: Number)
  where no destination has been directed
  then
    refuse DESTINATION_NOT_DIRECTED "No destination has been directed."
  where the complete intended tree cannot be prepared, installed, or restored
  then
    leave retained intent state unchanged and attempt to restore the prior destination
    refuse RECONCILIATION_FAILED "The intended destination tree could not be installed."
  where reconciliation succeeds
  then
    prepare one complete tree from the active intents
    install it in place of the destination
    leave each byte-equal regular file current, replace each other intended entry, and remove each unintended entry
    remove structural directories that no intended path needs
    set emitted to the active intended paths, bytes, and digests
    return the four artifact-entry counts
```

## Queries

```queries
_intent (path: Path) : optional (digest: Digest, medium: Medium)
  Reads active intents at the exact canonical Path and ignores staged intents.
  An invalid, noncanonical, or unreserved Path yields no row. Active Producers
  at one Path agree on exact bytes; when their media differ, the first Producer
  in ascending UTF-8 byte order supplies the medium. Emitting queries expose
  digests and metadata rather than retained content; none returns mutable Bytes.

_producers (path: Path) : many (producer: Producer)
  Reports active Producers whose exact, ancestor, or descendant reservation
  contests the exact canonical Path. Only when no active reservation contests
  it are staged Producers reported. Invalid Paths yield no rows; Producers are
  in ascending UTF-8 byte order.

_byProducer (producer: Producer) : many (path: Path, digest: Digest, medium: Medium)
  Reports only the Producer's active intents, in ascending UTF-8 byte order of
  Path. An invalid or unknown Producer yields no rows; staged intents are
  ignored.

_attempt (producer: Producer) : optional (attempt: Number)
  Reports the Producer's latest attempt number whether or not that attempt is
  open. An invalid or unknown Producer yields no row.

_open (producer: Producer) : optional (attempt: Number)
  Reports the latest attempt only while it is open. An invalid, unknown, or
  closed Producer yields no row.

_pending () : many (path: Path, digest: Digest)
  Lists active artifacts whose emitted entry is absent, non-regular, or differs
  in exact bytes, in ascending UTF-8 byte order of Path.

_orphans () : many (path: ObservedPath)
  Lists recorded destination entries with no active intent, in ascending UTF-8
  byte order of observed path.
```

## Contracts

```contracts
contract intent-keys
  At most one active and one staged Intent exist per Producer and Path. Active
  Producers may share a Path only when their exact bytes agree. Replacing,
  retracting, or recreating a pair preserves its Intent identity.

contract publication-installation on direct, reconcile
  `direct` records a destination only after complete inspection. `reconcile`
  prepares a complete sibling tree, serializes same-destination work in a
  process-local FIFO, and installs only after preparation and snapshot checks.
  Separate processes must not share a transaction prefix. Host failure may
  prevent restoration after the previous destination has moved.
```
