# Templating

## Purpose

Fill a reusable Liquid pattern with supplied values, so one layout and its named
fragments can produce HTML for many subjects.

## Principle

Mina makes event pages. She saves a frame and a masthead, and the frame renders
the masthead by its fixed name. Text such as `Ada & Bob` becomes safe HTML, while
the already-produced page body is inserted as HTML only because Mina's
application explicitly trusts the path `["page", "content"]`. A missing optional
subtitle is harmless in a condition, but printing an undefined value is an
error. Asking about the frame reports both the fragments and context paths it
can reach. Reusing the same source changes nothing; replacing it keeps the same
template identity. A missing fragment, recursive tree, unsupported dependency,
or Liquid error reports its location and leaves the last successful output
untouched.

## Liquid And HTML

This concept fills Liquid templates and returns text intended to be HTML. It
uses the built-in tags, expressions, and filters of the installed LiquidJS
engine with these exact restrictions:

- `include`, Liquid `layout`, and `cycle` tags are unsupported. `include` and
  `layout` hide template dependencies, and `cycle` can write a context value
  without passing it through output escaping.
- `render` takes one quoted, literal template name. Interpolation in that name
  and an unquoted expression are unsupported. Named arguments such as
  `{% render "card.html", item: page.data %}` are supported. The `with` and
  `for` forms are unsupported. A rendered template has Liquid's isolated local
  scope, plus supplied named arguments and the original global context.
  Argument names are safe ASCII identifiers other than `__proto__`, and each has
  an explicit `key: value`.
  Render names are nonempty and cannot begin with `/`, `./`, or `../`, so lookup
  is exact rather than relative to the calling template.
- Every context property access has literal segments. Dot identifiers, quoted
  bracket members, and literal numeric indexes are supported. An expression in
  brackets, such as `collections[which]`, is unsupported. This applies in every
  expression, not only output expressions.
- No custom author tags or filters are installed. The Liquid `raw` filter is
  retained only as an ordinary identity filter and never disables escaping.
  Liquid raw blocks contain authored literal text and remain supported.

Unknown tags and filters are syntax errors. A source is checked in full, so an
unsupported construct is refused even in a branch that would not execute.

`strictVariables` is enabled. An undefined value is allowed only where
LiquidJS's `lenientIf` permits one optional value: a condition of `if`, `elsif`,
or `unless`, or the input to `default`. Printing it, iterating it, using it in a
compound expression, or otherwise evaluating it refuses `UNDEFINED_VARIABLE`.

## Values, Paths, And Trust

Contexts are JSON-like Values assembled elsewhere. A path is a nonempty,
ordinary dense array of literal string segments, using the same representation
as `Composing`: `["page", "content"]`, not a dotted string. Empty segments, dots,
and names such as `__proto__` have no special meaning. Read paths use strings for
literal numeric indexes too.

All values written by Liquid output are HTML-escaped, replacing `&`, `<`, `>`,
`"`, and `'`. Authored literal template text is not escaped. The only exemption
is a path in the action's `trusted` input. Every trusted path must resolve to an
own string value in that action's context. The context is not mutated.

Trust belongs to the exact internal value, not to a variable name or text with
the same contents. It survives an `assign` alias and a named `render` argument.
Any filter result is ordinary text and is escaped, even for `raw`, `default`, or
an identity-like filter. `capture` also produces ordinary text, so interpolating
a captured trusted value escapes it. Template authors cannot create a trusted
value.

## Dependencies And Reads

A Use is one supported literal `render` name. `_uses` is direct. `_tree` is the
transitive closure in depth-first, first-mention order and includes each name
once. A cycle is rejected before evaluation. Missing definitions are permitted
while templates are being defined, but `fill` and `render` require their entire
trees to exist.

A Read is a nonempty literal path into the supplied context. A path means that
the value at that path, or a descendant of that value, may be inspected. This
prefix meaning is necessary for a value passed as a render argument. Reads are
analyzed with partials, render arguments, assignments, and local scopes in
effect. Thus a partial's global reads contribute to its caller, while a partial
argument does not become a false global. Reads are unique and returned in
ascending lexicographic path order.

For a Template, `_tree` and `_reads` describe its current source and currently
defined tree. For a Filling or Rendering, they are snapshots of the tree and
effective reads used by that successful evaluation. Redefining or forgetting a
template does not rewrite those historical snapshots.

## Identity And Lifetime

Names and subjects are arbitrary JavaScript strings. Identities are
deterministic, injective length-prefixed encodings, so punctuation and control
characters cannot collide. A template keeps its identity when its source
changes. A filling keeps its identity for its subject. A rendering keeps its
identity for its exact template and subject pair.

`define` validates before changing state. Defining exactly the same source
returns `changed false`; defining different valid source replaces its direct
uses and reads and returns `changed true`. `fill` evaluates unnamed one-off
source and never adds it to the template name table. `render` evaluates a named
template. Successful fill and render replace only the result with the same key.

