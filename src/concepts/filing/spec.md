# Filing

## Purpose

Keep authoritative named byte trees and replace a host-backed tree only after
its complete readable contents are known, so readers never observe a partial
import.

## Principle

Ada loads a host directory called notes. Reading its page gives back the exact
bytes loaded, the same text when those bytes are UTF-8, and a stable
fingerprint. She changes one file, removes another, and loads notes again; the
surviving file keeps its identity, the omitted file disappears, and readers see
the new tree only after the whole load succeeds. A later load encounters a
symbolic link and reports a problem without changing the preceding tree. The
page can find a picture from `./picture.png`, but a link cannot climb outside
the logical tree.

## Types

```types
Name = JavaScriptString
  An opaque Root name. Host-loading actions require nonempty Text; `ensureRoot`
  accepts any JavaScriptString.

HostPath = external
  A native filesystem path supplied as Text for one load operation. Host paths
  are not retained as Filing state.

Path = Text
  A platform-neutral logical path with one or more NFC-normalized Unicode
  segments separated by `/`. Each segment is nonempty, contains only Unicode
  scalar values, is neither `.` nor `..`, and contains no backslash, NUL, ASCII
  control character, or DEL. A Path has no leading, trailing, or repeated `/`.

Segment = Text
  One canonical segment of a Path.

Directory = Text
  Either empty text, meaning a Root, or a Path naming a directory prefix.

Address = Text
  A URI reference interpreted relative to a source File for lookup within the same Root.

Digest = Text
  The lowercase, 64-character hexadecimal SHA-256 digest of exact File content.

Status = "loaded" | "problem"

Code = Text
  A stable machine-readable code for a reported host-load problem.

ResolutionStatus = "found" | "missing" | "outside" | "nonlocal" | "invalid" | "unknown-file"
```

Host loads translate native paths to Path before placing Files. File content is
always `Bytes`. Filing copies bytes on input and output. The `changed` flag
compares exact bytes rather than trusting digest equality.

## State

```state
a set of Roots with
  a name Name

a set of Files with
  a root Root
  a path Path
  a content Bytes
  a digest Digest
```

## Actions

```actions
replaceTreeFromFile (name: Name, source: HostPath, path: Path) : return (status: Status, root?: Root, file?: File, digest?: Digest, count?: Number, changed?: Flag, code?: Code, detail?: Text)
  where name or source is not well-formed, non-empty text
  then
    refuse INVALID_SOURCE "A host load needs well-formed, non-empty name and source text."
  where path climbs outside root
  then
    refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
  where path is not canonical
  then
    refuse INVALID_PATH "A file path must use the canonical portable form."
  where the host file is missing, unreadable, symbolic, or not ordinary
  then
    return status problem with a stable code and detail, leaving the named tree unchanged
  then
    replace the named tree with that one file and return status loaded, its identities, digest, count, and change flag

replaceTreeFromDirectory (name: Name, directory: HostPath) : return (status: Status, root?: Root, count?: Number, changed?: Flag, code?: Code, detail?: Text)
  where name or directory is not well-formed, non-empty text
  then
    refuse INVALID_SOURCE "A host load needs well-formed, non-empty name and source text."
  where the directory is missing, unreadable, symbolic, or not a directory, or any descendant is unreadable, unnameable, symbolic, or not ordinary
  then
    return status problem with a stable code and detail, leaving the named tree unchanged
  then
    replace the named tree with every read file and return status loaded, its root, count, and change flag

ensureRoot (name: Name) : return (root: Root)
  where some root has name
  then
    return that root
  where no root has name
  then
    add a new root with name
    return root

putFile (root: Root, path: Path, content: Bytes) : return (file: File, digest: Digest, changed: Flag)
  where root is absent
  then
    refuse ROOT_NOT_FOUND "There is no such root."
  where path climbs outside root
  then
    refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
  where path is not canonical
  then
    refuse INVALID_PATH "A file path must use the canonical portable form."
  where some file has root and path
  then
    replace its content with a copy, keep its identity, and return whether its bytes changed
  where no file has root and path
  then
    add a file with copied content and changed true

putBase64File (root: Root, path: Path, encoded: Text) : return (file: File, digest: Digest, changed: Flag)
  where encoded is not canonical Base64
  then
    refuse INVALID_ENCODING "Staged file content must use canonical Base64."
  where encoded is canonical Base64 and root is absent
  then
    refuse ROOT_NOT_FOUND "There is no such root."
  where encoded is canonical Base64 and path climbs outside root
  then
    refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
  where encoded is canonical Base64 and path is not canonical
  then
    refuse INVALID_PATH "A file path must use the canonical portable form."
  where encoded, root, and path are valid
  then
    decode it to bytes and behave exactly as putFile with root, path, and those bytes

discard (file: File) : return (root: Root, path: Path, name: Segment)
  where file is absent
  then
    refuse FILE_NOT_FOUND "There is no such file."
  where file is present
  then
    remove it and return its address and name
```

