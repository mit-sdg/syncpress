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

## Content, Paths, And Identity

Every artifact is stored as bytes. `intend` accepts either bytes, which are
copied, or well-formed text, which is encoded as UTF-8. Its digest is the
lowercase, 64-character hexadecimal SHA-256 digest of those exact stored bytes.
Byte equality, not digest equality, decides whether two producers agree and
whether a destination file is already current. `medium` is opaque metadata for
inspection and does not change the bytes written.

An artifact path is a platform-neutral logical path, not a native filesystem
path. It is one or more NFC-normalized Unicode segments separated by `/`. Every
segment is non-empty, consists only of Unicode scalar values, is neither `.` nor
`..`, and contains no backslash, NUL, ASCII control character, or DEL. An
absolute path or a path that climbs above the destination leaves it. A safe but
non-canonical spelling is invalid rather than normalized. No two paths in one
active or staged set may be ancestors or descendants, because a destination
cannot hold both a file and a directory there. A new stage may replace its own
producer's active file with descendants, or its active descendants with a file,
because those two sets never become active together.

Each `(producer, path)` pair has one deterministic, collision-free intent
identity. Replacing its bytes keeps that identity; retracting and later
recreating the pair may recreate it. Producer identities are supplied and are
never interpreted. A Claim is an optional well-formed text identity naming the
logical source of one intent. When omitted it is the Producer. Different Claims
under one Producer may share one path only when their bytes agree, which lets a
transactional producer distinguish same-page logical output collisions without
changing its atomic attempt boundary.

## Attempts And Reconciliation

An intent made outside an attempt becomes active immediately. This is useful for
a producer that independently maintains one path. `begin` instead opens a
complete replacement attempt: its intents are staged, active intents remain
unchanged, and starting another attempt abandons the unfinished stage. `commit`
atomically makes the staged set that producer's whole active set. An empty
committed attempt therefore drops all of its active intents. A producer that
recomputes a set of paths must use an attempt so an omission has meaning.

`abort` explicitly abandons an open attempt. It discards only that stage, closes
the attempt, and releases every staged reservation while leaving active intents
and destination state untouched. The latest attempt number remains recorded, so
the next `begin` advances rather than reusing an aborted number.

Staged intents reserve their paths for collision detection but are absent from
artifact queries and reconciliation until committed; only `_producers` reports
their reservation ownership. This guarantees that an unfinished attempt cannot
add, replace, or remove any destination artifact. Attempt zero is the initial,
direct-intent state; `_attempt` reports the latest number whether or not an
attempt is currently open.

`direct` only inspects a destination; an absent destination is not created until
reconciliation. It records every regular file and non-directory entry already
there. Reconciliation re-inspects the destination, prepares the complete
intended tree beside it, and installs that tree only after preparation succeeds.
If preparation or installation is refused, the prior tree is restored. This
makes a successful reconciliation an all-or-nothing publication action rather
than a sequence that first deletes stale files. Structural directories are
created exactly as needed and empty directories are removed. The four returned
counts concern artifact entries, not structural directories.

All many-result queries answer in ascending UTF-8 byte order: paths by path and
producers by producer. `_producers(path)` includes active and staged producers
whose exact, ancestor, or descendant reservation would contest that path for
another producer. It answers active owners when any exist and otherwise staged
owners, so ordinary inspection is committed while a refusal can still identify
a staged incumbent. If agreeing active producers state different media,
`_intent` uses the medium of the first producer in that order, making inspection
stable.

## State

```state
an optional Destination Root

a set of Producers with
  a producer Producer
  an attempt Number
  an open Flag

a set of Intents with
  an intent Intent
  a producer Producer
  a path Path
  a content Bytes
  a digest Digest
  a medium Medium
  an attempt Number

a set of Staged Intents with
  an intent Intent
  a producer Producer
  a path Path
  a content Bytes
  a digest Digest
  a medium Medium
  an attempt Number

a set of Emitted with
  a path Path
  a kind Kind
  an optional content Bytes
  an optional digest Digest
```

At most one producer record exists per producer. At most one active and one
staged intent exist per producer and path. Several producers may actively intend
one path only when their exact bytes agree.

## Actions

```actions
direct (destination: Root) : return (destination: Root, existing: Number)
  where destination is empty, malformed, the filesystem root, or an existing non-directory
  then
    refuse INVALID_DESTINATION "A destination must name a directory other than the filesystem root."
  where destination cannot be inspected
  then
    refuse DESTINATION_UNAVAILABLE "The destination could not be inspected."
  where destination is absent or is an inspectable directory
  then
    leave an absent destination absent
    record every regular file and non-directory entry it currently holds
    replace the previously directed destination only after inspection succeeds
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

intend (producer: Producer, path: Path, content: Content, medium: Medium, claim: Claim) : return (intent: Intent, path: Path, digest: Digest)
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
    copy or encode content and compute its digest
    replace this producer's intent for path in its open stage, or in its active set when no attempt is open
    keep the intent identity for producer and path
    return intent, path, and digest

commit (producer: Producer) : return (producer: Producer, dropped: Number)
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where producer has no open attempt
  then
    refuse NOT_BEGUN "This producer has no open attempt."
  where producer has an open attempt
  then
    atomically replace its active intents with its staged intents
    close the attempt
    return producer and the number of formerly active paths omitted from the stage

abort (producer: Producer) : return (producer: Producer, discarded: Number)
  where producer is not well-formed text
  then
    refuse INVALID_PRODUCER "A producer identity must be well-formed text."
  where producer has no open attempt
  then
    refuse NOT_BEGUN "This producer has no open attempt."
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

`intend` validates producer, claim, path containment, canonical path form, content,
medium, and collisions in that order. Refused actions leave all intents
unchanged. `direct` and `reconcile` likewise replace their recorded state only
after their filesystem work succeeds.

## Queries

```queries
_intent (path: Path) : optional (digest: Digest, medium: Medium)
_producers (path: Path) : many (producer: Producer)
_byProducer (producer: Producer) : many (path: Path, digest: Digest, medium: Medium)
_attempt (producer: Producer) : optional (attempt: Number)
_pending () : many (path: Path, digest: Digest)
_orphans () : many (path: Path)
```

`_intent` and `_byProducer` read active intents only. `_intent` has at most one
row because all active producers at a path agree on exact bytes. `_producers`
reports every active producer whose reservation contests the supplied path,
including file-versus-directory overlaps; only when there is no such active
reservation does it report staged producers. `_pending` lists active artifacts
whose emitted entry is absent, non-regular, or byte-different.
`_orphans` lists recorded destination entries with no active intent. Unknown or
invalid identities and paths make optional and many queries answer no rows.

Emitting owns artifact bytes, collision-safe destination paths, producer
attempts, and exact destination reconciliation. It does not decide what a
producer represents, why an artifact is wanted, when an attempt should begin, or
when reconciliation is allowed to run.
