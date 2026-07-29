# Filing

## Purpose

Keep files in named trees and say whether saving a file changed its contents.

## Principle

Ada opens a tree called notes and saves a page and a picture in it. Reading the
page gives back the exact bytes she saved and a stable fingerprint. Saving the
same bytes reports no change; saving different bytes keeps the same file
identity and reports a change. Listings have one predictable path order. The
page can find the picture from a link such as `./picture.png`, but a link cannot
climb outside the tree. Removing the page makes later lookups miss it, and
removing it again is refused. A second named tree remains separate.

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

Each root name identifies one stable root. Within a root, each path identifies
one stable file, including after that file is discarded and placed again. Root
and file identities are opaque and collision-free for distinct names and
addresses.

Content is always bytes. Filing copies bytes on input and output. A digest is
the lowercase, 64-character hexadecimal SHA-256 digest of those exact bytes.
The `changed` flag compares the bytes themselves rather than trusting digest
equality.

A path is a platform-neutral logical path, not a native filesystem path. It is
one or more NFC-normalized Unicode segments separated by `/`. Every segment is
non-empty, consists only of Unicode scalar values, is neither `.` nor `..`, and
contains no backslash, NUL, ASCII control character, or DEL. A directory prefix
is either empty, meaning the root, or a path in the same form. Hosts translate
native paths to this form before placing files.

`_under` treats its prefix as a directory, not an arbitrary text prefix, and
answers descendants in ascending UTF-8 byte order of their complete paths.
`_join`, `_directory`, and `_name` answer no row when an input is not canonical.
The other optional and many queries likewise answer no rows for unknown
identities, unknown roots, or non-canonical lookup paths.

Resolution interprets an address as a URI reference relative to the source
file's directory and never crosses roots. Percent-encoded path segments are
decoded as UTF-8; encoded separators and malformed encodings are invalid. `.`
and `..` are normalized, but a result that climbs above the root is outside.
An empty, query-only, or fragment-only reference names the source file. Query
and fragment suffixes on another reference do not affect its file path. A
leading `/`, `//`, or URI scheme is nonlocal. A trailing `/` or an address that
ends at `.` or `..` does not name a file and is invalid. `_resolution` reports
`found`, `missing`, `outside`, `nonlocal`, `invalid`, or `unknown-file`;
`_resolve` supplies a row only for `found`.

## Actions

```actions
open (name: Name) : return (root: Root)
  where some root has name
  then
    return that root
  where no root has name
  then
    add a new root with name
    return root

place (root: Root, path: Path, content: Bytes) : return (file: File, digest: Digest, changed: Flag)
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

discard (file: File) : return (root: Root, path: Path, name: Name)
  where file is absent
  then
    refuse FILE_NOT_FOUND "There is no such file."
  where file is present
  then
    remove it and return its address and name
```

`place` checks the root before the path, so an unknown root always refuses with
`ROOT_NOT_FOUND`. A leading `/`, or enough leading `..` segments to climb above
the root, refuses with `PATH_LEAVES_ROOT`. A safe but non-canonical spelling,
such as `a/../b`, refuses with `INVALID_PATH` rather than being normalized.

## Queries

```queries
_root (root: Root) : optional (name: Name)
_named (name: Name) : optional (root: Root)
_file (file: File) : optional (root: Root, path: Path, name: Name, content: Bytes, digest: Digest)
_at (root: Root, path: Path) : optional (file: File, digest: Digest)
_under (root: Root, prefix: Directory) : many (file: File, path: Path, digest: Digest)
_resolve (file: File, address: Address) : optional (target: File, path: Path)
_resolution (file: File, address: Address) : one (status: ResolutionStatus)
_join (prefix: Directory, name: Name) : optional (path: Path)
_directory (path: Path) : optional (prefix: Directory)
_name (path: Path) : optional (name: Name)
```

Filing owns named byte trees, their logical path syntax, and relative lookup
within a tree. It does not decode text, infer media types, interpret a file's
meaning, decide whether to publish it, or decide how a resolution status should
be reported to a person.