## Queries

```queries
_root (root: Root) : optional (name: Name)
  Uses exact Root identity and returns no row for an unknown or stale Root.

_named (name: Name) : optional (root: Root)
  Uses the exact Name and returns no row when no Root has that Name.

_file (file: File) : optional (root: Root, path: Path, name: Segment, content: Bytes, digest: Digest)
  Uses exact File identity and returns no row for an unknown or stale File.
  Stored content bytes are copied; no query exposes mutable retained storage.

_text (file: File) : optional (text: Text)
  Decodes the complete current content as strict UTF-8 without changing stored
  bytes. An unknown or stale File, malformed or incomplete UTF-8, an encoded
  surrogate, or a value outside the Unicode scalar range yields no row. A
  leading byte-order mark is preserved as U+FEFF, and empty content yields empty
  text.

_at (root: Root, path: Path) : optional (file: File, digest: Digest)
  Uses an exact Root identity and canonical Path. An unknown or stale Root, a
  noncanonical Path, or an absent File yields no row.

_files () : many (file: File, root: Root, path: Path)
  Returns every File, grouping rows by the order Roots were opened and then by
  ascending UTF-8 byte order of Path within each Root.

_under (root: Root, prefix: Directory) : many (file: File, path: Path, digest: Digest)
  Treats the prefix as a directory boundary, not an arbitrary text prefix.
  Unknown Roots and noncanonical prefixes yield no rows. Descendants are in
  ascending UTF-8 byte order of complete Path.

_resolve (file: File, address: Address) : optional (target: File, path: Path)
  Resolves a URI reference relative to the source File's directory without
  crossing Roots, and returns a row only for `found`. Empty, query-only, and
  fragment-only references name the source File; query and fragment suffixes on
  other references do not affect the file path. Percent escapes decode as
  UTF-8; malformed encodings and encoded separators are invalid. `.` and `..`
  are normalized, with traversal above the Root classified as outside. A
  leading `/`, `//`, or URI scheme is nonlocal. A trailing `/`, or a reference
  ending at `.` or `..`, is invalid because it does not name a File.

_resolution (file: File, address: Address) : one (status: ResolutionStatus)
  Applies the same resolution rules and reports `found`, `missing`, `outside`,
  `nonlocal`, or `invalid`. An unknown or stale source File reports
  `unknown-file`.
```

## Contracts

```contracts
contract stable-identities on replaceTreeFromFile, replaceTreeFromDirectory, ensureRoot, putFile, putBase64File, discard
  Each Name identifies one stable Root. Within a Root, each Path identifies one
  stable File, including after removal and recreation. Distinct Names and
  distinct `(Root, Path)` pairs have distinct identities.

contract host-load-snapshot on replaceTreeFromFile, replaceTreeFromDirectory
  A host load reads every candidate byte before replacing its Root. A reported
  problem leaves the preceding Root unchanged. Concurrent host mutation may
  produce a problem or a mixed-time capture; the load is not a filesystem-wide
  snapshot or durable containment boundary.
```
