# Commanding

## Purpose

Expose one command-line invocation's words, application-selected command,
operator streams, and eventual exit status so an application can interact with
it without consulting ambient process state or hiding grammar in the host
boundary.

## Principle

Ada invokes a tool with the words `publish notes`. Capturing the invocation
returns those exact words. Her application recognizes them as command `publish`
with operand `notes`; Commanding returns that selection without choosing it. The
tool writes a completion line to her ordinary output and a warning to her error
output, then selects exit status 2. Supplying an explicit word list instead makes
the same interaction available to an embedding host.

## Values

Arguments are an ordinary dense list of well-formed text values with no extra
properties. A stream is `output` or `error`. An exit code is a safe integer from
0 through 255.

Commanding copies captured arguments. Each successful write emits one line;
repeating it deliberately emits another line. Selecting an exit status records
the process outcome but does not terminate it before application cleanup.

## Actions

```actions
capture (arguments: OptionalArguments) : return (words: Arguments)
  where arguments is absent
  then
    read the process arguments after its executable and script names
    return a copy
  where present arguments or the read process arguments are not an ordinary dense list of well-formed text values
  then
    refuse INVALID_ARGUMENTS "Arguments must be an ordinary dense list of text values."
  where present arguments are valid
  then
    return a copy

recognize (name: Name, operands: Arguments) : return (name: Name, operands: Arguments)
  where name is not non-empty well-formed text or operands is not an ordinary dense list of well-formed text values
  then
    refuse INVALID_COMMAND "A recognized command needs a non-empty text name and ordinary dense text operands."
  then
    return the name and a copy of the operands selected by the application

write (stream: Stream, text: Text) : return (stream: Stream, text: Text)
  where stream is not output or error
  then
    refuse INVALID_STREAM "A command stream must be output or error."
  where text is not well-formed text
  then
    refuse INVALID_TEXT "A command line must be well-formed text."
  then
    write one line to the selected operator stream and return it

exit (code: Number) : return (code: Number)
  where code is not a safe integer from 0 through 255
  then
    refuse INVALID_EXIT_CODE "A command exit code must be a safe integer from 0 through 255."
  then
    set and return the process exit status
```

Commanding owns access to one command-line process's invocation words, canonical
application selection, output channels, and exit status. It does not define a
command grammar, select which command the words mean, provide usage text, format
an application report, own stop policy, or perform the selected work.
