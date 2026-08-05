# Commanding

## Purpose

Interpret one operator's command line into a checked request, and answer that
operator on their own streams, so every misuse is refused the same way and every
report — including the one line a finished run is worth — reaches the same
place.

## Principle

Ada runs the tool with no arguments and gets the help request, whose answer is
the usage text. She runs `build ./site out` and gets a build request rooted at
`./site` publishing into `out`. She runs `dev --port 8080` and gets a develop
request on port 8080 with the default directory. She runs `inspect /posts/first/`
and gets an inspect request for that target. She runs `build a b c` and is
refused, with the usage text attached. Reporting a line puts it on the operator's
ordinary output; summarizing a run puts one counted sentence there; announcing a
served directory puts its address there; warning them puts it on their error
output, and all of them are remembered in the order they were said.

## State

```state
a set of Requests with
  a name Name
  a directory Text
  an optional destination Text
  an optional target Text
  an optional port Number

an ordered sequence of Reports with
  a stream Stream
  a text Text
```

A name is one of `help`, `build`, `watch`, `develop`, or `inspect`. A directory
is always present, defaulting to `.`. A destination is present only when the
operator named one. A target is present only for `inspect`, where it is
required. A port is present only for `develop`, defaulting to 3000.

A stream is `output` or `error`. Reports are remembered in the order they were
said, so a caller can check what an operator was told.

## Grammar

```text
(no arguments) | --help | -h | help
build [site-directory] [output-directory]
build --watch [site-directory] [output-directory]
dev [--port PORT] [site-directory] [output-directory]
inspect <page-or-route> [site-directory]
```

A port is a safe integer between 1 and 65535. Anything else — an unknown first
word, too many operands, a missing inspect target, or an unusable port — is
invalid usage. Commanding never inspects the host to decide: a directory it
returns is text the operator wrote, not a location that exists.

## Actions

```actions
interpret (arguments: Arguments) : return (request: Request, name: Name, directory: Text, destination: OptionalText, target: OptionalText, port: OptionalNumber)
  where arguments is not an ordinary dense list of text values
  then
    refuse INVALID_ARGUMENTS "Arguments must be an ordinary dense list of text values."
  where arguments do not match the grammar
  then
    refuse INVALID_USAGE "Invalid usage."
  then
    add the interpreted request and return it

say (text: Text) : return (report: Report)
  where text is not well-formed text
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put text on the operator's ordinary output, remember it, and return the report

summarize (pages: Number, files: Number, written: Number, replaced: Number, kept: Number, removed: Number) : return (report: Report, text: Text)
  where any count is not a non-negative safe integer
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put one sentence counting those pages, input files, and reconciled artifacts on the
    operator's ordinary output, remember it, and return the report and its text

announce (directory: Text, host: Text, port: Number) : return (report: Report)
  where directory or host is not well-formed text, or port is not a safe integer between 1 and 65535
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put one line naming where that directory is being served on the operator's ordinary
    output, remember it, and return the report

warn (text: Text) : return (report: Report)
  where text is not well-formed text
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put text on the operator's error output, remember it, and return the report
```

`INVALID_USAGE` carries the usage text, so a caller can refuse an operator
without holding its own copy of the grammar.

## Queries

```queries
_request (request: Request) : optional (name: Name, directory: Text, destination: OptionalText, target: OptionalText, port: OptionalNumber)
_reports () : many (report: Report, stream: Stream, text: Text)
_usage () : one (usage: Text)
_misuse () : one (misuse: Text)
```

`_usage` is what an operator who asked for help should read. `_misuse` is what an
operator who typed something unreadable should read: the same usage text behind
one line naming the problem.

Commanding owns the command-line grammar, the usage text, and the operator's
streams. It does not do what a request asks for, know whether a directory
exists, or decide what is worth reporting.
