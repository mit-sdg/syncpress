# Templating

## Purpose

Fill stored templates from supplied contexts, letting templates reuse smaller
templates, so a layout is written once and used many times.

## Principle

Ada defines `page.html`, `header.html`, and `footer.html`. `page.html` renders
the other two, so its direct uses and full tree name them. She fills unnamed
text that renders the header for one subject without adding that text to the
named templates. Rendering the layout for two subjects keeps both outputs. Its
ordinary values are HTML-escaped while the supplied raw `page.content` is not.
Defining the same source reports no change. A missing partial, recursive
template tree, malformed source, and failed evaluation are refused.

## State

```state
a set of Templates with
  a name Name
  a source Text
  a digest Digest

a set of Fillings with
  a subject Subject
  a digest Digest
  an output Text

a set of Uses with
  an owner Owner       -- a template or a filling
  a used Name

a set of Reads with
  an owner Owner
  a root Name
  a member Name

a set of Renderings with
  a template Template
  a subject Subject
  an output Text
```

At most one template has a name, one filling has a subject, and one rendering
has a template and subject. A read splits a context reference at its first dot:
`collections.posts` reads root `collections` and member `posts`; `site` has an
empty member.

## Actions

```actions
define (name: Name, source: Text) : return (template: Template, changed: Flag)
  where source is not well formed
  then
    refuse TEMPLATE_SYNTAX "This template cannot be parsed."
  where some template has name and this source's digest
  then
    return that template and changed false
  where source is well formed and differs
  then
    replace any template with name, with its uses and reads
    record one use for each template it names and one read for each context member it mentions
    return template and changed true

forget (name: Name) : return (template: Template)
  where no template has name
  then
    refuse TEMPLATE_NOT_FOUND "There is no such template."
  where some template has name
  then
    delete that template with its uses and reads
    return template

fill (subject: Subject, source: Text, context: Values, raw: Keys) : return (filling: Filling, output: Text)
  where source is not well formed
  then
    refuse TEMPLATE_SYNTAX "This template cannot be parsed."
  where source names a template that is not defined
  then
    refuse USED_TEMPLATE_NOT_FOUND "This template uses a template that is not defined."
  where evaluation fails
  then
    refuse TEMPLATE_FAILED "This template could not be evaluated."
  where evaluation succeeds
  then
    replace any filling for subject, with its uses and reads
    record one use for each template it names and one read for each context member it mentions
    return filling and output

render (template: Template, subject: Subject, context: Values, raw: Keys) : return (rendering: Rendering, output: Text)
  where template not in templates
  then
    refuse TEMPLATE_NOT_FOUND "There is no such template."
  where some name in its tree is not defined
  then
    refuse USED_TEMPLATE_NOT_FOUND "This template uses a template that is not defined."
  where its tree is recursive
  then
    refuse RECURSIVE_TEMPLATE "This template uses itself."
  where evaluation fails
  then
    refuse TEMPLATE_FAILED "This template could not be evaluated."
  where evaluation succeeds
  then
    replace any rendering for template and subject
    add a rendering with template, subject, and output
    return rendering and output
```

## Queries

```queries
_template (name: Name) : optional (template: Template, digest: Digest)
_uses (owner: Owner) : many (used: Name)
_tree (owner: Owner) : many (used: Name)
_usedBy (name: Name) : many (owner: Owner)
_reads (owner: Owner) : many (root: Name, member: Name)
_filling (subject: Subject) : optional (filling: Filling, output: Text)
_rendering (template: Template, subject: Subject) : optional (rendering: Rendering, output: Text)
_of (rendering: Rendering) : one (template: Template, subject: Subject, output: Text)
```

`fill` is for a one-off source and never adds that source to the named template
table. `_uses` is direct and `_tree` is transitive. Context values are assembled
elsewhere; every interpolation is HTML-escaped except exact dotted keys named in
`raw`.

Templating does not decide where source text came from, what a subject means, or
what happens to rendered output.
