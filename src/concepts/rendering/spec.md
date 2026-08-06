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

## Values

Text is a well-formed Unicode string. Subjects identify pages. Paths are
portable source paths. Profile and template names are application-selected Text
retained for their owning concepts to resolve.

A Stage is `started`, `body-settled`, `completed`, `failed`, or `superseded`.

## State

```state
a set of Renderings with
  a subject Subject
  a source path Path
  a selected profile Profile
  a selected template TemplateName
  a dependency attempt Number
  an emission attempt Number
  a stage Stage
  an optional failure Text
  a start order Number

at most one latest Rendering for each Subject
at most one active Rendering for each Subject
```

The first valid owner-attempt pair creates a rendering identity. Retrying that
same pair with the same selected source policy returns its identity without
changing state. A pair whose dependency and emission attempts are both newer
creates another rendering; if the latest attempt is unfinished, it is marked
superseded. A pair with either identity not newer is stale.
Completed and superseded attempts remain queryable as historical evidence.
The latest attempt is active while started or body-settled.

## Actions

```actions
begin (subject: Subject, path: Path, profile: Profile, template: TemplateName, dependencyAttempt: Number, emissionAttempt: Number) : return (rendering: Rendering, subject: Subject, profile: Profile, template: TemplateName, dependencyAttempt: Number, emissionAttempt: Number)
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
_attempt (rendering: Rendering) : optional (subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure: OptionalText, dependencyAttempt: Number, emissionAttempt: Number)
_active (rendering: Rendering) : optional (subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure: OptionalText, dependencyAttempt: Number, emissionAttempt: Number)
_latest (subject: Subject) : optional (rendering: Rendering, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure: OptionalText, dependencyAttempt: Number, emissionAttempt: Number)
_all () : many (rendering: Rendering, subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure: OptionalText, dependencyAttempt: Number, emissionAttempt: Number)
```

`_attempt` includes historical superseded and completed attempts. `_active`
returns an attempt only while it is the subject's latest unfinished attempt.
`_latest` returns the most recently begun attempt for a subject. `_all` lists
attempts in start order.

Rendering records attempt lifecycle and selected policy. It does not select that policy, fill
templates, convert source, resolve references, emit output, or decide that
outside work has settled. Reactions report those milestones through its
actions.
