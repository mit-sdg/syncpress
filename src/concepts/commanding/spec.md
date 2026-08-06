# Commanding

## Purpose

Own one command-line invocation's captured words, operator streams, and terminal
exit status so an application can interact with it without consulting ambient
process state or hiding grammar in the host boundary.

## Principle

Ada invokes a tool with the words `publish notes`. Capturing the invocation
returns those exact words. Her application recognizes them as command `publish`
with operand `notes` outside Commanding. The tool writes a completion message to
her ordinary output and a warning to her error output, then selects exit status
2. Repeating that capture or status is idempotent; different words or a different
status are refused. Supplying an explicit word list instead makes the same
interaction available to an embedding host.

## Types

```types
Arguments = List<Text>
  An ordinary dense list with no extra properties.

Stream = "output" | "error"

ExitCode = SafeInteger
  An integer from 0 through 255 inclusive.
```

## State

```state
an element Invocation with
  an optional words Arguments
  an optional code ExitCode
```

## Actions

```actions
captureArguments (arguments: Arguments | null) : return (words: Arguments)
  where arguments is null
  then
    read the process arguments after its executable and script names
    return a copy
  where present arguments or the read process arguments are not an ordinary dense list of well-formed text values
  then
    refuse INVALID_ARGUMENTS "Arguments must be an ordinary dense list of text values."
  where words were already captured and supplied arguments differ
  then
    refuse INVOCATION_CAPTURED "This command invocation already has different words."
  where present arguments are valid or the invocation was already captured
  then
    retain the first words and return a copy

writeLine (stream: Stream, text: Text) : return (stream: Stream, text: Text)
  where stream is not output or error
  then
    refuse INVALID_STREAM "A command stream must be output or error."
  where text is not well-formed text
  then
    refuse INVALID_TEXT "A command line must be well-formed text."
  then
    write one line to the selected operator stream and return it

setExitStatus (code: ExitCode) : return (code: ExitCode, changed: Flag)
  where code is not a safe integer from 0 through 255
  then
    refuse INVALID_EXIT_CODE "A command exit code must be a safe integer from 0 through 255."
  where another exit status was already selected
  then
    refuse EXIT_SELECTED "This command invocation already has another exit status."
  where this status was already selected
  then
    return it with changed false
  then
    set and retain the process exit status without terminating the process
    return it with changed true
```

## Queries

```queries
_invocation () : optional (words: Arguments)
  Returns no row before capture and a copy of the captured words afterward.

_outcome () : optional (code: ExitCode)
  Returns no row before an exit status is selected.
```
