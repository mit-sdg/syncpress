# Locating

## Purpose

Record which host locations a run wants, ground one base directory, and admit
named locations under it with symbolic links resolved, so every location a build
later reads or writes is already known to be inside or outside that base.

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

## State

```state
a set of Requests with
  a name Name
  a path Text

an optional Base with
  a path Path
  a real Path

a set of Places with
  a name Name
  a path Path
  a real Path
  a contained Flag
  a resolved Flag
```

A request is only remembered text: recording one reads nothing and resolves
nothing. Requests survive grounding, so a run can record everything it wants
before any host access happens.

A path is a native host path. `path` is always absolute: `ground` makes its
argument absolute against the process working directory, and `admit` makes its
argument absolute against the base path. A real path is that absolute path with
every resolved symbolic link replaced by its target. A location that does not
exist yet has the real path of its nearest existing ancestor followed by the
remaining literal segments, so an absent directory still answers.

`contained` says the location's absolute path lies at or below the base path,
comparing the two paths as written. `resolved` says the same about the two real
paths, so an intermediate symbolic link that leaves the base sets `contained`
true and `resolved` false. The base is contained in and resolved within itself.

A name is opaque text chosen by the caller. Locating does not interpret it; it
only guarantees that at most one request and at most one place exist per name.

## Actions

```actions
request (name: Name, path: Text) : return (name: Name, path: Text)
  where name or path is not well-formed, non-empty text
  then
    refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
  then
    record path under name, replacing any earlier request with that name
    return name and path

ground (path: Text) : return (path: Path, real: Path)
  where path is not well-formed, non-empty text
  then
    refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
  where the location is missing
  then
    refuse LOCATION_MISSING "This required directory is missing."
  where the location is a symbolic link or not a directory
  then
    refuse LOCATION_NOT_DIRECTORY "This required location must be a directory that is not a symbolic link."
  where the location cannot be inspected or resolved
  then
    refuse LOCATION_UNRESOLVABLE "This location could not be resolved."
  where the base is already this exact absolute path
  then
    keep the base and every admitted place, and return its paths
  where the base is new or different
  then
    replace the base, discard every admitted place, and return its paths

admit (name: Name, path: Text) : return (place: Place, path: Path, real: Path, contained: Flag, resolved: Flag)
  where no base is grounded
  then
    refuse NOT_GROUNDED "No base directory has been grounded."
  where name or path is not well-formed, non-empty text
  then
    refuse INVALID_LOCATION "A location must be well-formed, non-empty text."
  where the location cannot be resolved
  then
    refuse LOCATION_UNRESOLVABLE "This location could not be resolved."
  where some place has this name and exactly this path
  then
    return that place unchanged
  otherwise
  then
    replace any place with this name, resolve the location, and return it with both containment flags
```

`admit` never requires the location to exist, so an output directory can be
admitted before a build creates it. Only `ground` requires a present directory,
because a build has nothing to interpret without one.

## Queries

```queries
_requested (name: Name) : optional (path: Text)
_base () : optional (path: Path, real: Path)
_place (place: Place) : optional (name: Name, path: Path, real: Path, contained: Flag, resolved: Flag)
_named (name: Name) : optional (place: Place)
_overlapping (place: Place, other: Place) : one (overlapping: Flag)
```

`_overlapping` compares real paths and answers true when either location is at
or below the other, so a directory and any file within it overlap. It answers
false for an unknown place, because an unknown place occupies nothing.

Locating owns host path recording, grounding, resolution, and containment. It
does not read directory entries, decide which locations a build needs, know what
a location is for, or decide whether being outside the base is an error.
