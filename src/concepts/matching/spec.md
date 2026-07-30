# Matching

## Purpose

Admit reusable path selectors under one stable glob contract and answer whether
paths match them, so malformed syntax is refused before a selector is used.

## Principle

Ada admits `posts/**/*.md`, where `**` means any folders. The pattern selects
`posts/compiler-design/index.md`, but not `about/index.md` or
`posts/notes.txt`. Admitting the exact text again returns the same pattern without
adding another one. Admitting the broken pattern `posts/**{` is refused and adds
nothing. A pattern that was never saved selects no path.

## State

```state
a set of Patterns with
  a text Text
```

At most one pattern exists for each exact text. A pattern's identity is that
accepted text, unchanged: Matching does not trim, rewrite, or otherwise
normalize it. Distinct texts remain distinct patterns even when their syntax
selects the same paths.

Patterns and paths use one portable glob contract:

- A match covers the whole path, not a substring or only its last segment.
- `/` is the only path separator. A backslash in a path is an ordinary
  character, not a separator.
- Matching is case-sensitive.
- Wildcards include names and segments that begin with `.`.
- `?` selects one non-separator character, `*` selects zero or more
  non-separator characters, and `**` can select across separators when it is a
  whole segment.
- `[abc]` selects one listed character; ranges such as `[a-z]`, negated classes
  such as `[!a]` or `[^a]`, and POSIX classes such as `[[:digit:]]` are
  supported.
- Comma braces such as `*.{md,html}` select alternatives. Extglobs
  `@(a|b)`, `?(a|b)`, `*(a|b)`, `+(a|b)`, and `!(a|b)` are supported.
- A backslash escapes the following pattern character. A double-quoted run
  treats its pattern characters literally and does not include the quotes in
  the selected path.
- A leading `!` is literal and never negates the whole pattern. `!(...)` keeps
  its extglob meaning.

Empty text, an unterminated quoted run, unmatched brackets or parentheses, an
unmatched opening brace, an invalid character class or range, and any other
text the glob parser or compiler cannot interpret are malformed. Literal glob
characters can instead be escaped, quoted, or placed in a legal character
class.

## Actions

```actions
compile (text: Text) : return (pattern: Pattern)
  where text is malformed
  then
    refuse MALFORMED_PATTERN "This pattern cannot be interpreted."
  where text is well formed
  then
    if some pattern has this exact text
      return that pattern
    otherwise
      add a pattern with text
      return pattern
```

## Queries

```queries
_matches (pattern: Pattern, path: Path) : one (matched: Flag)
_compiled (text: Text) : optional (pattern: Pattern)
```

Matching owns pattern syntax, not the paths it receives or the policy that a
match implies. Compilation is behavioral admission under this contract, not
merely a performance cache.
