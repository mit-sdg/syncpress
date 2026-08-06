# Governing

## Purpose

Give static publication one authoritative, location-aware interpretation of its
site policy, so malformed or unsupported settings cannot silently acquire
meaning.

## Principle

Ada assesses a configuration that selects `public-dist`, defines site data,
source defaults, a collection, Markdown and image settings, enables a deployment
marker, and defines one redirect. The complete admitted policy is normalized and
has no problems. She changes the returned policy, but a later read remains
unchanged. She then assesses a replacement with an escaping output path and a
redirect cycle. The action refuses after atomically replacing the assessment;
both source-located problems become current and none of the earlier policy is
admitted. Repeating that source adds no duplicate problem.

## State

```state
an optional Assessment with
  a source Text
  a policy Policy, including all effective project paths
  an ordered sequence of Problems
```

Governing is an application-specific schema adapter rather than a reusable
domain mechanism. The source is authoritative input and the complete interpreted
policy is authoritative for publication. No peer reparses or interprets the
configuration. Each `assess` atomically replaces the interpretation and all
problems, including when the action then refuses invalid policy.

Configured default and collection matches must be portable globs. Collection
sort fields and conditions must satisfy the catalog field and condition
contracts. These failures are policy problems at their YAML locations. An
accepted `site.origin` with a trailing slash is stored without that slash.

## Actions

```actions
assess (source: Text) : return (policy: Policy, sources: Values)
  then
    replace the current assessment with the parsed Syncpress policy and every policy problem
  where the replacement has problems
  then
    refuse INVALID_CONFIGURATION "The assessed site configuration is invalid."
  where the replacement has no problems
  then
    return a copy of its policy and the content, templates, and public source plan
```

## Queries

```queries
_policy () : optional (policy: Policy)
_paths () : optional (content: Path, templates: Path, public: Path, assets: Path, output: Path)
_sources () : many (name: Name, path: Path)
_site () : optional (site: Values, base: Address)
_origin () : optional (origin: Origin)
_markdown () : optional (extensions: Values, raw: Flag, separator: Text)
_images () : optional (widths: Values, formats: Values)
_defaults () : many (index: Number, text: Text, values: Values)
_collections () : many (name: Name, match: Text, direction: Direction, sort: OptionalField, condition: OptionalCondition)
_deployment () : optional (nojekyll: Flag, requireNotFound: Flag, sitemap: Flag)
_publishing () : optional (policy: Policy)
_problems () : many (code: Code, message: Text, line: Number, column: Number)
```

`_sources` answers the same content, templates, and public source plan `assess`
returns, in that fixed order, so a caller can rediscover it without repeating an
assessment.

Problems retain parser discovery order. Actions and queries return deep copies.
Invalid product policy is retained assessment evidence and an
`INVALID_CONFIGURATION` refusal, so callers receive a stable outcome while
reactions can report every problem. Every policy query answers no row for an
invalid assessment, so partial policy never acquires operational meaning.
