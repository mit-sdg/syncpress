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

## Text And Locations

Text is a well-formed Unicode string. Scopes, codes, messages, sources, diagnostic
identities, and relation notes must be Text. Empty Text and control characters
are valid; Diagnosing stores and compares these values but does not interpret
their vocabulary. Actions refuse malformed Text before changing state. Lookup
queries given malformed Text answer no row.

A diagnostic scope is optional and identifies the check that owns replacement
of the diagnostic. A diagnostic source is also optional. Omission and explicit
undefined mean that the problem has no source. A line is optional and requires a source. A column is
optional and requires a line. Present lines and columns are one-based positive
safe integers. A related location always has a source and has the same optional
line and column rules.

Query rows always have own `scope`, `source`, `line`, and `column` properties when those
fields are declared. A missing value is returned as undefined. This lets a row
remain visible while a caller chooses whether to display each location detail.

## Identity And Lifecycle

A diagnostic is keyed by its optional scope, severity, code, optional source,
optional line, and optional column. Its opaque identity is a deterministic, collision-safe encoding
of that tuple, so punctuation and control characters cannot make two keys
collide. The identity is stable across concept instances, scope-and-source retraction, and
later reporting of the same key.

Reporting an existing key returns its identity without changing its first
message or its related locations. To replace what a check previously reported,
a caller first retracts that scope and source and reports the current problems.
Retracting a missing source does the same for diagnostics with no source in that
scope. Repeated
retraction is an idempotent no-op.

A related location is keyed by its diagnostic, source, optional line, optional
column, and note. Repeating it returns the same stable identity; another note or
location remains a separate relation. Removing a diagnostic also removes all of
its relations. A relation's source does not make its diagnostic belong to that
source: retraction uses only each diagnostic's own optional scope and source.

`clear` removes every diagnostic and relation and counts diagnostics, not
relations. Reporting a cleared key reuses its stable identity but stores the new
first message and starts with no relations. These rules support both a fresh
task that clears once and repeated work that retracts only the source being
checked again.

## State

```state
a set of Diagnostics with
  an optional scope Scope
  a severity Severity                 -- error or warning
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

At most one diagnostic exists per scope, severity, code, source, line, and column. At
most one relation exists per diagnostic, source, line, column, and note. No
relation exists without its diagnostic.

## Actions

```actions
report (scope: OptionalScope, severity: Severity, code: Code, message: Text, source: OptionalSource, line: OptionalNumber, column: OptionalNumber) : return (diagnostic: Diagnostic)
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
  where no diagnostic has that key
  then
    add it and return its stable identity

relate (diagnostic: Diagnostic, source: Source, line: OptionalNumber, column: OptionalNumber, note: Text) : return (relation: Relation)
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
    return it without adding a copy
  where that exact relation does not exist
  then
    add it and return its stable identity

retract (scope: OptionalScope, source: OptionalSource) : return (scope: OptionalScope, source: OptionalSource, count: Number)
  where a present scope or source is not Text
  then
    refuse INVALID_TEXT "Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text."
  where scope and source are Text or missing
  then
    remove every diagnostic with that optional scope and source and all of its relations
    return scope, source, and how many diagnostics were removed

clear () : return (count: Number)
  then
    remove every diagnostic and relation
    return how many diagnostics were removed
```

## Queries

```queries
_all () : many (diagnostic: Diagnostic, scope: OptionalScope, severity: Severity, code: Code, message: Text, source: OptionalSource, line: OptionalNumber, column: OptionalNumber)
_errors () : many (diagnostic: Diagnostic, scope: OptionalScope, code: Code, message: Text, source: OptionalSource, line: OptionalNumber, column: OptionalNumber)
_for (source: OptionalSource) : many (diagnostic: Diagnostic, scope: OptionalScope, severity: Severity, code: Code, message: Text, line: OptionalNumber, column: OptionalNumber)
_related (diagnostic: Diagnostic) : many (source: Source, line: OptionalNumber, column: OptionalNumber, note: Text)
_rendered () : one (text: Text)
_clean () : one (clean: Flag)
```

## Ordering And Cleanliness

`_all` orders errors before warnings. Within one severity, a missing scope comes
before a present scope; present scopes use ascending UTF-8 byte order. Scope is
followed by source, with a missing source before a present source and present
sources using ascending UTF-8 byte order. Within
one source, a missing line comes before a present line and lines rise
numerically. Within one line, a missing column comes before a present column and
columns rise numerically. Codes finally use ascending UTF-8 byte order. Because
the complete ordering key is also the diagnostic uniqueness key, this is a total
order independent of reporting order.

`_errors` and `_for` preserve the corresponding order from `_all`. `_related`
orders by source in ascending UTF-8 byte order, then line, column, and note, with
missing positions first. Its uniqueness key makes that order total too.

`_rendered` writes every standing diagnostic as one line each, in `_all` order:
the upper-case severity, the code, the source and position when there is one,
and the message. It answers one fixed sentence when nothing stands, so a caller
always has something to show a person.

`_clean` always returns exactly one row. It is true when no error stands, even if
warnings stand, and false otherwise. A caller may use that level as a gate, but
Diagnosing does not decide what a clean or unclean task is allowed to do.
