# Governing

## Purpose

Assess a Syncpress site configuration against product policy and expose the
validated publishing policy and every source-located problem.

## Principle

Ada assesses a site configuration. A valid configuration exposes its output and
deployment policy with no problems. Assessing an invalid replacement exposes
all of that replacement's problems and does not retain the prior policy state.
Repeating the same assessment adds no duplicate state, and returned values cannot
mutate the stored assessment.

## State

```state
an optional Assessment with
  a source Text
  a policy Policy
  an ordered sequence of Problems
```

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

Problems retain parser discovery order. Actions and queries return copies.
Invalid product policy is assessment data rather than a refusal so callers can
report every problem together. Generic notation and YAML structural failures
remain the responsibility of Configuring.
