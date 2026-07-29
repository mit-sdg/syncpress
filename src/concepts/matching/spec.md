# Matching

## Purpose

Compile a selection pattern and test paths against it, so the same rule can be
declared once and applied everywhere.

## Principle

Ada compiles `posts/**/*.md`. It matches
`posts/compiler-design/index.md`, but not `about/index.md` or
`posts/notes.txt`. Compiling it again returns the same pattern. Compiling the
malformed pattern `posts/**{` is refused, and an uncompiled pattern matches
nothing.

## State

```state
a set of Patterns with
  a text Text
```

## Actions

```actions
compile (text: Text) : return (pattern: Pattern)
  where text is malformed
  then
    refuse MALFORMED_PATTERN "This pattern cannot be interpreted."
  where text is well formed
  then
    add a pattern with text if none has it
    return pattern
```

## Queries

```queries
_matches (pattern: Pattern, path: Path) : one (matched: Flag)
_compiled (text: Text) : optional (pattern: Pattern)
```

Matching owns pattern syntax, not the paths it receives or the policy that a
match implies.
