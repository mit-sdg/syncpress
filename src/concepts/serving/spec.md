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
request that climbs out of the directory, or reaches a symbolic link, answers
forbidden without reading the file. After a rebuild she publishes the
reconciled directory, and every listening reader is told to reload. Closing the
server ends the listeners and stops answering.

## Types

```types
Path = Text
  A non-empty native host path.

Port = SafeInteger
  An integer from 0 through 65535 inclusive.

State = "open" | "closing" | "failed" | "closed"
```

## State

```state
a set of Servers with
  a host Text
  a port Port
  a state State
  an optional directory Path
  a set of Readers

a set of Readers
```

## Actions

```actions
open (host: Text, port: Port) : return (server: Server, host: Text, port: Port)
  where host is not well-formed, non-empty text, or port is not an integer between 0 and 65535
  then
    refuse INVALID_SERVER "A server needs a host and a port between 0 and 65535."
  where the host refuses the address
  then
    refuse ADDRESS_UNAVAILABLE "This address could not be listened on."
  then
    add an open server with no directory and no readers
    return it with the address the host actually gave it

serveDirectory (server: Server, directory: Path) : return (server: Server, directory: Path, readers: Number)
  where server is unknown or not open
  then
    refuse SERVER_NOT_OPEN "There is no such open server."
  where directory is not well-formed, non-empty text
  then
    refuse INVALID_PUBLICATION "A publication needs a well-formed, non-empty directory path."
  where directory is missing, symbolic, not a directory, or cannot be resolved
  then
    refuse PUBLICATION_UNAVAILABLE "This published directory could not be served."
  then
    atomically replace the current canonical directory, tell every reader to look again, and return it with how many were told

close (server: Server) : return (server: Server)
  where server is unknown
  then
    refuse SERVER_NOT_FOUND "There is no such server."
  where host closure fails
  then
    end every Reader, stop answering, and make the Server failed
    refuse SERVER_CLOSE_FAILED "This server could not be closed."
  then
    end every reader, stop answering, and make the server closed
```

## Queries

```queries
_server (server: Server) : optional (host: Text, port: Port, state: State, directory: Path | null)
  Returns a row for every Server ever opened, including a closed Server. The
  directory is null until one is set.

_readers (server: Server) : one (readers: Number)
  Reports the current number of open reload listeners. The count is zero for an
  unknown or closed Server.
```

## Contracts

```contracts
contract request-paths
  Without a published directory, every request is unavailable. Otherwise the
  raw path is separated from its query and decoded once without WHATWG dot
  normalization. Malformed encoding is a bad request. A backslash, `..` segment,
  named symbolic-link component, or resolved path outside the directory is
  forbidden. A directory names its `index.html`; an absent, unreadable, or
  non-regular final entry, including a symbolic fallback index, is not found.

contract served-files
  Serving reads files at request time and retains no copy. HTML receives a
  no-cache reload script before its closing body tag or at the end; other files
  receive the media type implied by their extension, or generic bytes.

contract reload-readers on serveDirectory, close
  The reload endpoint retains one Reader per open event stream. Every successful
  `serveDirectory`, including an unchanged directory, tells each current Reader once.
  Closure or listener failure ends all Readers; an unexpected listener failure
  also makes the Server failed.
```
