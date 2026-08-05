# Watching

## Purpose

Report settled bursts of change under a host directory, so work happens once per
burst instead of once per event, and never in response to paths the watcher was
told to disregard.

## Principle

Ada observes `/srv/site`, letting a burst settle after 75 milliseconds, and
tells the watch to disregard `/srv/site/dist`. She attends the watch and waits.
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
  a set of disregarded Prefixes
  a settled Flag
```

A directory is a native host path, observed with all of its descendants. A
prefix is a native host path prefix: a change is disregarded when its path
begins with that prefix, so a directory disregards everything inside it and a
partial name disregards every sibling that starts with it.

A watch is `open` until it is closed, and `closed` forever afterwards. A closed
watch observes nothing, releases anyone attending it, and keeps its identity so
late callers get an answer instead of a refusal.

`settled` records one burst that has finished and has not been reported yet.
Counted changes restart the settling duration; when that duration passes with no
further counted change, the burst is settled. Further bursts before a report
collapse into the one already recorded: a report says that something changed
since the last report, never how much.

## Actions

```actions
observe (directory: Path, settling: Duration) : return (watch: Watch)
  where directory is not well-formed, non-empty text or settling is not a positive safe integer
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
    add an open watch over directory with no disregarded prefixes and return it

disregard (watch: Watch, prefix: Path) : return (watch: Watch, prefix: Path)
  where watch is unknown or closed
  then
    refuse WATCH_NOT_OPEN "There is no such open watch."
  where prefix is not well-formed, non-empty text
  then
    refuse INVALID_WATCH "A watch needs a directory and a positive settling duration."
  then
    add prefix to the watch's disregarded prefixes and return them

attend (watch: Watch, within: Duration) : return (changed: Flag, watching: Flag)
  where watch is unknown
  then
    refuse WATCH_NOT_FOUND "There is no such watch."
  where within is not a positive safe integer
  then
    refuse INVALID_WATCH "A watch needs a directory and a positive settling duration."
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
    stop observing, release whoever is attending, and make the watch closed
```

`attend` waits for at most `within`, because one concept answers one ask at a
time: an unbounded wait would leave `close` and `disregard` with no turn. A
caller that wants prompt closing attends in short spans.

## Queries

```queries
_watch (watch: Watch) : optional (directory: Path, settling: Duration, state: State)
_disregarded (watch: Watch) : many (prefix: Path)
_open () : many (watch: Watch)
```

Watching owns host change observation, burst settling, and which paths do not
count. It does not decide what a change means, what should happen after one, or
which paths deserve disregarding.
