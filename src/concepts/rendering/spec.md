# Rendering

## Purpose

Track each page rendering attempt from source selection through body and layout
settlement, so later behavior observes one completion event for each stage.

## Principle

Ada begins a Markdown page without rendering controls, so its attempt uses the
markdown profile and default page template. She begins an HTML page and it uses
verbatim. Explicitly selected profile and template names are preserved instead.
Settling the body, then the layout, then the attempt advances it in order.
Repeating a settled transition reports no change. Beginning the page again
supersedes its unfinished attempt, and late completion of that old attempt
reports no change.

## Values

Text is a well-formed Unicode string. Subjects identify pages. Paths are
portable source paths. Data is an ordinary record containing resolved page
values. Rendering reads optional `build.markup` and `build.template` Text from
that record. Without them, it selects `markdown` for a `.md` path or `verbatim`
for an `.html` path and selects the `page.html` template. Explicit names are
retained for their owning concepts to resolve.

A Stage is `started`, `body-settled`, `layout-settled`, `completed`, or
`superseded`.

## State

```state
a set of Renderings with
  a subject Subject
  a source path Path
  a selected profile Profile
  a selected template TemplateName
  a stage Stage
  a start order Number

at most one latest Rendering for each Subject
at most one active Rendering for each Subject
```

Beginning always creates a new rendering identity. If the subject's latest
attempt is unfinished, beginning another marks the earlier one superseded.
Completed and superseded attempts remain queryable as historical evidence.
The latest attempt is active while started, body-settled, or layout-settled.

## Actions

```actions
begin (subject: Subject, path: Path, data: Values) : return (rendering: Rendering, subject: Subject, profile: Profile, template: TemplateName)
  where subject or path is not Text
  then
    refuse INVALID_TEXT "Rendering subjects and paths must be well-formed text."
  where data is not an ordinary record
  then
    refuse INVALID_DATA "Resolved rendering data must be an ordinary record."
  where build.markup is present and is not Text
  then
    refuse INVALID_PROFILE "A selected rendering profile must be well-formed text."
  where build.template is present and is not Text
  then
    refuse INVALID_TEMPLATE "A selected rendering template must be well-formed text."
  where build.markup is absent and path ends in neither .md nor .html
  then
    refuse UNKNOWN_SOURCE "A page source must select a profile or use a supported extension."
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
    make it layout-settled and return transitioned true
  where rendering is already layout-settled, completed, or superseded
  then
    return transitioned false

finish (rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)
  where rendering is unknown
  then
    refuse RENDERING_NOT_FOUND "There is no such rendering attempt."
  where rendering is started or body-settled
  then
    refuse STAGE_NOT_READY "The rendering attempt has not reached the required stage."
  where rendering is layout-settled
  then
    make it completed and return transitioned true
  where rendering is already completed or superseded
  then
    return transitioned false
```

## Queries

```queries
_attempt (rendering: Rendering) : optional (subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage)
_active (rendering: Rendering) : optional (subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage)
_latest (subject: Subject) : optional (rendering: Rendering, path: Path, profile: Profile, template: TemplateName, stage: Stage)
_all () : many (rendering: Rendering, subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage)
```

`_attempt` includes historical superseded and completed attempts. `_active`
returns an attempt only while it is the subject's latest unfinished attempt.
`_latest` returns the most recently begun attempt for a subject. `_all` lists
attempts in start order.

Rendering records lifecycle and source-profile selection. It does not fill
templates, convert source, resolve references, emit output, or decide that
outside work has settled. Reactions report those milestones through its
actions.
