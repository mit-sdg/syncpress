# Watching

## Purpose

Report settled bursts of change under a host directory, so work happens once per
burst instead of once per event, and never in response to paths the watcher was
told to disregard.

## Principle

Ada observes `/srv/site`, letting a burst settle after 75 milliseconds, with
`/srv/site/dist` excluded before observation starts. She attends the watch and waits.
Saving three files in quick succession reports one settled change, not three.
When she attends again she waits, because that burst was already reported. Files written
under `/srv/site/dist` report nothing at all. A burst that settles while nobody
is attending is still reported by the next attend. Closing the watch releases
whoever is attending and stops the observation for good.

## Types

```types
Duration = PositiveInteger
  A duration in milliseconds.

Path = Text
  A non-empty native host path.

State = "open" | "failed" | "closed"
```

## State

```state
a set of Watches with
  a directory Path
  a settling Duration
  a state State
  an excludedTrees set of Paths
  an excludedPrefixes set of Paths
  a settled Flag
```

## Actions

```actions
observe (directory: Path, settling: Duration, excluded: Path, prefix: Path) : return (watch: Watch)
  where directory, excluded, or prefix is malformed, or settling is not a positive safe integer
  then
    refuse INVALID_WATCH "A watch needs a directory and a positive settling duration."
  where directory is missing
  then
    refuse DIRECTORY_MISSING "This required directory is missing."
  where directory is a symbolic link or not a directory
  then
    refuse DIRECTORY_UNSUPPORTED "This required location must be a directory that is not a symbolic link."
  where the host cannot observe directory
  then
    refuse DIRECTORY_UNOBSERVABLE "This directory could not be observed."
  then
    normalize the directory and fixed exclusions before host observation begins
    add an open Watch with settled false and return it

attend (watch: Watch, within: Duration) : return (changed: Flag, watching: Flag)
  where watch is unknown
  then
    refuse WATCH_NOT_FOUND "There is no such watch."
  where within is not a positive safe integer
  then
    refuse INVALID_WATCH "A watch needs a directory and a positive settling duration."
  where the host watcher failed
  then
    refuse WATCH_FAILED "The host watch stopped unexpectedly."
  where the watch is closed
  then
    return changed false and watching false
  where the watch has a settled burst
  then
    take that burst and return changed true and watching true
  otherwise
    wait until a burst settles, the watch closes, or within passes
    return whether a burst is being reported, and whether the watch is still open

close (watch: Watch) : return (watch: Watch)
  where watch is unknown
  then
    refuse WATCH_NOT_FOUND "There is no such watch."
  then
    stop observing, release whoever is attending, await host observation, and make the watch closed
```

## Queries

```queries
_watch (watch: Watch) : optional (directory: Path, settling: Duration, state: State)
  Returns no row for an unknown Watch and continues to return a row after
  failure or closure.

_excluded (watch: Watch) : many (path: Path)
  Returns no rows when no Paths match. This query and `_open` define no order.

_open () : many (watch: Watch)
  Returns no rows when no Watches match.
```

## Contracts

```contracts
contract excluded-changes on observe
  A tree exclusion ignores its path and descendants by native path components.
  A prefix exclusion matches only the first component below its own parent.

contract settled-bursts on observe, attend
  Each counted change restarts the settling Duration. A quiet Duration records
  one unreported burst; further bursts collapse into it until `attend` reports
  and consumes it.

contract terminal-watch on attend, close
  An unexpected host-watcher end makes the Watch failed and releases attendance.
  A closed Watch observes nothing. Failed and closed Watches retain their
  identities and never become open again.
```
