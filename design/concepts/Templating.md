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
untouched. That failed renderSource or renderTemplate is also available by its subject with its
normalized refusal code and any available location. A later successful renderSource or
renderTemplate for that subject clears the failure.

The concept retains this value vocabulary and its constraints:

`Name = JavaScriptString` A template name, distinct from the Template identity that owns the name.

`Subject = JavaScriptString` An application-supplied filling or rendering owner.

`Origin = Text` An identity that may own a registered template name.

`Digest = Text` A SHA-256 digest.

`Code = "INVALID_TRUSTED_PATH" | "INVALID_TRUSTED_VALUE" | "RECURSIVE_TEMPLATE" | "TEMPLATE_FAILED" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_SYNTAX" | "UNDEFINED_VARIABLE" | "UNSUPPORTED_TEMPLATE" | "USED_TEMPLATE_NOT_FOUND"`

`Keys = List<JavaScriptString>` A nonempty literal context path.

`WildcardPath = record` wildcard: Keys

`TrustedPath = Keys | WildcardPath` Paths = List<TrustedPath>

`Values = host-supplied` A JSON-like context record supplied by the application.

`Owner = Template | Filling | Rendering` Tree = List<Name>

`DiagnosticSource = JavaScriptString` A diagnostic source label, not the identity of a scanned HTML Source.

This concept fills Liquid templates and returns text intended to be HTML. It uses the built-in tags, expressions, and filters of the installed LiquidJS engine with these exact restrictions:

- `include`, Liquid `layout`, and `cycle` tags are unsupported. `include` and `layout` hide template dependencies, and `cycle` can write a context value without passing it through output escaping. - `render` takes one quoted, literal template name. Interpolation in that name and an unquoted expression are unsupported. Named arguments such as `{% render "card.html", item: page.data %}` are supported. The `with` and `for` forms are unsupported. A rendered template has Liquid's isolated local scope, plus supplied named arguments and the original global context. Argument names are safe ASCII identifiers other than `__proto__`, and each has an explicit `key: value`. Render names are nonempty and cannot begin with `/`, `./`, or `../`, so lookup is exact rather than relative to the calling template. - Every context property access has literal segments. Dot identifiers, quoted bracket members, and literal numeric indexes are supported. An expression in brackets, such as `collections[which]`, is unsupported. This applies in every expression, not only output expressions. - No custom author tags or filters are installed. The Liquid `raw` filter is retained only as an ordinary identity filter and never disables escaping. Liquid raw blocks contain authored literal text and remain supported.

Unknown tags and filters are syntax errors. A source is checked in full, so an unsupported construct is refused even in a branch that would not execute.

`strictVariables` is enabled. An undefined value is allowed only where LiquidJS's `lenientIf` permits one optional value: a condition of `if`, `elsif`, or `unless`, or the input to `default`. Printing it, iterating it, using it in a compound expression, or otherwise evaluating it refuses `UNDEFINED_VARIABLE`.

Contexts are JSON-like Values assembled elsewhere. An exact path is a nonempty, ordinary dense array of literal string segments with the standard array prototype and no extra properties: `["page", "content"]`, not a dotted string. Empty segments, dots, names such as `__proto__`, and `*` have no special meaning in an exact path. Read paths use strings for literal numeric indexes too.

Alongside exact paths, `trusted` accepts a tagged wildcard declaration such as `{ wildcard: ["collections", "*", "*", "excerpt"] }`. An ordinary string array is always exact, so `["collections", "*", "*", "excerpt"]` still trusts only literal `*` members rather than acting as a wildcard.

A structural declaration is an ordinary plain or null-prototype record with exactly its enumerable data `wildcard` member and no other members. Its path must be a nonempty dense string path containing at least one `*`. Each `*` ranges over enumerable own data members of a plain record or items of a dense standard array. Other segments read exact own properties. A missing or null final value is skipped; every selected present value must be a string. This excludes inherited values, accessors, proxies, sparse arrays, and decorated containers while keeping application trust policy outside Templating.

All values written by Liquid output are HTML-escaped, replacing `&`, `<`, `>`, `"`, and `'`. Authored literal template text is not escaped. The only exemption is an exact path or selected structural excerpt in the action's `trusted` input. Every selected value must resolve to an own string value in that action's context. The context is not mutated.

Trust belongs to the exact internal value, not to a variable name or text with the same contents. It survives an `assign` alias and a named `render` argument. Any filter result is ordinary text and is escaped, even for `raw`, `default`, or an identity-like filter. `capture` also produces ordinary text, so interpolating a captured trusted value escapes it. Template authors cannot create a trusted value.

