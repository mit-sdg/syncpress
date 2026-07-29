# Converting

## Purpose

Convert Markdown to HTML or pass verbatim text through unchanged, while keeping
independent, reusable results for named parts of a subject.

## Principle

Ada declares an explicit Markdown profile with tables, footnotes,
strikethrough, autolinks, raw HTML, and an excerpt separator. Each option changes
only its advertised syntax. Converting two parts of one subject keeps both
results. Repeating an unchanged conversion reuses it. A separator creates an
excerpt even when it occurs at the beginning; no separator means no excerpt. A
verbatim profile returns its source exactly. Replacing a profile revokes its old
identity and conversions, and an unknown profile is refused.

## Profiles And Markdown

A profile has a `kind` of exactly `markdown` or `verbatim`. The kind selects the
engine; a profile's name never does.

Markdown uses Marked 18.0.7's non-pedantic block and inline grammar, emits
synchronous HTML, and does not turn single newlines into hard breaks. Fenced
code, headings, lists, links, CommonMark angle-bracket autolinks, and the other
base Markdown forms are always available. GFM task-list markers remain literal
text. Four optional extensions are supported independently:

- `tables` recognizes GFM pipe tables.
- `strikethrough` recognizes GFM `~~text~~` deletion.
- `autolinks` recognizes GFM bare web addresses and email addresses. It does not
  govern the base grammar's angle-bracket autolinks.
- `footnotes` recognizes case-insensitive ASCII labels made from letters,
  digits, `_`, and `-`. A reference is `[^label]`; a definition starts
  `[^label]: text` with optional following lines indented by four spaces or one
  tab. Definitions require content and must be unique after case folding.
  Referenced definitions are removed from their written position and emitted in
  first-reference order in a final `section.footnotes`; repeated references get
  distinct backlinks. Undefined references remain literal and unreferenced
  definitions emit nothing.

With `raw` true, authored HTML is copied into the generated HTML. With `raw`
false, authored inline and block HTML is HTML-escaped; HTML generated from
Markdown remains markup. This is an encoding control, not sanitization.

A verbatim profile requires no extensions and `raw` true, and its output is the
exact source. Its separator still controls excerpts.

Only the four extension names above are accepted. Extensions are a set:
declaration order is irrelevant, while a duplicate is malformed. Declaration
copies its options, and profile queries return fresh extension arrays.

## Excerpts, Identity, And Caching

An empty separator disables excerpts. Otherwise the first exact, case-sensitive
occurrence splits the source. The excerpt is the independently converted prefix,
excluding the separator. A separator at the beginning therefore creates a
present empty excerpt; one at the end creates the conversion of the whole prefix.
The separator remains part of the full source and is converted rather than
removed. Conversion does not evaluate Liquid or any other template notation, so
an application may evaluate Liquid before converting without interference.

At most one current profile has a name and one conversion has a `(subject,
part)` slot. Profile identity is the SHA-256 digest of a canonical tuple
containing its name and normalized settings. Conversion identity is the SHA-256
digest of the canonical `(subject, part)` tuple, so punctuation in either value
cannot create delimiter collisions. Both identities are stable across concept
instances.

A conversion cache hit requires the same current profile and exact source text
in the same slot. A changed source replaces the slot while preserving its stable
slot identity. Redeclaring normalized settings unchanged returns the same
profile with `changed` false. Changed settings revoke the previous profile,
remove every conversion made with it, mint the new settings identity, and return
`changed` true. A revoked profile cannot be converted with. Declaring its exact
settings again later reactivates the same content-addressed profile identity.

The stored digest is SHA-256 of the exact source. Cache equality also compares
the source text itself rather than relying on digest equality alone.

Declaration and conversion are atomic. A refused declaration changes nothing.
If Markdown processing fails, including because a footnote definition is empty
or duplicated, the prior conversion in that slot remains unchanged.

## State

```state
a set of Profiles with
  a name Name
  a kind Kind
  a set of Extensions
  a raw Flag
  a separator Text

a set of Conversions with
  a subject Subject
  a part Part
  a profile Profile
  a source Text
  a digest Digest
  an output Text
  an optional excerpt Text
```

## Actions

```actions
declare (name: Name, kind: Kind, extensions: Extensions, raw: Flag, separator: Text) : return (profile: Profile, changed: Flag)
  where name, kind, extensions, raw, or separator has the wrong value kind; name is empty; or an extension is duplicated
  then
    refuse INVALID_PROFILE "This rendering profile is malformed."
  where kind is not markdown or verbatim
  then
    refuse UNSUPPORTED_PROFILE_KIND "This rendering profile kind is not supported."
  where an extension is not tables, footnotes, strikethrough, or autolinks
  then
    refuse UNSUPPORTED_EXTENSION "This Markdown extension is not supported."
  where a verbatim profile has extensions or raw false
  then
    refuse INCOMPATIBLE_PROFILE "A verbatim profile requires no extensions and raw true."
  where the named profile has the same normalized settings
  then
    return that profile and changed false
  where the named profile is new or has different normalized settings
  then
    revoke any previous profile with name and remove every conversion made with it
    add the new profile with copied, normalized settings
    return it and changed true

convert (subject: Subject, part: Part, profile: Profile, source: Text) : return (conversion: Conversion, output: Text)
  where profile is not a current profile
  then
    refuse PROFILE_NOT_FOUND "There is no such current rendering profile."
  where subject, part, or source is not text
  then
    refuse INVALID_CONVERSION_INPUT "A conversion subject, part, and source must be text."
  where the slot has this profile and exact source
  then
    return its stored conversion and output
  where Markdown processing fails
  then
    refuse CONVERSION_FAILED "This text could not be converted."
  where conversion succeeds and is not cached
  then
    atomically replace the conversion for subject and part
    return its stable slot identity and output

release (subject: Subject) : return (subject: Subject, count: Number)
  where subject is not text
  then
    refuse INVALID_SUBJECT "A conversion subject must be text."
  where subject is text
  then
    remove every conversion for subject
    return subject and how many were removed
```

## Queries

```queries
_profile (name: Name) : optional (profile: Profile, kind: Kind, extensions: Extensions, raw: Flag, separator: Text)
_conversion (conversion: Conversion) : optional (subject: Subject, part: Part, profile: Profile, digest: Digest, output: Text)
_for (subject: Subject, part: Part) : optional (conversion: Conversion, profile: Profile, digest: Digest, output: Text)
_excerpt (subject: Subject, part: Part) : optional (conversion: Conversion, excerpt: Text)
```

`_excerpt` is absent when the source contained no separator and present with
empty text when the separator occurred at the beginning.

Converting does not choose a profile for a subject, evaluate templates, sanitize
HTML, or decide where output and excerpts are inserted.

Declaration checks malformed value kinds and duplicates first, then profile
kind, then unsupported extensions, then verbatim compatibility. That order fixes
the refusal when one request violates more than one rule.
