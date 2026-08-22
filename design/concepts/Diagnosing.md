# Diagnosing

## Purpose

Keep the problems found during a task together, so people can see everything
available in one stable, ordered report.

## Principle

Ada checks two records. She reports an error in one, a warning in the other, and
another error later in the first. Reading the list gives both errors before the
warning, with problems at the same severity ordered by source, position, and
code. One error names a related place to inspect. Reporting that error and its
related place again makes no copies. While either error remains the check is not
clean. Retracting the first record's problems leaves the warning and makes the
check clean; clearing leaves no problems at all.

The concept retains this value vocabulary and its constraints:

`Scope = Text` The check that owns replacement of a diagnostic.

`Code = Text` An application-defined diagnostic code.

`DiagnosticSource = Text` An application-defined source location name.

`Severity = "error" | "warning"`

`Position = PositiveInteger` A one-based line or column.

Text is a well-formed Unicode string. Scopes, codes, messages, sources, diagnostic identities, and relation notes must be Text. Empty Text and control characters are valid; Diagnosing stores and compares these values but does not interpret their vocabulary. Actions refuse malformed Text before changing state. Lookup queries given malformed Text answer no row.

A diagnostic scope and source are optional. Omission and explicit `undefined` both mean absence. A line is optional and requires a source. A column is optional and requires a line. A related location always has a source and follows the same optional line and column rules.

A diagnostic is keyed by its optional scope, severity, code, optional source, optional line, and optional column. Its opaque identity is a deterministic, collision-safe encoding of that tuple, so punctuation and control characters cannot make two keys collide. The identity is stable across concept instances, scope-and-source retraction, and later reporting of the same key.

A related location is keyed by its diagnostic, source, optional line, optional column, and note. Repeating it returns the same stable identity; another note or location remains a separate relation. Relation identities are deterministic and stable under the same conditions.

## Types

```types
```

## State

```state
a set of Diagnostics with
  an optional scope Scope
  a severity Severity
  a code Code
  a message Text
  an optional source DiagnosticSource
  an optional line Position
  an optional column Position

a set of Relations with
  a diagnostic Diagnostic
  a source DiagnosticSource
  an optional line Position
  an optional column Position
  a note Text

Rule: diagnostic-keys: At most one Diagnostic exists per scope, Severity, Code, source, line, and column, and at most one Relation exists per Diagnostic, DiagnosticSource, line, column, and note.
Rule: relation-owner: Every Relation refers to a present Diagnostic.
```

## Actions

```actions
report(scope?: Scope, severity: Severity, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position) : return (diagnostic: Diagnostic)
  where severity is neither error nor warning
  then
    refuse UNKNOWN_SEVERITY "A diagnostic is an error or a warning."
  where a present scope, code, message, or a present source is not Text
  then
    refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
  where a position is not a positive safe integer, has no source, or has a column without a line
  then
    refuse INVALID_LOCATION "A location needs a source; line and column must be positive safe integers, and a column needs a line."
  where a diagnostic already has scope, severity, code, source, line, and column
  then
    retain its first message and relations and return that diagnostic
    return diagnostic
  where no diagnostic has that key
  then
    add it and return its stable identity
    return diagnostic

addRelatedLocation(diagnostic: Diagnostic, source: DiagnosticSource, line?: Position, column?: Position, note: Text) : return (relation: Relation)
  where diagnostic, source, or note is not Text
  then
    refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
  where diagnostic not in diagnostics
  then
    refuse DIAGNOSTIC_NOT_FOUND "There is no such diagnostic."
  where a position is not a positive safe integer or has a column without a line
  then
    refuse INVALID_LOCATION "A location needs a source; line and column must be positive safe integers, and a column needs a line."
  where that exact relation exists
  then
    produce it without adding a copy
    return relation
  where that exact relation does not exist
  then
    add it and return its stable identity
    return relation

retractGroup(scope?: Scope, source?: DiagnosticSource) : return (scope?: Scope, source?: DiagnosticSource, count: Number)
  where a present scope or source is not Text
  then
    refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
  where scope and source are Text or missing
  then
    remove every diagnostic with that optional scope and source and all of its relations
    return scope, source, count

clear() : return (count: Number)
  where true
  then
    remove every diagnostic and relation
    produce how many diagnostics were removed
    return count
```

## Queries

```queries
_all () : many (diagnostic: Diagnostic, scope?: Scope, severity: Severity, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position)
  Orders errors before warnings, then by scope, source, line, column, and code.
  Missing scopes, sources, lines, and columns sort before present values;
  present scopes and sources and all codes use ascending UTF-8 byte order, and
  positions use ascending numeric order. The uniqueness key makes this a total
  order independent of reporting order. `scope`, `source`, `line`, and `column`
  are always own properties; an absent value is `undefined`.

_errors () : many (diagnostic: Diagnostic, scope?: Scope, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position)
  Returns the errors in their `_all` order. `scope`, `source`, `line`, and
  `column` are always own properties; an absent value is `undefined`.

_for (source?: DiagnosticSource) : many (diagnostic: Diagnostic, scope?: Scope, severity: Severity, code: Code, message: Text, line?: Position, column?: Position)
  Treats an omitted or explicit `undefined` source as the absent source and
  returns no rows for a malformed source. Matching diagnostics retain their
  `_all` order. `scope`, `line`, and `column` are always own properties; an
  absent value is `undefined`.

_related (diagnostic: Diagnostic) : many (source: DiagnosticSource, line?: Position, column?: Position, note: Text)
  Returns no rows for an unknown or malformed Diagnostic. Orders by source in
  ascending UTF-8 byte order, then line, column, and note, with missing
  positions first. The uniqueness key makes this a total order. `line` and
  `column` are always own properties; an absent value is `undefined`.

_rendered () : one (text: Text)
  Writes one entry per standing Diagnostic in `_all` order: upper-case
  severity, code, optional source and position, and message. Entries are
  newline-separated, and newlines in messages remain present. Returns one fixed
  sentence when no Diagnostic stands.

_clean () : one (clean: Flag)
  Always returns one row. `clean` is true when no error stands, including when
  warnings stand, and false otherwise.
```
