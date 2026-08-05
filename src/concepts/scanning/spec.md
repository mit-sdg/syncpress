# Scanning

## Purpose

Read ordinary files from host directories in one predictable order, refusing
anything that is not a plain file, so a build sees a complete, link-free
snapshot of what an author wrote.

## Principle

Ada surveys `/srv/site/content` and gets a survey listing `about.md` and
`posts/first.md`, in that order, each named by a portable path rather than a
host path. She reads `posts/first.md` from the survey and gets its exact bytes.
She reads a file she did not survey and is refused. She surveys a directory
holding a symbolic link and the whole survey is refused, so no partial snapshot
exists. Surveying the same directory again replaces the earlier survey for that
label with what the directory holds now, under the same survey identity.

## State

```state
a set of Surveys with
  a label Text
  a directory Path

a set of Entries with
  a survey Survey
  a path Path
  a source Path
```

A directory is a native host path. A `source` is the native path of one entry; a
`path` is that entry's location below the survey's directory, written as
portable segments separated by `/`. A survey walks each directory's own names in
ascending order and descends as soon as it reaches a directory name, so its
entries always appear in one stable order for one directory tree.

A label is opaque text chosen by the caller. Scanning does not interpret it; it
only guarantees that exactly one survey exists per label. Surveying again under
the same label keeps that survey's identity and replaces every entry belonging
to it, so a caller holding the identity always sees the newest listing.

A survey admits only directories and ordinary files. A symbolic link, device,
socket, or any other entry anywhere below the directory refuses the whole
survey, and an entry whose name is not a valid portable path segment refuses it
too. Scanning reads bytes only when asked, so a survey describes what exists
without holding any content.

## Actions

```actions
survey (label: Text, directory: Path) : return (survey: Survey, count: Number)
  where label or directory is not well-formed, non-empty text
  then
    refuse INVALID_SURVEY "A survey needs well-formed, non-empty label and directory text."
  where directory is missing
  then
    refuse DIRECTORY_MISSING "This required directory is missing."
  where directory is a symbolic link or not a directory
  then
    refuse DIRECTORY_UNSUPPORTED "This required location must be a directory that is not a symbolic link."
  where any entry below directory is not a directory or an ordinary file
  then
    refuse ENTRY_UNSUPPORTED "Only directories and ordinary files may be surveyed."
  where any entry name cannot be a portable path segment
  then
    refuse ENTRY_UNNAMEABLE "Every surveyed name must be a portable path segment."
  where directory cannot be read
  then
    refuse DIRECTORY_UNREADABLE "This directory could not be read."
  then
    replace any survey with this label, record every ordinary file below directory
    return the survey and how many entries it has

read (survey: Survey, path: Path) : return (content: Bytes)
  where no entry of survey has path
  then
    refuse ENTRY_NOT_FOUND "This survey has no such entry."
  where the entry cannot be read
  then
    refuse ENTRY_UNREADABLE "This file could not be read."
  then
    return its exact bytes

absorb (path: Path) : return (content: Bytes)
  where path is not well-formed, non-empty text
  then
    refuse INVALID_SURVEY "A survey needs well-formed, non-empty label and directory text."
  where path is missing
  then
    refuse FILE_MISSING "This required file is missing."
  where path is a symbolic link or not an ordinary file
  then
    refuse ENTRY_UNSUPPORTED "Only directories and ordinary files may be surveyed."
  where the file cannot be read
  then
    refuse ENTRY_UNREADABLE "This file could not be read."
  then
    return its exact bytes
```

`absorb` reads one named host file that no survey lists, for the single required
file a build must read before it knows anything else. It records nothing.

Reading twice can answer different bytes, because the host owns the file
between reads. Scanning reports what it read and leaves change detection to
whoever keeps the bytes.

## Queries

```queries
_survey (survey: Survey) : optional (label: Text, directory: Path, count: Number)
_labelled (label: Text) : optional (survey: Survey)
_entry (survey: Survey) : many (path: Path, source: Path)
```

Scanning owns host directory traversal, entry admission, and file reading. It
does not decide which directories matter, keep the bytes it reads, interpret a
file's contents, or say what should happen to what it found.