Every action is failure-atomic. A failed definition retains the previous
definition. A failed fill or render retains the previous output and dependency
snapshot. Forgetting a template removes its definition and renderings directly
of that template. Successful outputs owned by other templates or fillings stay
as historical results; the composition is responsible for invalidating and
rebuilding their subjects.

Locations are one-based Liquid source line and column numbers. A named source
also identifies its template name. Unsupported syntax points to the construct;
a missing use points to the render site; a recursive error points to the edge
that closes the cycle; and evaluation errors retain the location and underlying
Liquid detail when available.

## State

```state
a set of Templates with
  a name Name
  a source Text
  a digest Digest
  a set of direct Uses
  a set of direct Reads

a set of Fillings with
  a subject Subject
  a digest Digest
  an output Text
  a set of direct Uses
  a dependency Tree
  a set of effective Reads

a set of Renderings with
  a template Template
  a subject Subject
  an output Text
  a dependency Tree
  a set of effective Reads
```

At most one template has a name, one filling has a subject, and one rendering
has a template and subject.

## Actions

```actions
define (name: Name, source: Text) : return (template: Template, changed: Flag)
  where source is not valid Liquid in the supported engine
  then
    refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
  where source uses a Liquid feature excluded above
  then
    refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
  where some template has name and exactly source
  then
    return that template and changed false
  where source is valid, supported, and different
  then
    replace any template with name and its direct metadata
    return template and changed true

forget (name: Name) : return (template: Template)
  where no template has name
  then
    refuse TEMPLATE_NOT_FOUND "There is no such template."
  where some template has name
  then
    delete that template and renderings directly of it
    return template

fill (subject: Subject, source: Text, context: Values, trusted: Paths) : return (filling: Filling, output: Text)
  where source is not valid Liquid in the supported engine
  then
    refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
  where source uses a Liquid feature excluded above
  then
    refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
  where a trusted path is not a path as defined above
  then
    refuse INVALID_TRUSTED_PATH "A trusted path must contain one or more literal string segments."
  where a trusted path does not name an own string value
  then
    refuse INVALID_TRUSTED_VALUE "A trusted path must name a string in the supplied context."
  where some literal name in the source's tree is not defined
  then
    refuse USED_TEMPLATE_NOT_FOUND "A rendered template is not defined."
  where the source's tree is recursive
  then
    refuse RECURSIVE_TEMPLATE "The template dependency tree is recursive."
  where strict evaluation reads an undefined value
  then
    refuse UNDEFINED_VARIABLE "This Liquid template reads a context value that is not defined."
  where evaluation otherwise fails
  then
    refuse TEMPLATE_FAILED "This Liquid template could not be evaluated."
  where evaluation succeeds
  then
    replace any filling for subject with its dependency snapshot
    return filling and output

render (template: Template, subject: Subject, context: Values, trusted: Paths) : return (rendering: Rendering, output: Text)
  where template is not in Templates
  then
    refuse TEMPLATE_NOT_FOUND "There is no such template."
  where a trusted path is not a path as defined above
  then
    refuse INVALID_TRUSTED_PATH "A trusted path must contain one or more literal string segments."
  where a trusted path does not name an own string value
  then
    refuse INVALID_TRUSTED_VALUE "A trusted path must name a string in the supplied context."
  where some literal name in the template's tree is not defined
  then
    refuse USED_TEMPLATE_NOT_FOUND "A rendered template is not defined."
  where the template's tree is recursive
  then
    refuse RECURSIVE_TEMPLATE "The template dependency tree is recursive."
  where strict evaluation reads an undefined value
  then
    refuse UNDEFINED_VARIABLE "This Liquid template reads a context value that is not defined."
  where evaluation otherwise fails
  then
    refuse TEMPLATE_FAILED "This Liquid template could not be evaluated."
  where evaluation succeeds
  then
    replace any rendering for template and subject with its dependency snapshot
    return rendering and output
```

## Queries

```queries
_template (name: Name) : optional (template: Template, digest: Digest)
_uses (owner: Owner) : many (used: Name)
_tree (owner: Owner) : many (used: Name)
_usedBy (name: Name) : many (owner: Owner)
_reads (owner: Owner) : many (path: Keys)
_filling (subject: Subject) : optional (filling: Filling, output: Text)
_rendering (template: Template, subject: Subject) : optional (rendering: Rendering, output: Text)
_of (rendering: Rendering) : optional (template: Template, subject: Subject, output: Text)
```

`_uses` and `_usedBy` accept Templates and Fillings and concern direct uses.
`_tree` and `_reads` additionally accept Renderings so a composition can record
the exact dependencies of a successful output.

Templating does not decide where sources came from, what a subject means, which
context paths are trusted, which reads matter to invalidation, or where the HTML
text goes.
