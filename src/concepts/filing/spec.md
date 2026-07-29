# Filing

## Purpose

Hold named trees of files and report precisely when their contents change, so
the rest of the generator can address ordinary project files without owning a
filesystem.

## Principle

Ada opens a content root and places `posts/compiler-design/index.md` in it.
Reading it returns its bytes and digest. Placing those bytes again reports no
change; replacing them reports a change. Listing `posts/` returns the page in
path order, and resolving `./pipeline.png` finds its sibling when it exists.
Paths that leave the root are refused. Discarding the page removes it, and
discarding it again is refused.

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
open (name: Name) : return (root: Root)
  then
    add a root with name if none has it
    return root

place (root: Root, path: Path, content: Bytes) : return (file: File, digest: Digest, changed: Flag)
  where path leaves root
  then
    refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
  where path stays in root
  then
    write the file and report whether its digest changed

discard (file: File) : return (root: Root, path: Path)
  where file is absent
  then
    refuse FILE_NOT_FOUND "There is no such file."
  where file is present
  then
    remove it and return its address
```

## Queries

```queries
_root (root: Root) : optional (name: Name)
_named (name: Name) : optional (root: Root)
_file (file: File) : optional (root: Root, path: Path, name: Name, content: Bytes, digest: Digest)
_at (root: Root, path: Path) : optional (file: File, digest: Digest)
_under (root: Root, prefix: Path) : many (file: File, path: Path, digest: Digest)
_resolve (file: File, address: Address) : optional (target: File, path: Path)
_join (prefix: Path, name: Name) : one (path: Path)
_directory (path: Path) : one (prefix: Path)
_medium (path: Path) : one (medium: Medium)
```

Filing owns file-path syntax and file contents. It does not decide what a file
means, whether it is published, or whether a reference is valid.
