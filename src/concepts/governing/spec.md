# Governing

## Purpose

Give static publication one authoritative, location-aware interpretation of its
site policy, so malformed or unsupported settings cannot silently acquire
meaning.

## Principle

Ada assesses a configuration that selects `public-dist`, enables a deployment
marker, and defines one redirect. The resulting policy is valid and has no
problems. She changes the returned policy, but a later read remains unchanged.
She then assesses a replacement with an escaping output path and a redirect
cycle. Both source-located problems become current and none of the earlier
deployment policy remains. Repeating that source replaces nothing and adds no
duplicate problem.

## State

```state
an optional Assessment with
  a source Text
  a policy Policy
  an ordered sequence of Problems
```

Governing is an application-specific schema adapter rather than a reusable
domain mechanism. The source is authoritative input; the interpreted policy is
authoritative for publication. `Configuring` may independently retain the
generic YAML tree, but Governing copies no Configuring state and never refreshes
from it. Each `assess` atomically replaces the interpretation and all problems.

## Actions

```actions
assess (source: Text) : return (policy: Policy, valid: Flag)
  then
    replace the current assessment with the parsed Syncpress policy and every policy problem
    return a copy of the policy and whether it has no problems
```

## Queries

```queries
_policy () : optional (policy: Policy, valid: Flag)
_deployment () : optional (nojekyll: Flag, requireNotFound: Flag, sitemap: Flag)
_publishing () : optional (policy: Policy)
_problems () : many (code: Code, message: Text, line: Number, column: Number)
```

Problems retain parser discovery order. Actions and queries return deep copies.
Invalid product policy is assessment data rather than a refusal so callers can
report every problem together. `_deployment` and `_publishing` answer no row for
an invalid assessment, so partial policy never acquires operational meaning.
Governing reports malformed YAML defensively when called directly; Configuring
remains authoritative for the application's complete normalized YAML subset.
