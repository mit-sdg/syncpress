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

## Types

```types
Values = null | Flag | Number | JavaScriptString | List<Values> | Mapping
Mapping = Map<JavaScriptString, Values>
  Keys are JavaScript strings; no key order is implied.
Policy = Mapping
Path = Text
Name = JavaScriptString
Address = Text
Origin = Text
Direction = "asc" | "desc"
Field = Text
Condition = Mapping
Code = "INVALID_CONFIGURATION"

Problem = record
  code: Code
  message: Text
  line: Number
  column: Number
```

Configured default and collection matches must be portable globs. Collection
sort fields and conditions must satisfy the catalog field and condition
contracts. These failures are policy problems at their YAML locations. An
accepted `site.origin` with a trailing slash is stored without that slash.

## State

```state
a set of Assessments with
  a source Text
  a policy Policy
  a problems seq of Problem
```

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
  Returns no row for an invalid assessment. Every policy projection below uses
  this absence rule and returns deep copies, so partial policy never becomes
  operational.

_paths () : optional (content: Path, templates: Path, public: Path, assets: Path, output: Path)
  Projects the effective project paths.

_sources () : many (name: Name, path: Path)
  Reproduces the content, templates, and public source plan returned by
  successful `assess`, in that fixed order, without requiring reassessment. An
  invalid assessment produces no rows.

_site () : optional (site: Values, base: Address)
  Projects normalized site values and the canonical base address.

_origin () : optional (origin: Origin)
  Returns the normalized origin when one is configured.

_markdown () : optional (extensions: Values, raw: Flag, separator: Text)
  Projects the effective Markdown policy.

_images () : optional (widths: Values, formats: Values)
  Projects the effective image policy.

_defaults () : many (index: Number, text: Text, values: Values)
  Projects normalized default rules with their declaration indexes.

_collections () : many (name: Name, match: Text, direction: Direction, sort: Field | null, condition: Condition | null)
  Projects normalized collection policies.

_deployment () : optional (nojekyll: Flag, requireNotFound: Flag, sitemap: Flag)
  Projects the effective deployment switches.

_publishing () : optional (policy: Policy)
  Projects the complete publishing policy.

_problems () : many (code: Code, message: Text, line: Number, column: Number)
  Lists retained problems in parser discovery order. An invalid policy remains
  as assessment evidence after `assess` refuses `INVALID_CONFIGURATION`, giving
  callers a stable refusal while reactions can report every problem.
```
