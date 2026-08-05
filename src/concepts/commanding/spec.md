# Commanding

## Purpose

Own one Syncpress operator interaction from process arguments through reports
and a stop request, so grammar, streams, signals, and exit status cannot drift
across unrelated boundary adapters.

## Principle

Ada runs the tool with no arguments and gets the help request, whose answer is
the usage text. She runs `build ./site out` and gets a build request rooted at
`./site` publishing into `out`. She runs `dev --port 8080` and gets a develop
request on port 8080 with the default directory. She runs `inspect /posts/first/`
and gets an inspect request for that target. She runs `build a b c` and is
refused, with the usage text attached. Reporting a line puts it on the operator's
ordinary output; summarizing a run puts one counted sentence there; announcing a
served directory puts its address there; and warning them puts it on their error
output. A hold ends
when she interrupts the process, and a failed command records a nonzero process
exit status.

## State

```state
a set of Holds with
  a state State
  an optional reason Reason
```

A name is one of `help`, `build`, `watch`, `develop`, or `inspect`. A directory
is always present, defaulting to `.`. A destination is present only when the
operator named one. A target is present only for `inspect`, where it is
required. A port is present only for `develop`, defaulting to 3000.

A stream is `output` or `error`. Stream writes are host effects and are not
copied into concept state.

A hold is `holding` until an interrupt or terminate request releases it. Process
listeners exist only while the hold is active. Exit status is a host effect, not
durable concept state.

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
interpret (arguments: OptionalArguments) : return (name: Name, directory: Text, destination: OptionalText, target: OptionalText, port: OptionalNumber)
  where arguments is absent
  then
    read the process arguments after the executable name
  where present arguments is not an ordinary dense list of text values
  then
    refuse INVALID_ARGUMENTS "Arguments must be an ordinary dense list of text values."
  where arguments do not match the grammar
  then
    refuse INVALID_USAGE "Invalid usage."
  then
    return the interpreted request

say (text: Text) : return ()
  where text is not well-formed text
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put text on the operator's ordinary output

summarize (pages: Number, files: Number, written: Number, replaced: Number, kept: Number, removed: Number) : return (text: Text)
  where any count is not a non-negative safe integer
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put one sentence counting those pages, input files, and reconciled artifacts on the
    operator's ordinary output and return its text

announce (directory: Text, host: Text, port: Number) : return ()
  where directory or host is not well-formed text, or port is not a safe integer between 1 and 65535
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put one line naming where that directory is being served on the operator's ordinary
    output

warn (text: Text) : return ()
  where text is not well-formed text
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    put text on the operator's error output

hold () : return (hold: Hold, reason: Reason)
  then
    wait until the operator interrupts or terminates the process
    release the hold, remove its listeners, and return the request that ended it

exit (code: Number) : return (code: Number)
  where code is not a safe integer from 0 through 255
  then
    refuse INVALID_REPORT "A report must be well-formed text."
  then
    set the process exit status and return it
```

`INVALID_USAGE` carries the usage text, so a caller can refuse an operator
without holding its own copy of the grammar.

## Queries

```queries
_hold (hold: Hold) : optional (state: State, reason: OptionalReason)
_holding () : one (holding: Number)
_usage () : one (usage: Text)
_misuse () : one (misuse: Text)
```

`_usage` is what an operator who asked for help should read. `_misuse` is what an
operator who typed something unreadable should read: the same usage text behind
one line naming the problem.

Commanding owns the command-line grammar, usage text, operator streams, process
stop request, and exit status. It does not do what a request asks for, know
whether a directory exists, or decide what application work is worth reporting.