Names and subjects are arbitrary JavaScript strings. Identities are deterministic, injective length-prefixed encodings, so punctuation and control characters cannot collide. A template keeps its identity when its source changes. A filling keeps its identity for its subject. A rendering keeps its identity for its exact template and subject pair.

## Types

```types
```

## State

```state
a set of Templates with
  a name Name
  a source JavaScriptString
  a digest Digest
  a directUses set of Name
  a directReads set of Keys
  an optional origin Origin

a set of Fillings with
  a subject Subject
  a digest Digest
  an output JavaScriptString
  a directUses set of Name
  a dependency Tree
  an effectiveReads set of Keys

a set of Renderings with
  a template Template
  a subject Subject
  an output JavaScriptString
  a dependency Tree
  an effectiveReads set of Keys

a set of Failures with
  a subject Subject
  a code Code
  an optional templateName Name
  an optional line PositiveInteger
  an optional column PositiveInteger

Rule: template-result-and-failure-keys: At most one Template exists per Name, one Filling per Subject, one Rendering per Template and Subject, and one Failure per Subject.
```

## Actions

```actions
define(name: Name, source: JavaScriptString) : return (template: Template, changed: Flag)
  where another origin owns name and source differs
  then
    refuse TEMPLATE_NAME_TAKEN "Another source already owns this template name."
  where source is not valid Liquid in the supported engine
  then
    refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
  where source uses a Liquid feature excluded above
  then
    refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
  where some template has name and exactly source
  then
    produce that template and changed false
    return template, changed
  where source is valid, supported, and different
  then
    replace any template with name and its direct metadata
    return template, changed

register(name: Name, source: JavaScriptString, origin: Origin) : return (template: Template, changed: Flag)
  where origin is not Text
  then
    refuse INVALID_TEMPLATE_ORIGIN "A template origin must be well-formed text."
  where another origin owns name
  then
    refuse TEMPLATE_NAME_TAKEN "Another source already owns this template name."
  where source is not valid Liquid in the supported engine
  then
    refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
  where source uses a Liquid feature excluded above
  then
    refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
  where true
  then
    atomically claim name for origin, define or replace its source, and return template and changed
    return template, changed

forget(name: Name) : return (template: Template)
  where no template has name
  then
    refuse TEMPLATE_NOT_FOUND "There is no such template."
  where some template has name
  then
    delete that template and renderings directly of it
    release its registered origin if present
    return template

renderSource(subject: Subject, source: JavaScriptString, context: Values, trusted: Paths, sourceName?: Name, sourceLine?: PositiveInteger) : return (filling: Filling, output: JavaScriptString)
  where source is not valid Liquid in the supported engine
  then
    replace any Failure for subject with code TEMPLATE_SYNTAX and any available location
    refuse TEMPLATE_SYNTAX "This Liquid template cannot be parsed."
  where source uses a Liquid feature excluded above
  then
    replace any Failure for subject with code UNSUPPORTED_TEMPLATE and any available location
    refuse UNSUPPORTED_TEMPLATE "This Liquid feature is unsupported because its dependencies or escaping cannot be determined."
  where a trusted entry is not an exact path or wildcard declaration as defined above
  then
    replace any Failure for subject with code INVALID_TRUSTED_PATH and any available location
    refuse INVALID_TRUSTED_PATH "A trusted path must contain one or more literal string segments."
  where an exact trusted path or selected wildcard value does not name an own string value
  then
    replace any Failure for subject with code INVALID_TRUSTED_VALUE and any available location
    refuse INVALID_TRUSTED_VALUE "A trusted path must name a string in the supplied context."
  where some literal name in the source's tree is not defined
  then
    replace any Failure for subject with code USED_TEMPLATE_NOT_FOUND and any available location
    refuse USED_TEMPLATE_NOT_FOUND "A rendered template is not defined."
  where the source's tree is recursive
  then
    replace any Failure for subject with code RECURSIVE_TEMPLATE and any available location
    refuse RECURSIVE_TEMPLATE "The template dependency tree is recursive."
  where strict evaluation reads an undefined value
  then
    replace any Failure for subject with code UNDEFINED_VARIABLE and any available location
    refuse UNDEFINED_VARIABLE "This Liquid template reads a context value that is not defined."
  where evaluation otherwise fails
  then
    replace any Failure for subject with code TEMPLATE_FAILED and any available location
    refuse TEMPLATE_FAILED "This Liquid template could not be evaluated."
  where evaluation succeeds
  then
    replace any filling for subject with its dependency snapshot
    clear any Failure for subject
    return filling, output

renderTemplate(template: Template, subject: Subject, context: Values, trusted: Paths) : return (rendering: Rendering, output: JavaScriptString)
  where template is not in Templates
  then
    replace any Failure for subject with code TEMPLATE_NOT_FOUND and any available location
    refuse TEMPLATE_NOT_FOUND "There is no such template."
  where a trusted entry is not an exact path or wildcard declaration as defined above
  then
    replace any Failure for subject with code INVALID_TRUSTED_PATH and any available location
    refuse INVALID_TRUSTED_PATH "A trusted path must contain one or more literal string segments."
  where an exact trusted path or selected wildcard value does not name an own string value
  then
    replace any Failure for subject with code INVALID_TRUSTED_VALUE and any available location
    refuse INVALID_TRUSTED_VALUE "A trusted path must name a string in the supplied context."
  where some literal name in the template's tree is not defined
  then
    replace any Failure for subject with code USED_TEMPLATE_NOT_FOUND and any available location
    refuse USED_TEMPLATE_NOT_FOUND "A rendered template is not defined."
  where the template's tree is recursive
  then
    replace any Failure for subject with code RECURSIVE_TEMPLATE and any available location
    refuse RECURSIVE_TEMPLATE "The template dependency tree is recursive."
  where strict evaluation reads an undefined value
  then
    replace any Failure for subject with code UNDEFINED_VARIABLE and any available location
    refuse UNDEFINED_VARIABLE "This Liquid template reads a context value that is not defined."
  where evaluation otherwise fails
  then
    replace any Failure for subject with code TEMPLATE_FAILED and any available location
    refuse TEMPLATE_FAILED "This Liquid template could not be evaluated."
  where evaluation succeeds
  then
    replace any rendering for template and subject with its dependency snapshot
    clear any Failure for subject
    produce rendering and output
    return rendering, output
```

