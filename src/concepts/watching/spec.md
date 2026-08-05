# Watching

## Purpose

Report settled bursts of change under a host directory, so work happens once per
burst instead of once per event, and never in response to paths the watcher was
told to disregard.

## Principle

Ada observes `/srv/site`, letting a burst settle after 75 milliseconds, with
`/srv/site/dist` excluded before observation starts. She attends the watch and waits.
Saving three files in quick succession reports one settled change, not three.
Attending again waits, because that burst was already reported. Files written
under `/srv/site/dist` report nothing at all. A burst that settles while nobody
is attending is still reported by the next attend. Closing the watch releases
whoever is attending and stops the observation for good.

## State

```state
a set of Watches with
  a directory Path
  a settling Duration
  a state State
  a set of excluded Trees
  a set of excluded temporary-name Prefixes
  a settled Flag
```

A directory is a native host path, observed with all of its descendants. A tree
exclusion ignores exactly that path and its descendants using native
path-component containment. A temporary-name prefix matches only the first path
component below its own parent, so `.dist.emitting-*` does not suppress a
sibling such as `dist-notes`.

A watch is `open`, `failed`, or `closed`. An unexpected host-watcher end makes
it failed and releases attendance; later attendance refuses rather than
silently reporting an inert open watch. A closed watch observes nothing and
keeps its identity so late callers get an answer.

`settled` records one burst that has finished and has not been reported yet.
Counted changes restart the settling duration; when that duration passes with no
further counted change, the burst is settled. Further bursts before a report
collapse into the one already recorded: a report says that something changed
since the last report, never how much.

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
    normalize every exclusion before host observation begins, add an open watch, and return it

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
  then
    wait until a burst settles, the watch closes, or within passes
    return whether a burst is being reported, and whether the watch is still open

close (watch: Watch) : return (watch: Watch)
  where watch is unknown
  then
    refuse WATCH_NOT_FOUND "There is no such watch."
  then
    stop observing, release whoever is attending, await host observation, and make the watch closed
```

`attend` waits for at most `within`, because one concept answers one ask at a
time: an unbounded wait would leave `close` with no turn. A
caller that wants prompt closing attends in short spans.

## Queries

```queries
_watch (watch: Watch) : optional (directory: Path, settling: Duration, state: State)
_excluded (watch: Watch) : many (path: Path)
_open () : many (watch: Watch)
```

Watching owns host change observation, burst settling, initial exclusions, and
the open, failed, and closed lifecycle. It does not decide what a change means,
what should happen after one, or which paths deserve exclusion.
