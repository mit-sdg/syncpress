# Serving

## Purpose

Answer host requests from one directory of already-published files, never
revealing anything outside it, and tell connected readers when to look again.

## Principle

Ada opens a server on a loopback address and port 0; it reports the port the
host actually gave it. Until she points it at a directory it tells every reader
the site is unavailable. She points it at a published output directory, and a
request for `/` answers that directory's `index.html` with a small script that
listens for reload notices. A request for a missing path answers not found. A
request that climbs out of the directory, or reaches it through a symbolic link
that leaves it, answers forbidden without reading the file. After a rebuild she
refreshes the server, and every listening reader is told to reload. Closing the
server ends the listeners and stops answering.

## State

```state
a set of Servers with
  a host Text
  a port Number
  a state State
  an optional directory Path
  a set of Readers
```

A server is `open` until it is closed, and `closed` forever afterwards. A closed
server answers nothing and keeps no readers, but keeps its identity so late
callers get an answer instead of a refusal.

The directory is a native host path. A server with no directory answers every
request with a service-unavailable status, because it has nothing published to
show. Pointing a server at another directory replaces the first.

A reader is one open reload listener. Readers arrive and leave on their own;
`refresh` tells all of them at once and reports how many were told.

## Serving Rules

A request path is decoded as a URI path before anything else; a malformed
encoding is a bad request. A decoded path containing a backslash or a `..`
segment is forbidden without touching the host. What remains is resolved inside
the directory, and anything at or below it that is a symbolic link, or whose
resolved location leaves the directory, is forbidden. A path naming a directory
answers that directory's `index.html`. Anything absent is not found.

An HTML answer carries a reload listener appended to its body and is never
cached; every other answer carries only the media type its extension implies,
defaulting to unnamed bytes. Serving reads files at request time and keeps no
copies, so an answer always reflects what the directory holds now.

## Actions

```actions
open (host: Text, port: Number) : return (server: Server, host: Text, port: Number)
  where host is not well-formed, non-empty text, or port is not an integer between 0 and 65535
  then
    refuse INVALID_SERVER "A server needs a host and a port between 0 and 65535."
  where the host refuses the address
  then
    refuse ADDRESS_UNAVAILABLE "This address could not be listened on."
  then
    add an open server with no directory and no readers
    return it with the address the host actually gave it

serve (server: Server, directory: Path) : return (server: Server, directory: Path)
  where server is unknown or closed
  then
    refuse SERVER_NOT_OPEN "There is no such open server."
  where directory is not well-formed, non-empty text
  then
    refuse INVALID_SERVER "A server needs a host and a port between 0 and 65535."
  then
    answer later requests from directory and return it

refresh (server: Server) : return (readers: Number)
  where server is unknown or closed
  then
    refuse SERVER_NOT_OPEN "There is no such open server."
  then
    tell every reader to look again and return how many were told

close (server: Server) : return (server: Server)
  where server is unknown
  then
    refuse SERVER_NOT_FOUND "There is no such server."
  then
    end every reader, stop answering, and make the server closed
```

## Queries

```queries
_server (server: Server) : optional (host: Text, port: Number, state: State, directory: OptionalPath)
_readers (server: Server) : one (readers: Number)
```

`_server` answers a row for every server it has ever opened, including closed
ones, and reports an absent directory until one is set.

Serving owns listening, request safety, media types, and reload notices. It does
not build what it serves, decide when a refresh is warranted, or know why a
directory changed.
