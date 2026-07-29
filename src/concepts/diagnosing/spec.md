# Diagnosing

## Purpose

Collect the problems that independent checks find, so one run reports all of
them together and a later run can retract the ones that no longer apply.

## Principle

Three problems are reported: an error in one file, a warning in another, and a
second error in the first file at a later line. Reading them answers errors
before warnings and, within one severity, orders them by source and then by
position. A related location is attached to the first error and comes back with
it. The run is not clean while an error stands; a run holding only the warning
is clean. Retracting everything attached to the first file leaves the warning,
and the run is then clean. Reporting the same code at the same place twice
records one.

## State

```state
a set of Diagnostics with
  a severity Severity   -- error or warning
  a code Code
  a message Text
  an optional source Source
  an optional line Number
  an optional column Number

a set of Relations with
  a diagnostic Diagnostic
  a source Source
  an optional line Number
  an optional column Number
  a note Text
```

At most one diagnostic exists per severity, code, source, line, and column.
`_all` answers errors before warnings, then by source in ascending byte order,
then by line and column, then by code.

## Actions

```actions
report (severity: Severity, code: Code, message: Text, source: Source, line: Number, column: Number) : return (diagnostic: Diagnostic)
  where severity is neither error nor warning
  then
    refuse UNKNOWN_SEVERITY "A diagnostic is an error or a warning."
  where severity is error or warning
  then
    add a diagnostic if none matches severity, code, source, line, and column
    return diagnostic

relate (diagnostic: Diagnostic, source: Source, line: Number, column: Number, note: Text) : return (relation: Relation)
  where diagnostic not in diagnostics
  then
    refuse DIAGNOSTIC_NOT_FOUND "There is no such diagnostic."
  where diagnostic in diagnostics
  then
    add a relation with diagnostic, source, line, column, and note
    return relation

retract (source: Source) : return (source: Source, count: Number)
clear () : return (count: Number)
```

## Queries

```queries
_all () : many (diagnostic: Diagnostic, severity: Severity, code: Code, message: Text, source: Source, line: Number, column: Number)
_errors () : many (diagnostic: Diagnostic, code: Code, message: Text, source: Source, line: Number, column: Number)
_for (source: Source) : many (diagnostic: Diagnostic, severity: Severity, code: Code, message: Text, line: Number, column: Number)
_related (diagnostic: Diagnostic) : many (source: Source, line: Number, column: Number, note: Text)
_clean () : one (clean: Flag)
```

Accumulation is the default and refusal is not: a check that finds a problem
reports it and the run continues. `retract` by source removes the diagnostics a
rebuild will replace.
