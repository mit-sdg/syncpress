# Rendering

## Purpose

Track each page rendering attempt through body and layout settlement, so later
behavior observes one terminal event for the active owner attempt.

## Principle

Ada begins a page with its selected profile and template and exact dependency
and output attempts. Settling the body and then the layout advances it to completion in order.
Repeating a settled transition reports no change. Retrying the same exact owner
attempts returns the same rendering. Beginning the page with two newer attempts
supersedes unfinished work, while an older or inconsistent pair is refused and
late completion of superseded work reports no change. Failing active work makes
the attempt terminal and reports no second transition when repeated.

## Types

```types
Subject = Text
  A page identity.

Path = Text
  A portable source path.

Profile = Text
  An application-selected profile name, not a profile identity.

TemplateName = Text
  An application-selected template name, not a template identity.

Stage = "started" | "body-settled" | "completed" | "failed" | "superseded"

AttemptRow = record
  subject: Subject
  path: Path
  profile: Profile
  template: TemplateName
  stage: Stage
  failure: Text | undefined
  dependencyAttempt: PositiveInteger
  emissionAttempt: PositiveInteger
```

## State

```state
a set of Renderings with
  a subject Subject
  a path Path
  a profile Profile
  a template TemplateName
  a dependencyAttempt PositiveInteger
  an emissionAttempt PositiveInteger
  a stage Stage
  an optional failure Text
  a startOrder Number
```

## Actions

```actions
begin (subject: Subject, path: Path, profile: Profile, template: TemplateName, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger) : return (rendering: Rendering, subject: Subject, profile: Profile, template: TemplateName, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)
  where subject, path, profile, or template is not Text
  then
    refuse INVALID_TEXT "Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text."
  where either attempt is not a positive safe integer
  then
    refuse INVALID_ATTEMPT "Rendering attempts require valid dependency and emission attempt identities."
  where the pair equals the latest pair and selects the same source policy
  then
    return the latest rendering without changing state
  where either attempt is not newer than the latest pair, or an equal pair selects different source policy
  then
    refuse STALE_ATTEMPT "This rendering owner-attempt pair is stale or inconsistent."
  then
    supersede the subject's unfinished latest rendering if one exists
    add and remember a started rendering with its selected profile and template
    return the new rendering, subject, profile, and template

settleBody (rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)
  where rendering is unknown
  then
    refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
  where rendering is started
  then
    make it body-settled and return transitioned true
  where rendering is already body-settled, later, or superseded
  then
    return transitioned false

settleLayout (rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)
  where rendering is unknown
  then
    refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
  where rendering is started
  then
    refuse STAGE_NOT_READY "The rendering attempt has not reached the required stage."
  where rendering is body-settled
  then
    make it completed and return transitioned true
  where rendering is already completed, failed, or superseded
  then
    return transitioned false

fail (rendering: Rendering, reason: Text) : return (rendering: Rendering, subject: Subject, transitioned: Flag)
  where rendering is unknown
  then
    refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
  where reason is not Text
  then
    refuse INVALID_TEXT "Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text."
  where rendering is started or body-settled
  then
    make it failed with reason and return transitioned true
  where rendering is already completed, failed, or superseded
  then
    return transitioned false
```

## Queries

```queries
_attempt (rendering: Rendering) : optional AttemptRow
  Includes historical superseded and completed attempts and returns no row for
  an unknown Rendering. In this and the other optional queries, failure is
  present and undefined unless the attempt failed. No query returns a mutable
  value.

_active (rendering: Rendering) : optional AttemptRow
  Returns the attempt only while it is its subject's latest unfinished attempt.
  An unknown or inactive Rendering returns no row.

_latest (subject: Subject) : optional (rendering: Rendering, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure: Text | undefined, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)
  Returns the most recently begun attempt for the subject, or no row for an
  unknown Subject.

_all () : many (rendering: Rendering, subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure?: Text, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)
  Returns all attempts in start order. Failure is omitted from a row unless the
  attempt failed.
```

## Contracts

```contracts
contract one-current-attempt-per-subject
  For each Subject, at most one Rendering is latest and at most one is active.
```