## Queries

```queries
_template (name: Name) : optional (template: Template, digest: Digest)
  Returns the current Template for the name, or no row when the name has no
  current Template.

_uses (owner: Owner) : many (used: Name)
  A use is one supported literal render name. Returns the direct uses of a
  Template or Filling, with no specified order. A Rendering or unknown owner
  returns no rows.

_tree (owner: Owner) : many (used: Name)
  Returns the transitive use closure of a Template, Filling, or Rendering in
  depth-first, first-mention order, with each name once. For a Template, the
  result describes its current source and currently defined tree. For a Filling
  or Rendering, it is the tree snapshot used by that successful evaluation;
  redefining or forgetting a template does not rewrite the snapshot. An unknown
  owner returns no rows.

_usedBy (name: Name) : many (owner: Owner)
  Returns Template and Filling owners that directly use the name. An unknown name
  returns no rows. No order is specified.

_reads (owner: Owner) : many (path: Keys)
  A read is a nonempty literal context path. It means that the value at the path,
  or a descendant of that value, may be inspected; the prefix meaning accounts
  for values passed as render arguments. Analysis includes partials, render
  arguments, assignments, and local scopes: a partial's global reads contribute
  to its caller, but a partial argument does not become a false global read.
  Returns unique paths in ascending lexicographic path order and a fresh Keys
  list in every row. For a Template, the paths describe its current source and
  currently defined tree. For a Filling or Rendering, they are the effective-read
  snapshot used by that successful evaluation; redefining or forgetting a
  template does not rewrite the snapshot. An unknown owner returns no rows.
  Apart from these fresh path lists, query rows contain no mutable values.

_failure (subject: Subject) : optional (code: Code, templateName?: Name, line?: PositiveInteger, column?: PositiveInteger)
  Returns the latest failed renderSource or renderTemplate for exactly the subject, or no row
  when none is recorded. The code is one of the declared refusal codes.
  templateName, line, and column are present and undefined when no corresponding
  location is available.

_failureLocation (subject: Subject, fallbackSource: DiagnosticSource) : optional (source: DiagnosticSource, line?: PositiveInteger, column?: PositiveInteger)
  Returns no row when the subject has no recorded failure. For a recorded
  failure, resolves a named location to that source and otherwise uses
  fallbackSource. This lets a host composition report one diagnostic without
  duplicating source-selection policy. Line and column are present and undefined
  when unavailable.

_filling (subject: Subject) : optional (filling: Filling, output: JavaScriptString)
  Returns the last successful filling for the subject, or no row when that result
  is absent.

_rendering (template: Template, subject: Subject) : optional (rendering: Rendering, output: JavaScriptString)
  Returns the last successful rendering for the template-and-subject key, or no
  row when that result is absent.

_of (rendering: Rendering) : optional (template: Template, subject: Subject, output: JavaScriptString)
  Returns the last successful result for the Rendering identity, or no row when
  that identity is unknown or absent.
```
