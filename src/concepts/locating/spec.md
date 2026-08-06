# Locating

## Purpose

Record which host locations a run wants and observe their resolution-time
containment and overlap under one base, so composition can reject an unsafe
location plan before asking another owner to use it.

## Principle

Ada records that the base should be `/srv/site` and that output should go to
`build`. Grounding the recorded base succeeds because it is a real directory.
She admits `content` under the name `content` and gets an absolute location
inside the base. She admits `../elsewhere` and gets a location that reports
itself outside. She admits `linked/content`, where `linked` is a symbolic link
to another disk; it looks contained but reports that it does not stay inside
once links are resolved. She admits `build` before it exists and still gets a
stable answer, and its location does not overlap `content`. Admitting a name
again replaces what that name locates. Grounding another base forgets every
location admitted under the previous one.

## Types

```types
Name = Text
  An opaque, nonempty Text name chosen by the caller.

Path = external
  An absolute native host path represented as Text. A `path` value preserves
  the absolute spelling observed by Locating. A `real` value replaces each
  resolved symbolic link with its target; for a missing location, it appends
  the remaining literal segments to the real path of the nearest existing
  ancestor.

Status = "grounded" | "admitted" | "problem"

Code = "LOCATION_MISSING" | "LOCATION_NOT_DIRECTORY" | "LOCATION_UNRESOLVABLE"
```

## State

```state
a set of Requests with
  a name Name
  a path Text

a set of Bases with
  a path Path
  a real Path

a set of Places with
  a name Name
  a path Path
  a real Path
  a contained Flag
  a resolved Flag
```

## Actions

```actions
recordRequest (name: Name, path: Text) : return (name: Name, path: Text)
  where name or path is not well-formed, non-empty text
  then
    refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
  then
    record path under name, replacing any earlier request with that name
    return name and path

establishBase (path: Text) : return (status: Status, path?: Path, real?: Path, code?: Code, detail?: Text)
  where path is not well-formed, non-empty text
  then
    refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
  where the location is missing
  then
    return status problem, code LOCATION_MISSING, and "This required directory is missing."
  where the location is a symbolic link or not a directory
  then
    return status problem, code LOCATION_NOT_DIRECTORY, and "This required location must be a directory that is not a symbolic link."
  where the location cannot be inspected or resolved
  then
    return status problem, code LOCATION_UNRESOLVABLE, and "This location could not be resolved."
  where the base is already this exact absolute path
  then
    keep the base and every admitted place, and return status grounded with its paths
  where the base is new or different
  then
    make path absolute against the process working directory
    replace the Base, discard every admitted Place, and return status grounded with its paths

inspectLocation (name: Name, path: Text) : return (status: Status, place?: Place, path?: Path, real?: Path, contained?: Flag, resolved?: Flag, code?: Code, detail?: Text)
  where no base is grounded
  then
    refuse NOT_GROUNDED "No base directory has been grounded."
  where name or path is not well-formed, non-empty text
  then
    refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
  where some place has this name and exactly this path
  then
    return status admitted with that place unchanged
  where the location cannot be resolved
  then
    return status problem, code LOCATION_UNRESOLVABLE, and "This location could not be resolved."
  otherwise
    make path absolute against the Base and resolve its existing portion
    set contained from absolute-path containment and resolved from real-path containment
    replace any Place with this Name and return status admitted with both flags
```

## Queries

```queries
_requested (name: Name) : optional (path: Text)
  Uses the exact caller-supplied Name and returns no row when no Request has that
  Name. Returned path text is a value, not a live filesystem handle; queries do
  not reinspect or re-resolve the host. No Locating query returns multiple rows,
  so query ordering is not observable.

_base () : optional (path: Path, real: Path)
  Returns no row before a Base is grounded and otherwise reports the retained
  observation from the most recent successful grounding.

_place (place: Place) : optional (name: Name, path: Path, real: Path, contained: Flag, resolved: Flag)
  Uses exact Place identity and returns no row for an unknown Place.

_named (name: Name) : optional (place: Place)
  Uses the exact caller-supplied Name and returns no row when no Place has that
  Name.

_overlapping (place: Place, other: Place) : one (overlapping: Flag)
  Compares retained real paths and returns true when either location is at or
  below the other. An unknown Place yields false because it occupies no
  location.
```

## Contracts

```contracts
contract host-observations on establishBase, inspectLocation
  Paths and containment flags describe the host when the action runs. They are
  not capabilities or locks and may become stale immediately. `inspectLocation` may
  observe a missing trailing location; `establishBase` requires a present directory.

contract stable-place-identity on establishBase, inspectLocation
  Each Name determines one Place identity. Replacing a Place, grounding another
  Base, and later admitting the Name preserve that identity.
```
