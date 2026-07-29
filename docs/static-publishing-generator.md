# Static Publishing Generator

**A deterministic static site generator, defined as independent concepts and the
reactions that connect them.**

This document is complete on its own. Part 1 states what the product is and how
it behaves for an author. Parts 2 to 9 define the concepts it is built from,
their state, their actions and queries, and the composition that assembles them
into the product.

Notation follows the sync-engine documents. A concept specification carries a
Purpose, a Principle, uninterpreted state notation, an `actions` fence and a
`queries` fence. The composition is written as reactions, views, formers, and
endpoints. The appendix lists every language construct used.

---

# Part 1 · The product

## 1.1 What it is

The generator reads a project directory and emits an ordinary directory of
static files. The output needs no server-side runtime and deploys to GitHub
Pages, Cloudflare Pages, or any static host.

It is built for blogs, portfolios, documentation sites, and small
content-oriented websites. It supports Markdown and HTML content, Liquid
templates with reusable partials, arbitrary front-matter data, named
collections, co-located page assets, public files, image optimization,
deterministic routing and output, production builds, incremental watch builds, a
local development server, and structured diagnostics.

It does not provide server-side rendering, API routes, databases,
authentication, remote content synchronization, or third-party plugin loading.

## 1.2 Design principles

**Declarative projects.** A project is configured with YAML. A build executes no
project configuration code. Liquid is the only authoring language required.

**Ordinary files.** Content, templates, images, and public assets are ordinary
files in the project directory. The project is understandable without a database
or a proprietary editor.

**Minimal reserved vocabulary.** Front matter is application data. Names such as
`tags`, `author`, `series`, `featured`, and `category` have no built-in meaning.
Generator-specific front matter lives under the reserved `build` key.

**Relative references.** A page refers to images and downloads using paths
relative to its own source, so a page and its assets live in one directory.

**Explicit composition.** Collections, defaults, routing rules, and templates are
declared. The generator assigns no hidden behavior to conventional field names.

**Deterministic output.** The same declared inputs produce the same output.
Output never depends on filesystem enumeration order, process scheduling, random
identifiers, the current time, or undeclared environment values.

## 1.3 Project structure

```text
site/
├── site.yaml
├── content/
│   ├── index.md
│   ├── about/
│   │   ├── index.md
│   │   └── portrait.jpg
│   └── posts/
│       └── compiler-design/
│           ├── index.md
│           ├── pipeline.png
│           └── example.zip
├── templates/
│   ├── page.html
│   ├── post.html
│   └── includes/
│       ├── header.html
│       └── post-card.html
├── public/
│   ├── favicon.ico
│   └── styles.css
└── dist/
```

The content, template, public, and output directory names are configurable.
`dist` holds generated files; no source file may depend on anything already in
it.

## 1.4 Configuration

```yaml
site:
  title: Ada's Notes
  origin: https://example.com
  basePath: /
  owner: Ada
  navigation:
    - { label: Home, url: / }
    - { label: Writing, url: /posts/ }

paths:
  content: content
  templates: templates
  public: public
  output: dist
  assets: assets

defaults:
  - match: "**/*.md"
    values:
      build: { template: page.html, markup: markdown }
  - match: "**/*.html"
    values:
      build: { markup: verbatim }
  - match: "posts/**/*.md"
    values:
      build: { template: post.html }

collections:
  posts:
    match: "posts/**/*.md"
    sort: { by: data.date, order: desc }
  featured:
    match: "**/*.md"
    where: { field: data.featured, equals: true }
    sort: { by: data.date, order: desc }

images:
  widths: [480, 960, 1440]
  formats: [avif, webp, original]

markdown:
  extensions: [tables, footnotes, strikethrough, autolinks]
  raw: true
  excerptSeparator: "<!--more-->"
```

Every key has a useful default; a simple site may state only `site.title`.

Values under `site` are available to templates as `site`. The generator
interprets only `basePath` and `origin`; everything else under `site` is
user-defined template data.

A collection's `sort` is **two keys**, `by` and `order`, rather than one packed
string, so no part of the system has to own a micro-syntax. A collection's
optional `where` takes one of three forms — `equals`, `contains`, or `exists` —
which is the complete filter vocabulary.

YAML is the canonical notation. Adding TOML later changes nothing but the parser.

## 1.5 Content and front matter

A page is a Markdown or HTML file under the content directory, either
`content/about.md` or `content/about/index.md`. Both produce `/about/`. The
directory form is recommended when a page has local assets.

```md
---
title: Compiler Design
date: 2026-07-28
topics: [compilers, semantics]
description: Notes on structuring a small compiler.
---

# {{ page.data.title }}

![Compiler pipeline](./pipeline.png)
```

Front matter is arbitrary YAML, reachable as `page.data`. Liquid in the body is
evaluated before Markdown conversion, so loops and conditions may generate
Markdown. HTML content files use the same front matter and Liquid context and
skip Markdown conversion.

The reserved `build` key holds generator controls:

| Key | Meaning |
| --- | --- |
| `build.template` | the page template. Required; a page that resolves none is an error |
| `build.markup` | the markup dialect: `markdown` or `verbatim` |
| `build.route` | an explicit output route, overriding the derived one |
| `build.publish` | whether the page is emitted. Defaults to true |

Defaults apply front-matter values to files chosen by a path pattern. Matching
rules apply in configuration order; a later matching rule overrides an earlier
one, and the page's own front matter overrides all of them. Nested mappings merge
key by key; sequences and scalars replace.

## 1.6 Templates

Templates are HTML files containing Liquid. A page template receives the
converted body as `page.content`.

```html
{% render "header.html" %}
<main>
  <article>
    <h1>{{ page.data.title }}</h1>
    {{ page.content }}
  </article>
</main>
{% render "footer.html" %}
```

Partials live under `templates/includes/` and are referenced by their bare
filename. Partials may render partials; a recursive cycle is a build error.

Templates receive three globals — `site`, `page`, and `collections` — plus
whatever a `render` call passes explicitly. The current page exposes
`page.data`, `page.url`, `page.content`, and `page.source.path`.

**Escaping.** Every interpolated value is escaped for HTML. The single exception
is `page.content`, which the generator produced and knows to be markup.

## 1.7 Collections

A collection is a named, ordered set of pages. Names have no built-in meaning.

```liquid
{% for post in collections.posts %}
  <a href="{{ post.url }}">{{ post.data.title }}</a>
{% endfor %}
```

Each item exposes `data`, `url`, `excerpt`, and `source.path`. Full rendered
content is deliberately not exposed.

**Ordering is total and stable.** Items sort by the configured key in the
configured direction; a missing key sorts after every present key; keys of
different kinds order by kind before value; ties break on source path ascending.

**An excerpt is taken from the authored body, before Liquid is evaluated**, and
ends at the excerpt separator. A body with no separator has no excerpt. This
keeps listings from depending on rendering, which would otherwise be circular:
a listing quotes an excerpt, an excerpt comes from a body, a body's rendering
reads listings. The visible consequence for an author is that Liquid in a body
does not affect that page's own excerpt; write a `description` in front matter,
or put the generated part after the separator.

## 1.8 Routes and output

Routes derive from content paths:

```text
content/index.md                      → /
content/about.md                      → /about/
content/about/index.md                → /about/
content/posts/compiler-design/index.md → /posts/compiler-design/
```

A directory-style route emits `index.html`; a route naming a file, such as
`/404.html`, emits that file. A page may state `build.route` instead. Routes are
site-relative and begin with `/`.

**Two pages must not produce the same route**, and no route may collide with a
public file or another generated output. Both are build errors, and neither is
resolved by discovery order — the first claim stands and the second is reported.

`site.basePath` supports deployment below the domain root. Templates never
prefix it: authors write ordinary relative or site-absolute hrefs, and the
generator rewrites every reference in the finished document with a URL that
includes the base. There is no URL helper to remember.

## 1.9 Assets, images, and public files

A page may keep images and downloads beside it, referenced relatively:

```md
![Compiler pipeline](./pipeline.png)
[Download the source example](./source-example.zip)
```

**A local asset is emitted only when something references it.** A copied asset
keeps its filename and is emitted beside the referencing page's output, so
`content/posts/x/example.zip` becomes `posts/x/example.zip`.

**A referenced raster image is optimized.** The generator derives the configured
widths and formats, names each rendition from the source content and its own
settings, emits them under the asset folder, and replaces the image element with
a `<picture>`: one `<source>` per format in configured order, widths ascending
within each, the original format last as the fallback, and `width`, `height`,
`alt`, `loading="lazy"`, `decoding="async"` on the `<img>`. A width larger than
the source is skipped rather than upscaled, and a format that would drop an
animation is skipped. SVG files are copied, not rasterized.

**Every file under the public directory is copied unchanged**, path preserved,
whether or not anything references it. Images under `public` bypass
optimization. A public file may not overwrite a generated page.

**A reference that names no file is an error in a production build**, and the
page is not emitted; in watch and development builds it is a warning, the
reference is left as written, and the page still renders.

## 1.10 Build modes

```text
site build            production build
site build --watch    incremental rebuild on change
site dev              development server
site inspect          report the derived model
```

A **production build** reads the whole project, validates it, excludes pages with
`build.publish: false`, produces optimized assets, detects route and output
collisions, validates local references, emits the intended tree, removes outputs
no longer produced, and fails without writing when any error diagnostic stands.

A **watch build** does an initial build and then rebuilds what depends on each
change. Editing a post rebuilds the post; editing its metadata also rebuilds the
listings that quote it; editing a template rebuilds every page whose layout tree
reaches it; editing an image reprocesses it and rebuilds the pages that
reference it. The dependency graph is derived, not persisted: a new process
produces a correct build with no prior state.

The **development server** serves the output directory and rebuilds on change.
An edit that breaks one page leaves every other page serving its last valid
output, and leaves the broken page's own last valid output in place until a
rebuild finishes.

`site inspect` reports the source that owns a route, the template selected for a
page, the defaults applied to it and where each came from, the collections
containing it, the inputs an output depends on, the reason an output rebuilt, the
producer that owns an output path, and the standing diagnostics.

## 1.11 Diagnostics

A diagnostic carries a severity, a code, a message, a source path, a line and
column where available, and related locations where applicable. Independent
checks accumulate: one invalid page never hides an error in another. A run
reports errors before warnings, ordered by source, then position, then code, so
two failing runs fail identically.

Initial error conditions: invalid configuration, invalid front matter, missing
template, missing partial, recursive partial rendering, Liquid syntax error,
Markdown processing error, missing local asset, invalid image, route collision,
output collision, invalid route, a path escaping the project roots, and an
unsupported configuration value.

## 1.12 Deployment

The output is ordinary static files. GitHub Pages needs configurable base paths,
directory-style routes, an optional `.nojekyll`, a static `404.html`, and no
server rewrites — all of which the output provides. Cloudflare Pages publishes
the same directory directly.

---

# Part 2 · The design

## 2.1 Seventeen concepts

| Group | Concept | Purpose, in one line | Recognizable elsewhere as |
| --- | --- | --- | --- |
| Sources | **Filing** | Hold named trees of files and say when one changed | A working copy, an object store |
| Sources | **Matching** | Compile a selection pattern and test paths against it | A glob, a saved search |
| Sources | **Configuring** | Turn a declarative document into an addressable settings tree | Settings, preferences |
| Data | **Documenting** | Keep a document's attributes beside its body | Front matter, a headed record |
| Data | **Layering** | Resolve one record from ranked contributions | Cascading defaults |
| Data | **Composing** | Assemble one record from separately known parts | A form builder, a context bag |
| Data | **Collecting** | Keep a named, ordered set of items with a card each | A playlist, an index, a feed |
| Rendering | **Templating** | Fill a stored template from a context, reusing smaller templates | Mail merge, layouts |
| Rendering | **Converting** | Turn lightweight markup into the markup a viewer reads | A Markdown pipeline |
| Rendering | **Referencing** | Record a text's outward references, answer them, rewrite the text | Link resolution, asset rewriting |
| Rendering | **Transcoding** | Derive sized and re-encoded renditions of one image | Media transcoding |
| Rendering | **Embedding** | Present one resource through the best rendition a viewer accepts | Responsive images |
| Publication | **Routing** | Give each item one address in a shared space | Permalinks, slugs, DNS |
| Publication | **Emitting** | Make a destination hold exactly the artifacts intended | Deploy, reconciliation |
| Control | **Depending** | Record what each result used; invalidate exactly its dependents | A build graph |
| Control | **Diagnosing** | Accumulate problems so one run reports all of them | A compiler's diagnostic bag |
| Control | **Phasing** | Carry a job through a declared sequence of phases | A pipeline, a workflow |

Each is implementable, testable, and readable on its own, and names no peer.
`Templating` does not know what a page is, `Routing` does not know what a
Markdown file is, and `Collecting` has never heard of a blog. Everything that
makes these a static site generator is in part 4.

## 2.2 There is no Page concept

A page is a source file, plus front matter, plus applied defaults, plus a
template choice, plus a route, plus collection memberships, plus co-located
assets, plus an output. That is not one behavior; it is eight behaviors that
share an identity.

So the design gives them a shared identity and nothing else. **A page is the
file identity minted by `Filing`.** `Documenting` keys a document by that
subject; `Layering` keys a record by it; `Routing` treats it as an owner;
`Collecting` as an item; `Emitting` as a producer; `Depending` as a result. No
concept holds a Page record, so no concept can come to depend on another's idea
of what a page is.

The same reasoning removes three more. **Site** is configuration plus an address
space. **Build** is a job with phases plus a dependency graph plus a diagnostic
bag. **Plugin** is a concept plus reactions, registered at assembly — which is
why deferring plugins costs nothing later.

## 2.3 Four conventions

**Identity is supplied, never invented across concepts.** Every pipeline concept
takes an opaque `subject` from the application and mints its own identity for
what it produces, offering both lookups. This keeps a reaction chain correlated
without leaning on flow correlation or on matching text by value.

**A subject may have parts.** `Converting`, `Referencing`, and `Composing` key
their records by `(subject, part)`. A page's authored body and its rendered body
are two parts of one subject; so are its render context and its collection card.
This removes every case where two stages of one pipeline would fight over one
record.

**Absence is a promise, not a flag.** Gates are `optional` queries that are
simply absent until a condition holds — chiefly `Referencing._finished`, absent
while any reference is unanswered, and `Embedding._markup`, absent until the
promised renditions have arrived. A reaction reading such a query plainly does
not fire; the action that satisfies the last condition lets the pipeline
continue. Nothing counts and nothing waits.

**Change is reported, never inferred.** `Filing.place`, `Configuring.load`,
`Templating.define`, `Collecting.include`, `Transcoding.admit`, and
`Routing.claim` all return a `changed` flag, and invalidation reactions trigger
only on `changed: true`. This is what lets the whole model be re-derived on every
job while only genuinely affected pages re-render.

## 2.4 The build is seven phases

```text
settings → read → route → excerpt → collect → render → emit
```

A phase is a **barrier**: the host advances the job only after the previous
phase's work has settled. Defaults are fully layered before any route is derived
from them; every route exists before any collection card quotes a URL; every card
is current before any page renders a listing.

Phases exist because three steps are genuinely global. A page cannot know that
every other page has claimed its route, that every other page has joined its
collections, or that a collection it is about to render is complete. Everything
else is per-page and needs no barrier.

Derivation runs on every job and is a pure function of file content; rendering is
gated by `Depending` and runs only for pages that are not current. Placing a file
records and invalidates but derives nothing, so a file placed before the
configuration was read is treated no differently from one placed after.

---

# Part 3 · The concepts

## 3.1 Sources and settings

### Filing

**Purpose.** Hold the current contents of one or more named trees of files, so
that anything else can read a file by address and can tell when its content
changed.

**Principle.** The content tree receives `posts/compiler-design/index.md`;
reading it back returns its bytes and a digest. Placing the same bytes again
reports no change; placing different bytes reports a change and a new digest.
Listing the tree under `posts/` returns that path and no others, in path order.
Resolving `./pipeline.png` from the page's own address finds its sibling, and
resolving `./missing.png` finds nothing. Placing a file at `../escape.md` is
refused. Discarding the page removes it from both reads.

```state
a set of Roots with
  a name Name

a set of Files with
  a root Root
  a path Path
  a content Bytes
  a digest Digest
```

At most one file exists for a given root and path. A path is a sequence of
non-empty segments and never leaves its root. `_under` answers in ascending
byte order of path.

```actions
open (name: Name) : return (root: Root)
  where some root has name
  then
    return that root
  where no root has name
  then
    add a new root with name
    return root

place (root: Root, path: Path, content: Bytes) : return (file: File, digest: Digest, changed: Flag)
  where path leaves root
  then
    refuse PATH_LEAVES_ROOT "A file path must stay inside its root."
  where some file has root and path
  then
    set that file's content and digest
    return file, digest, and whether the digest changed
  where no file has root and path
  then
    add a new file with root, path, content, and its digest
    return file, digest, and changed true

discard (file: File) : return (root: Root, path: Path)
  where file not in files
  then
    refuse FILE_NOT_FOUND "There is no such file."
  where file in files
  then
    delete file
    return root and path
```

```queries
_root (root: Root) : one (name: Name)
_named (name: Name) : optional (root: Root)
_file (file: File) : optional (root: Root, path: Path, name: Name, content: Bytes, digest: Digest)
_at (root: Root, path: Path) : optional (file: File, digest: Digest)
_under (root: Root, prefix: Path) : many (file: File, path: Path, digest: Digest)
_resolve (file: File, address: Address) : optional (target: File, path: Path)
_join (prefix: Path, name: Name) : one (path: Path)
_directory (path: Path) : one (prefix: Path)
_medium (path: Path) : one (medium: Medium)
```

`_file` promises *at most* one row rather than exactly one. A file identity can
outlive its file — a reaction holding one while the file is discarded is
ordinary in watch mode — and an `optional` promise makes that case drop the
reaction quietly instead of raising an integrity fault.

Filing owns **file-path syntax**: resolution of a relative address from a
file's own location, joining, and the medium implied by an extension. It owns
no pattern syntax — `_under` takes a literal prefix, not a glob — so that
pattern interpretation has exactly one home.

*Not its business:* what a file means, whether it should be published, or
whether anything refers to it.

---

### Matching

**Purpose.** Let a rule state which paths it applies to as one pattern, and
answer whether a given path is one of them, so the same selection rule can be
written once and checked anywhere.

**Principle.** The pattern `posts/**/*.md` compiles.
`posts/compiler-design/index.md` matches it; `about/index.md` does not;
`posts/notes.txt` does not. Compiling the same text again yields the same
pattern. Compiling `posts/**{` is refused as malformed, no pattern is added,
and a path tested against it does not match.

```state
a set of Patterns with
  a text Text
```

A pattern's identity is its normalized text, so the same text always names the
same pattern and no lookup step is needed at a use site.

```actions
compile (text: Text) : return (pattern: Pattern)
  where text is not a well-formed pattern
  then
    refuse MALFORMED_PATTERN "This pattern cannot be interpreted."
  where text is a well-formed pattern
  then
    add a pattern with text if none has it
    return pattern
```

```queries
_matches (pattern: Pattern, path: Path) : one (matched: Flag)
_compiled (text: Text) : optional (pattern: Pattern)
```

`_matches` promises exactly one row and answers `matched: false` for a pattern
that was never compiled. A rule whose pattern failed to compile therefore
selects nothing, and the refusal — not a silent mismatch — is where the problem
is reported. **Because the promise is `one`, callers test the flag with a
literal and never wrap this line in `no(...)`:** a denial over a `one` relation
can never hold.

*Not its business:* where paths come from, or what matching implies.

---

### Configuring

**Purpose.** Turn one declarative document into a normalized tree of settings
that can be read by name, so a project states its options once and the notation
it was written in stops mattering afterwards.

**Principle.** A YAML document is loaded and becomes the active configuration,
reporting that it changed. Reading the child `site` and then its child `title`
answers "Ada's Notes". Reading the sequence under `defaults` answers its rules
in written order, each with its index. Reading an absent key answers nothing
rather than failing. Asking a node for its whole subtree answers one plain
record. Asking a node where it was written answers a line and column. Loading
the same text again reports no change and leaves the active configuration and
its node identities untouched. Loading different text replaces it. A document
with unbalanced indentation is refused, and the previously active configuration
still stands.

```state
a set of Configurations with
  a source Text
  a digest Digest
  a notation Notation
  a root Node

a set of Nodes with
  an optional parent Node
  an optional key Key
  an optional index Number
  a kind Kind          -- mapping, sequence, or scalar
  an optional value Value
  a line Number
  a column Number

a Current set of Configurations
```

Children of a mapping and of a sequence keep the order of the source document.

```actions
load (source: Text, notation: Notation) : return (configuration: Configuration, root: Node, changed: Flag)
  where notation is not supported
  then
    refuse UNSUPPORTED_NOTATION "This configuration notation is not supported."
  where source is not well formed in notation
  then
    refuse MALFORMED_CONFIGURATION "This configuration document cannot be parsed."
  where the current configuration has this source's digest and notation
  then
    return that configuration, its root, and changed false
  where source is well formed and differs from the current configuration
  then
    add a configuration with source, its digest, notation, and its node tree
    make it the only current configuration
    return configuration, root, and changed true

discard (configuration: Configuration) : return (configuration: Configuration)
  where configuration not in configurations
  then
    refuse CONFIGURATION_NOT_FOUND "There is no such configuration."
  where configuration in configurations
  then
    delete configuration and its nodes
    return configuration
```

```queries
_active () : optional (configuration: Configuration, root: Node)
_child (node: Node, key: Key) : optional (child: Node, kind: Kind, value: Value)
_scalar (node: Node, key: Key, otherwise: Value) : one (value: Value)
_values (node: Node, key: Key, otherwise: Values) : one (values: Values)
_entries (node: Node) : many (key: Key, child: Node, value: Value)
_items (node: Node) : many (index: Number, item: Node, value: Value)
_record (node: Node) : one (values: Values)
_where (node: Node) : one (line: Number, column: Number)
```

A `key` may be dotted: `site.basePath` is one read. `_child` drops the case when
the key is absent, which is what a rule that must be present wants. `_scalar` and
`_values` answer a stated fallback instead, which is what an optional setting
wants — and without them, a reaction that reads three settings would fail to fire
at all because one of them was left out of `site.yaml`.

The node tree makes "supporting TOML later must not change the normalized
configuration model" true by construction: `load` is the only place a notation
is named, and every reader works on nodes.

The `changed` flag matters more than it looks. The build re-derives its whole
model on every job, so `load` runs every job; without the flag, every job would
mint a new configuration identity and invalidate the world.

*Not its business:* which keys are meaningful. `site`, `defaults`,
`collections`, and `images` are strings that appear in reactions, not here.

---

## 3.2 Documents and data

### Documenting

**Purpose.** Keep a written document's attributes beside the text they
describe, so one file can be edited as prose while its metadata is read
separately.

**Principle.** A text opening with a fenced YAML block followed by prose is
parsed for a subject: its attributes contain `title` and `date`, and its body
is the prose without the block. A text with no block parses with empty
attributes and its whole text as the body. A text whose block is malformed is
refused, and no document is recorded for that subject. Parsing the same subject
again replaces its document. Asking a document where its body starts answers a
line number in the original text.

```state
a set of Documents with
  a subject Subject
  an attributes Values
  a body Text
  a bodyLine Number
```

At most one document exists per subject.

```actions
parse (subject: Subject, text: Text) : return (document: Document, attributes: Values, body: Text)
  where text opens an attribute block that is not well formed
  then
    refuse MALFORMED_ATTRIBUTES "The attributes at the top of this document cannot be parsed."
  where text opens no attribute block, or a well-formed one
  then
    replace any document for subject
    add a document with subject, attributes, body, and the body's first line
    return document, attributes, and body

forget (subject: Subject) : return (document: Document)
  where no document has subject
  then
    refuse DOCUMENT_NOT_FOUND "There is no document for this subject."
  where some document has subject
  then
    delete that document
    return document
```

```queries
_document (subject: Subject) : optional (document: Document, attributes: Values, body: Text, bodyLine: Number)
_all () : many (document: Document, subject: Subject)
```

`bodyLine` is what lets a diagnostic raised while rendering a body point at a
line in the file the author actually edits.

*Not its business:* what any attribute means. This is where the product's
"minimal reserved vocabulary" principle becomes structural rather than
aspirational: there is nowhere in this concept for `tags` or `featured` to
acquire a meaning.

---

### Layering

**Purpose.** Resolve one record from several contributions of different
standing, so a value can be defaulted, overridden, and afterwards explained.

**Principle.** A page's record receives a broad rule's values at rank 0, a
section rule's values at rank 1, and the page's own attributes at rank
1000000. Resolving it answers the section's template and the page's own title.
A nested mapping contributed at rank 1 merges key by key with rank 0, while a
sequence replaces the earlier sequence outright. Asking where `build.template`
came from answers rank 1. Asking whether `topics` contains "compilers" answers
yes, and asking whether `draft` is present answers no. Contributing twice at
one rank is refused. Withdrawing rank 1 restores the broad rule's template.
Clearing the record leaves it resolving to an empty record.

```state
a set of Records with
  a subject Subject

a set of Layers with
  a record Record
  a rank Number
  a values Values
```

At most one layer exists for a given record and rank. Resolution merges layers
in ascending rank: mappings merge key by key; sequences and scalars replace.

```actions
contribute (subject: Subject, rank: Number, values: Values) : return (layer: Layer)
  where some layer for subject has rank
  then
    refuse RANK_TAKEN "This record already has a contribution at that rank."
  where no layer for subject has rank
  then
    add a record for subject if none exists
    add a layer with record, rank, and values
    return layer

withdraw (subject: Subject, rank: Number) : return (layer: Layer)
  where no layer for subject has rank
  then
    refuse NO_SUCH_LAYER "This record has no contribution at that rank."
  where some layer for subject has rank
  then
    delete that layer
    return layer

clear (subject: Subject) : return (subject: Subject, count: Number)
  then
    delete every layer for subject
    return subject and how many were deleted
```

```queries
_resolved (subject: Subject) : one (values: Values)
_value (subject: Subject, key: Key) : optional (value: Value)
_flag (subject: Subject, key: Key, otherwise: Flag) : one (value: Flag)
_holds (subject: Subject, key: Key, value: Value) : one (present: Flag, equal: Flag, contains: Flag)
_origin (subject: Subject, key: Key) : optional (rank: Number, layer: Layer)
_layers (subject: Subject) : many (rank: Number, values: Values)
```

A subject with no layers resolves to an empty record rather than to nothing.
`_value` and `_holds` take a dotted key, so `build.template` is one read.

Two things fall out of this concept that the product asks for and that are
otherwise hard to guarantee:

- **Order independence.** Defaults are applied by *declared rank*, never by the
  order in which reactions fire. "Later matching rules override earlier
  matching rules" becomes "a later rule contributes at a higher rank."
- **Explainability.** `_origin` is what `site inspect` reports when it says
  which default supplied a page's template.

`_holds` is deliberately the entire comparison vocabulary: presence, equality,
containment. It is exactly the operator set a collection rule may use, and it is
read once per operator in section 4.7.

*Not its business:* where contributions come from, or what the record is for.

---

### Composing

**Purpose.** Assemble one record from parts that are known separately, so a
value can be built by whoever knows each piece, in any order, without anyone
holding the whole shape.

**Principle.** A subject's context is given `site` and then `page.data`, and
reading it answers a record whose `page` member contains `data`. `page.url` is
added and appears beside it. `page.content` is set as raw, and reading the
record reports `page.content` among its raw keys while every other value is
ordinary. Setting `page.url` again replaces it and the record keeps one value.
A second part of the same subject is built independently and the first is
unchanged. Clearing a part empties it without touching the other.

```state
a set of Parts with
  a subject Subject
  a part Part

a set of Entries with
  a part Part
  a key Key
  a value Value
  a raw Flag
```

At most one entry exists per part and key. A dotted key nests: `page.data` and
`page.url` produce one `page` member with two members of its own. A key that
would nest inside a scalar is refused.

```actions
set (subject: Subject, part: Part, key: Key, value: Value, raw: Flag) : return (entry: Entry)
  where key would nest inside a value already set as a scalar
  then
    refuse KEY_CONFLICTS "This key would nest inside a value that is not a record."
  where key does not conflict
  then
    add a part for subject and part if none exists
    replace any entry for part and key
    add an entry with key, value, and raw
    return entry

clear (subject: Subject, part: Part) : return (subject: Subject, part: Part, count: Number)
  then
    delete every entry for that part
    return subject, part, and how many were deleted
```

```queries
_record (subject: Subject, part: Part) : one (values: Values, raw: Keys)
_value (subject: Subject, part: Part, key: Key) : optional (value: Value)
_keys (subject: Subject, part: Part) : many (key: Key, raw: Flag)
```

`_record` answers an empty record for a part that was never built, so it is
safe to read unconditionally.

`raw` marks a value that is already in its consumer's notation and must not be
re-encoded. `_record` answers the raw keys as a separate list rather than
wrapping the values, so the contract is concrete and a consumer that ignores it
still receives ordinary data. This is how a converted page body reaches a
template without being escaped again, and it is the only escaping exemption in
the whole design.

*Not its business:* what the record will be used for. It is used here twice —
once for a render context, once for a collection card — which is the reason it
exists as a concept rather than as a feature of `Templating`.

---

### Collecting

**Purpose.** Let something name an ordered set of items and keep a small card
for each, so a listing can be shown without reaching back into whatever the
items are.

**Principle.** The collection `posts` is declared to order descending. Three
items are included, each with a sort key, a tie-break, and a card, and each
inclusion reports that it changed something. Reading the collection answers
them newest first, and two items sharing a key come back in ascending tie-break
order. An item with no key sorts after every item that has one. Including an
item again with the same key and card reports no change and the order is
unaltered; including it with a different card reports a change. Excluding it
removes it. Reading the catalog answers every declared collection by name, each
with its ordered cards. Declaring `posts` again with the same direction reports
no change and keeps its entries; resetting removes every collection and entry.

```state
a set of Collections with
  a name Name
  a direction Direction

a set of Entries with
  a collection Collection
  an item Item
  an optional key Key
  a tiebreak Text
  a card Values
```

At most one entry exists per collection and item. Entries are ordered by key in
the declared direction, then by tie-break in ascending byte order. A missing
key sorts after every present key; keys of different kinds are ordered by kind
before value, in a fixed kind order.

```actions
declare (name: Name, direction: Direction) : return (collection: Collection, changed: Flag)
  where some collection has name and direction
  then
    return that collection and changed false
  where some collection has name and another direction
  then
    set its direction
    return collection and changed true
  where no collection has name
  then
    add a collection with name and direction
    return collection and changed true

include (collection: Collection, item: Item, key: Key, tiebreak: Text, card: Values) : return (entry: Entry, changed: Flag)
  where collection not in collections
  then
    refuse COLLECTION_NOT_FOUND "There is no such collection."
  where some entry has collection and item with this key, tiebreak, and card
  then
    return that entry and changed false
  where collection in collections and no entry matches exactly
  then
    replace any entry for collection and item
    add an entry with collection, item, key, tiebreak, and card
    return entry and changed true

exclude (collection: Collection, item: Item) : return (entry: Entry)
  where no entry has collection and item
  then
    refuse NOT_INCLUDED "This item is not in that collection."
  where some entry has collection and item
  then
    delete that entry
    return entry

withdraw (item: Item) : return (item: Item, count: Number)
  then
    delete every entry for item
    return item and how many were deleted

reset () : return (count: Number)
  then
    delete every collection and every entry
    return how many collections were deleted
```

```queries
_collections () : many (collection: Collection, name: Name, direction: Direction)
_named (name: Name) : optional (collection: Collection, direction: Direction)
_items (collection: Collection) : many (item: Item, key: Key, card: Values)
_membership (item: Item) : many (collection: Collection, name: Name)
_position (collection: Collection, item: Item) : optional (index: Number)
_catalog () : one (collections: Values)
```

The card is the reason this concept can be independent: **a collection never
receives an item's content, only what its listing needs**, and it never chooses
what a card contains. The product's rule that collection items expose metadata,
URLs, and excerpts — and that full content is withheld to avoid rendering
cycles — is enforced by the shape of `include`, not by discipline at the call
site.

`changed` is what keeps re-derivation cheap. The collect phase re-includes every
page on every job; only an inclusion that actually altered the listing
invalidates the pages that read it.

*Not its business:* which items belong, or what "descending" is applied to.

---

## 3.3 Rendering

### Templating

**Purpose.** Fill a stored template from a supplied context, letting templates
reuse smaller templates, so a layout is written once and used many times.

**Principle.** `page.html` is defined and names `header.html` and
`footer.html`, which are defined too; asking what it uses directly answers both,
and asking for its whole tree answers those and anything they use. An unnamed
text that also names `header.html` is filled for a subject: its output comes
back, its tree names the header, and no template was added under any name. Asking
what it reads answers the context members it mentions, such as `collections.posts`.
It is rendered for a subject with a context whose `page.content` is named raw:
the layout comes back filled in, with that value inserted unescaped and every
other value escaped. Rendering it for a second subject does not disturb the
first result. Defining `header.html` with the same text reports no change;
defining it so that it uses `page.html` and rendering again is refused for
recursion. Rendering a template that uses an undefined template is refused,
naming the missing one.

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

At most one template per name, one filling per subject, and one rendering per
template and subject. A read records a context reference split at its first
dot: `collections.posts` records root `collections` and member `posts`; `site`
alone records root `site` and an empty member.

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
  where its tree reaches template again
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

`fill` evaluates a text that has no name: an authored page body is filled once,
for one subject, and is never used by anything else. Keeping it out of the name
table is what separates the two lifecycles. A named template is a shared thing
whose change invalidates its users; a page body is not shared, and giving page
bodies names would make every edit to a page invalidate that same page — a loop
that never settles.

`_uses` is direct; `_tree` is the transitive closure and is what dependency
tracking reads, because the product requires that editing `header.html` rebuild
every page whose layout reaches it, not only the layouts that name it directly.

`_reads` is split into a root and a member so that a reaction can test the root
against a literal and bind the member. Without the split, a page would have to
depend on every collection that exists rather than on the ones its templates
mention, since no reaction can take a string apart.

Everything interpolated from the context is escaped for the output's notation
except the keys named in `raw`. Values arrive already assembled, which is why
this concept needs no notion of a binding: `Composing` builds the record and
this concept fills a template with it.

*Not its business:* where a template's text came from, what a subject is, or
what happens to the output.

---

### Converting

**Purpose.** Turn text written in a lightweight markup into the markup a
reader's viewer reads, so authors write prose rather than tags.

**Principle.** A dialect is declared with tables enabled and raw markup
allowed. A heading and a paragraph convert to HTML for one part of a subject;
converting a second part of the same subject leaves the first alone. Converting
the same source in the same dialect answers the stored conversion rather than
repeating the work. Text containing a table converts to a table because this
dialect enables it; the same text in a dialect without tables does not. A
document containing the excerpt separator has an excerpt ending there, and one
without a separator has none. A dialect that passes text through unchanged
converts an HTML document to itself. Text the dialect cannot parse is refused.

```state
a set of Dialects with
  a name Name
  a set of Extensions
  a raw Flag
  a separator Text

a set of Conversions with
  a subject Subject
  a part Part
  a dialect Dialect
  a digest Digest
  an output Text
  an optional excerpt Text
```

At most one conversion exists per subject and part.

```actions
declare (name: Name, extensions: Extensions, raw: Flag, separator: Text) : return (dialect: Dialect, changed: Flag)
  where some dialect has name and these settings
  then
    return that dialect and changed false
  where the settings are new or different
  then
    replace any dialect with name
    add a dialect with name, extensions, raw, and separator
    return dialect and changed true

convert (subject: Subject, part: Part, dialect: Dialect, source: Text) : return (conversion: Conversion, output: Text, excerpt: Text)
  where dialect not in dialects
  then
    refuse DIALECT_NOT_FOUND "There is no such dialect."
  where source cannot be parsed in dialect
  then
    refuse CONVERSION_FAILED "This text could not be converted."
  where some conversion has subject, part, dialect, and this source's digest
  then
    return that conversion with its output and excerpt
  where source can be parsed and differs from any stored conversion
  then
    replace any conversion for subject and part
    add a conversion with subject, part, dialect, the digest, output, and any excerpt
    return conversion, output, and excerpt

release (subject: Subject) : return (subject: Subject, count: Number)
```

```queries
_conversion (conversion: Conversion) : one (subject: Subject, part: Part, output: Text, excerpt: Text)
_for (subject: Subject, part: Part) : optional (conversion: Conversion, output: Text, excerpt: Text)
_dialect (name: Name) : optional (dialect: Dialect)
```

HTML content pages are not a special case in the composition: they use a
declared **verbatim dialect** whose conversion is the identity. One action, one
trigger shape, and the product's "HTML content is not passed through the
Markdown parser" holds because of which dialect a reaction selects.

The excerpt lives here because an excerpt is a fact about converted markup.
`part` is what lets a page's *authored* body be converted for its excerpt
separately from its *templated* body, which is what keeps collections and
rendering from depending on each other.

*Not its business:* which dialect a subject should use, or what the output is
inserted into.

---

### Referencing

**Purpose.** Record every outward reference a piece of text makes, so each can
be answered or reported as broken, and the text can be rewritten once all of
them are answered.

**Principle.** A body naming `./pipeline.png`, `./example.zip`, and `/about/`
is scanned as one part of a subject; three references are recorded with their
kind, label, position, and span, and none is answered. Asking for the finished
text answers nothing while any reference is unanswered, and asking which are
unanswered lists all three. Two are answered with addresses and one with
replacement markup; the finished text then comes back with the first two
targets rewritten and the third element replaced entirely. Answering a
reference again keeps the later answer and the finished text follows. Scanning
the same subject and part again replaces its references. A text with no
references is finished as soon as it is scanned.

```state
a set of Sources with
  a subject Subject
  a part Part
  a text Text

a set of References with
  a source Source
  a raw Address
  a kind Kind          -- link, image, embed, or download
  a label Text
  a line Number
  a column Number
  a span Span
  an optional answer Text
  an optional form Form  -- address or markup
```

At most one source exists per subject and part. A reference's kind comes from
the attribute it appeared in; its label is the accompanying link text or
alternative text; its span covers the enclosing element, so that a `markup`
answer can replace the whole element rather than only its target.

```actions
scan (subject: Subject, part: Part, text: Text) : return (source: Source, count: Number)
  then
    replace any source for subject and part
    add a source with subject, part, and text
    add a reference for each outward address the text makes
    return source and how many were added

answer (reference: Reference, form: Form, value: Text) : return (reference: Reference, source: Source, subject: Subject, part: Part)
  where reference not in references
  then
    refuse REFERENCE_NOT_FOUND "There is no such reference."
  where reference in references
  then
    set that reference's answer and form
    return reference with its source, subject, and part

drop (subject: Subject, part: Part) : return (source: Source)
```

```queries
_source (source: Source) : one (subject: Subject, part: Part)
_reference (reference: Reference) : one (source: Source, raw: Address, kind: Kind, label: Text, line: Number, column: Number)
_references (source: Source) : many (reference: Reference, raw: Address, kind: Kind, label: Text, line: Number, column: Number)
_unanswered (source: Source) : many (reference: Reference, raw: Address, kind: Kind, line: Number, column: Number)
_finished (subject: Subject, part: Part) : optional (source: Source, text: Text)
```

A scan reads HTML: the targets of `src`, `href`, `srcset`, and `poster`. By the
time anything is scanned it has already been converted, so Markdown links and
images arrive as ordinary attributes and need no separate treatment.

`_finished` is the design's main gate. It is present only when every reference
of that source has an answer, so the reaction that continues the pipeline simply
reads it: the action that answers the last reference is the one that lets the
page proceed, and a page with no references proceeds on its scan.

An answer takes one of two forms. An **address** replaces the reference's
target; **markup** replaces its whole span. The second form is what lets a
responsive image element take the place of a one-line image reference without
this concept knowing anything about images.

`part` is what allows the same subject to be scanned twice — once for the
converted body, once for the finished layout — as the product's rendering order
requires, without either pass disturbing the other.

*Not its business:* what an address resolves to, or whether an unanswered
reference is an error.

---

### Transcoding

**Purpose.** Derive alternative sizes and encodings of one source image, so a
reader receives a rendition their viewer can accept at a size their screen
needs.

**Principle.** A PNG is admitted for a subject; its format, intrinsic width and
height come back and it is not animated. Admitting the same bytes again answers
the same image and reports no change. Renditions are rendered at 480, 960, and
1440 in AVIF then in the original format, in that declared order; each is named
from the source content and its own settings, and each carries its position in
that order. A width greater than the source is skipped rather than upscaled.
Rendering the same widths and formats again answers the same renditions and
reports no change. An animated GIF is admitted, and a format that would drop its
animation is skipped. Bytes that are not an image are refused.

```state
a set of Originals with
  a subject Subject
  a content Bytes
  a digest Digest
  a format Format
  a width Number
  a height Number
  an animated Flag

a set of Renditions with
  an original Original
  a width Number
  a format Format
  an order Number
  a content Bytes
  a name Name
  a medium Medium
```

At most one original per subject and one rendition per original, width, and
format. A rendition's name is derived from the original's digest and the
rendition's own settings, and is therefore stable across equivalent runs.

```actions
admit (subject: Subject, content: Bytes) : return (original: Original, format: Format, width: Number, height: Number, animated: Flag, changed: Flag)
  where content is not a readable image
  then
    refuse UNREADABLE_IMAGE "These bytes are not a readable image."
  where some original has subject and this content's digest
  then
    return that original with its facts and changed false
  where content is a readable image and differs
  then
    replace any original for subject, with its renditions
    add an original with subject, content, its digest, format, width, height, and whether it is animated
    return original with its facts and changed true

render (original: Original, widths: Widths, formats: Formats) : return (original: Original, count: Number, changed: Flag)
  where original not in originals
  then
    refuse ORIGINAL_NOT_FOUND "There is no such image."
  where its renditions already answer these widths and formats
  then
    return original, their count, and changed false
  where its renditions do not answer these widths and formats
  then
    delete its renditions
    add one rendition for each format in declared order and each width no greater than the original's,
      numbering them in that order and skipping any format that would drop animation
    return original, how many were added, and changed true

release (subject: Subject) : return (original: Original)
```

```queries
_original (subject: Subject) : optional (original: Original, format: Format, width: Number, height: Number, animated: Flag)
_renditions (original: Original) : many (rendition: Rendition, width: Number, format: Format, order: Number, name: Name, medium: Medium, content: Bytes)
_rendition (rendition: Rendition) : one (original: Original, width: Number, format: Format, order: Number, name: Name, medium: Medium)
```

`render` deliberately produces the **whole rendition set in one action** and
returns its count. That count is what makes the next concept able to know when
it has everything, without anyone counting reaction firings. Both actions are
idempotent, which is what makes it safe for several pages to reference one
image.

`order` carries the declared format order forward, so the markup that quotes
these renditions is ordered by declaration rather than by arrival.

*Not its business:* where the image is published, or how it is presented.

---

### Embedding

**Purpose.** Present one resource through the best rendition a reader's viewer
can accept, without asking the author to choose.

**Principle.** An embedding is declared for a reference with its alternative
text, intrinsic size, and the number of renditions to expect. Asking for its
markup answers nothing while fewer have arrived. Three renditions are offered
with their addresses, formats, widths, and order. The markup then groups them by
format in that order, lists widths ascending within each group, ends with the
last group as the fallback, and carries the alternative text and the intrinsic
size. Offering the same rendition again changes nothing and the markup is
unchanged. An embedding declared to expect nothing has markup at once, showing
the original alone.

```state
a set of Embeddings with
  a subject Subject
  an alternative Text
  a width Number
  a height Number
  an expects Number

a set of Offers with
  an embedding Embedding
  an address Address
  a format Format
  a width Number
  an order Number
```

At most one embedding per subject and one offer per embedding and address.

```actions
declare (subject: Subject, alternative: Text, width: Number, height: Number, expects: Number) : return (embedding: Embedding)
  then
    replace any embedding for subject, with its offers
    add an embedding with subject, alternative, width, height, and expects
    return embedding

offer (embedding: Embedding, address: Address, format: Format, width: Number, order: Number) : return (offer: Offer, embedding: Embedding, arrived: Number)
  where embedding not in embeddings
  then
    refuse EMBEDDING_NOT_FOUND "There is no such embedding."
  where embedding in embeddings
  then
    replace any offer for embedding and address
    add an offer with embedding, address, format, width, and order
    return offer, embedding, and how many offers it now has

withdraw (subject: Subject) : return (embedding: Embedding)
```

```queries
_embedding (embedding: Embedding) : one (subject: Subject, expects: Number, arrived: Number)
_for (subject: Subject) : optional (embedding: Embedding, expects: Number, arrived: Number)
_offers (embedding: Embedding) : many (address: Address, format: Format, width: Number, order: Number)
_markup (embedding: Embedding) : optional (markup: Text)
```

`_markup` is absent until the promised number of offers has arrived. It is the
second gate in the design, and it works like the first: the last offer completes
the embedding, and one reaction reading an `optional` query fires exactly once.

The addresses it is offered are site-absolute and carry no deployment base. The
base is applied to the whole finished document in one later pass, so nothing
here can double-apply it.

The exact element emitted is not a policy spread across the build; it is one
concept's behavior, fixed by one principle test.

*Not its business:* how the renditions were produced, or where their addresses
came from.

---

## 3.4 Publication

### Routing

**Purpose.** Give each item one address in a shared space, and refuse a second
claim on an address, so a reader's address always names one thing.

**Principle.** The base is set to `/`. The path `posts/compiler-design/index.md`
derives the address `/posts/compiler-design/`, and a page claims it. A second
page whose path derives the same address is refused, and the first keeps it. The
first page claiming the same address again succeeds and nothing changes. A third
page claims a stated address of its own, and a fourth claims `/404.html`. Asking
for the file behind `/posts/compiler-design/` answers
`posts/compiler-design/index.html`, and behind `/404.html` answers `404.html`.
Asking for the URL of a site-absolute target answers it below the base; setting
the base to `/notes/` changes every URL and no claim. Classifying `./x.png`
answers relative, `/about/` answers absolute, `https://example.com` answers
external, and `#top` answers fragment. Claiming `posts/x` without a leading
slash is refused. Releasing a page frees its address for another.

```state
a Base Address

a set of Claims with
  an owner Owner
  an address Address
```

At most one claim per address, and at most one per owner.

```actions
rebase (base: Address) : return (base: Address, changed: Flag)
  where base is not a well-formed base
  then
    refuse INVALID_BASE "A base must begin and end with a slash."
  where base is a well-formed base
  then
    set the base
    return base and whether it changed

claim (owner: Owner, address: Address) : return (claim: Claim, address: Address, changed: Flag)
  where address is not well formed
  then
    refuse INVALID_ADDRESS "An address must begin with a slash and name only path segments."
  where some claim has address with another owner
  then
    refuse ADDRESS_TAKEN "Another owner has already claimed this address."
  where some claim has owner and address
  then
    return that claim, address, and changed false
  where no claim has address
  then
    replace any claim for owner
    add a claim with owner and address
    return claim, address, and changed true

release (owner: Owner) : return (claim: Claim, address: Address)
  where no claim has owner
  then
    refuse NOT_CLAIMED "This owner has claimed no address."
  where some claim has owner
  then
    delete that claim
    return claim and address
```

```queries
_derive (path: Path) : one (address: Address)
_address (owner: Owner) : optional (address: Address, url: Url)
_owner (address: Address) : optional (owner: Owner)
_file (address: Address) : one (path: Path)
_locate (path: Path) : one (address: Address)
_url (target: Address) : one (url: Url)
_classify (target: Address) : one (kind: AddressKind)
_claims () : many (owner: Owner, address: Address)
```

Routing owns **address syntax**: the address a source path derives (dropping an
index segment and an extension, ending in a slash), the file behind an address
(appending `index.html` to a directory-style address, and nothing to one that
already names a file), the address at which an output path is served, the URL of
a site-absolute target below the base, and the classification of an authored reference as relative, absolute, external, or
fragment.

`_classify` exists because reactions cannot take a string apart, and deciding
what to do with `./x.png` versus `https://example.com/x.png` is a decision the
composition has to make on every reference.

Because addresses become URLs here and references are rewritten by
`Referencing`, **no template-language URL helper is needed**. A template writes
an ordinary relative or site-absolute href, and the rebasing pass answers it
with a URL that already includes the base.

*Not its business:* what an owner is, whether an address should exist, or
whether anything is written anywhere.

---

### Emitting

**Purpose.** Make a destination hold exactly the artifacts intended — writing
what is new, replacing what changed, leaving what did not, removing what is no
longer intended — and refuse two producers that disagree about one path.

**Principle.** The destination is directed at a directory that already holds a
stale `old.html`. One producer opens an attempt and intends `index.html` and
`a.css`; another intends `styles.css`. Reconciling writes all three and removes
`old.html`. A third producer intending `index.html` with different bytes is
refused, and the first intent stands. A fourth intending `styles.css` with the
same bytes is accepted, so two producers may agree about one path. The first
producer opens a second attempt and intends only `index.html`, with different
bytes; reconciling now rewrites `index.html` and still holds `a.css`, because
the attempt has not been committed. It commits, and reconciling removes `a.css`.
Retracting a producer drops everything it intends. A path leaving the
destination is refused.

```state
a Destination Root

a set of Producers with
  a producer Producer
  an attempt Number

a set of Intents with
  a producer Producer
  a path Path
  a content Bytes
  a digest Digest
  a medium Medium
  an attempt Number

a set of Emitted with
  a path Path
  a digest Digest
```

At most one intent exists per producer and path, and at most one producer record
per producer. Several producers may intend one path only when they intend the
same digest. `Emitted` records what the destination holds.

```actions
direct (destination: Root) : return (destination: Root, existing: Number)
  then
    set the destination
    record every file it already holds, with its digest, as emitted
    return destination and how many were recorded

begin (producer: Producer) : return (producer: Producer, attempt: Number)
  then
    add a producer record if none exists
    raise its attempt by one
    return producer and attempt

intend (producer: Producer, path: Path, content: Bytes, medium: Medium) : return (intent: Intent, path: Path, digest: Digest)
  where path leaves the destination
  then
    refuse PATH_LEAVES_DESTINATION "An output path must stay inside the destination."
  where another producer intends path with a different digest
  then
    refuse PATH_CONTESTED "Another producer intends different content at this path."
  where no other producer disagrees about path
  then
    add a producer record if none exists
    replace any intent for producer and path
    add an intent with producer, path, content, its digest, medium, and the producer's attempt
    return intent, path, and digest

commit (producer: Producer) : return (producer: Producer, dropped: Number)
  where producer has no record
  then
    refuse NOT_BEGUN "This producer has opened no attempt."
  where producer has a record
  then
    delete its intents from earlier attempts
    return producer and how many were deleted

retract (producer: Producer) : return (producer: Producer, count: Number)
  then
    delete every intent for producer and its producer record
    return producer and how many intents were deleted

reconcile () : return (written: Number, replaced: Number, kept: Number, removed: Number)
  then
    write every intended path that is not emitted
    replace every intended path whose digest differs from the emitted digest
    leave every intended path whose digest is unchanged
    remove every emitted path that is no longer intended
    set emitted to the intended paths and digests
    return the four counts
```

```queries
_intent (path: Path) : optional (digest: Digest, medium: Medium)
_producers (path: Path) : many (producer: Producer)
_byProducer (producer: Producer) : many (path: Path, digest: Digest, medium: Medium)
_attempt (producer: Producer) : optional (attempt: Number)
_pending () : many (path: Path, digest: Digest)
_orphans () : many (path: Path)
```

Three rules here carry a lot of weight.

**`intend` refuses a disagreement, not a coincidence.** A page and a public file
that both want `about/index.html` with different content is a collision and is
reported. Two pages that both reference one image, and therefore both intend the
same rendition at the same path with the same bytes, is not a collision.
Insisting that it were would either force a shared producer identity — which
then nothing can retract correctly — or force asset intents to outlive the pages
that caused them. This rule is what makes asset cleanup fall out for free: an
asset's intents belong to the pages that reference it, and a page that stops
referencing it drops its own.

**An attempt is what makes a failed recomputation harmless.** A producer that
begins, intends some of its outputs, and then fails leaves its previous attempt's
intents in place, so the last good output of that producer survives until a
recomputation actually finishes. Committing is the point at which paths the
producer no longer intends disappear. Retracting before recomputing would
instead delete a page's output the moment its source became invalid.

**`direct` records what the destination already holds**, so a fresh process can
remove outputs a previous run produced. Without it, removing outputs that are no
longer intended would only work inside one long-lived process.

Reconciliation acts on a **set**, not a stream, which is what makes an
incremental run and a clean run produce the same destination.

*Not its business:* who produced anything, or why.

---

## 3.5 Control

### Depending

**Purpose.** Record what each result was computed from, so that a change to an
input invalidates exactly the results that used it, and each of them can say why
it must be recomputed.

**Principle.** A page's result begins, records its source, its layout, and a
collection as inputs, and settles; it is then current. Touching the layout marks
it stale and names the layout as the reason. Touching an unrelated file marks
nothing. A second result that used the page's own subject as an input is marked
stale too, because staleness follows uses transitively. A result that began and
never settled is marked stale by a touch just as a settled one is, so a page
whose render failed is not stranded. Beginning the page again clears its inputs
and its reason; recording new inputs and settling makes it current. Recording an
input for a result that is not building is refused.

```state
a set of Results with
  a subject Subject
  a state State        -- building, current, or stale
  an optional reason Input

a set of Uses with
  a result Result
  an input Input
```

An input may itself be the subject of a result. `_stale` answers in ascending
byte order of subject.

```actions
begin (subject: Subject) : return (result: Result)
  then
    add a result for subject if none exists
    delete its uses and its reason
    set its state to building
    return result

use (subject: Subject, input: Input) : return (use: Use)
  where no result for subject is building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where some result for subject is building
  then
    add a use with result and input if none exists
    return use

settle (subject: Subject) : return (result: Result)
  where no result for subject is building
  then
    refuse NOT_BUILDING "This result is not being computed."
  where some result for subject is building
  then
    set its state to current
    return result

touch (input: Input) : return (input: Input, count: Number)
  then
    set every result that uses input and is not already stale to stale, with input as its reason
    do the same, transitively, for results that use those results' subjects
    return input and how many became stale

drop (subject: Subject) : return (result: Result)
```

```queries
_state (subject: Subject) : one (state: State)
_current (subject: Subject) : optional (result: Result)
_reason (subject: Subject) : optional (reason: Input)
_stale () : many (subject: Subject, reason: Input)
_uses (subject: Subject) : many (input: Input)
_dependents (input: Input) : many (subject: Subject)
```

`_current` is present only for a result in the current state, and it is what the
render phase reads to decide what to rebuild: a page with no result at all and a
page whose result is stale both read as absent, so the first build and every
rebuild take the same path.

`touch` invalidating a *building* result as well as a current one is not
fussiness. A page whose render was refused — a broken link, a template failure —
stays building forever; if `touch` skipped it, fixing the file would never
rebuild it.

Because inputs are cleared by `begin` and re-recorded each time, the graph is
derived rather than accumulated: **a new process needs no previous graph**,
exactly as the product requires.

*Not its business:* what a result is, or how to recompute one.

---

### Diagnosing

**Purpose.** Collect the problems that independent checks find, so one run
reports all of them together and a later run can retract the ones that no longer
apply.

**Principle.** Three problems are reported: an error in one file, a warning in
another, and a second error in the first file at a later line. Reading them
answers errors before warnings and, within one severity, orders them by source
and then by position. A related location is attached to the first error and comes
back with it. The run is not clean while an error stands; a run holding only the
warning is clean. Retracting everything attached to the first file leaves the
warning, and the run is then clean. Reporting the same code at the same place
twice records one.

```state
a set of Diagnostics with
  a severity Severity   -- error or warning
  a code Code
  a message Text
  an optional source Source
  an optional line Number
  an optional column Number

a set of Relations with
  a diagnostic Diagnostic
  a source Source
  an optional line Number
  an optional column Number
  a note Text
```

At most one diagnostic exists per severity, code, source, line, and column.
`_all` answers errors before warnings, then by source in ascending byte order,
then by line and column, then by code.

```actions
report (severity: Severity, code: Code, message: Text, source: Source, line: Number, column: Number) : return (diagnostic: Diagnostic)
  where severity is neither error nor warning
  then
    refuse UNKNOWN_SEVERITY "A diagnostic is an error or a warning."
  where severity is error or warning
  then
    add a diagnostic if none matches severity, code, source, line, and column
    return diagnostic

relate (diagnostic: Diagnostic, source: Source, line: Number, column: Number, note: Text) : return (relation: Relation)
  where diagnostic not in diagnostics
  then
    refuse DIAGNOSTIC_NOT_FOUND "There is no such diagnostic."
  where diagnostic in diagnostics
  then
    add a relation with diagnostic, source, line, column, and note
    return relation

retract (source: Source) : return (source: Source, count: Number)
clear () : return (count: Number)
```

```queries
_all () : many (diagnostic: Diagnostic, severity: Severity, code: Code, message: Text, source: Source, line: Number, column: Number)
_errors () : many (diagnostic: Diagnostic, code: Code, message: Text, source: Source, line: Number, column: Number)
_for (source: Source) : many (diagnostic: Diagnostic, severity: Severity, code: Code, message: Text, line: Number, column: Number)
_related (diagnostic: Diagnostic) : many (source: Source, line: Number, column: Number, note: Text)
_clean () : one (clean: Flag)
```

Accumulation is the default and refusal is not: a check that finds a problem
reports it and the run continues, which is what the product means by "one
invalid page should not prevent the generator from reporting unrelated errors".
`retract` by source is what a rebuild uses before it re-renders a page.

*Not its business:* whether a problem should stop the run. That is a decision
about a mode, and it lives in the composition.

---

### Phasing

**Purpose.** Carry one job through a declared sequence of phases, so that work
in a later phase can assume the work of every earlier phase is complete.

**Principle.** A sequence is declared over ready, settings, read, route,
excerpt, collect, render, and emit. Declaring it again with the same phases
reports no change. A job is started on it in `once` mode and begins at ready,
where nothing is declared to happen. Advancing announces settings, then read,
then route, and so on. Advancing past emit finishes the job, and
advancing a finished job is refused. A second job started on the same sequence
proceeds independently. Abandoning a running job leaves it failed with a reason,
and it announces no further phase.

```state
a set of Sequences with
  a name Name
  an ordered set of Phases

a set of Jobs with
  a sequence Sequence
  a mode Mode          -- once or live
  an optional phase Phase
  a state State        -- running, finished, or failed
  an optional reason Text
```

```actions
declare (name: Name, phases: Phases) : return (sequence: Sequence, changed: Flag)
  where phases is empty
  then
    refuse NO_PHASES "A sequence needs at least one phase."
  where some sequence has name and these phases
  then
    return that sequence and changed false
  where phases is not empty and new or different
  then
    replace any sequence with name
    add a sequence with name and phases
    return sequence and changed true

start (sequence: Sequence, mode: Mode) : return (job: Job, phase: Phase, mode: Mode)
  where sequence not in sequences
  then
    refuse SEQUENCE_NOT_FOUND "There is no such sequence."
  where sequence in sequences
  then
    add a running job with sequence, mode, and its first phase
    return job, phase, and mode

advance (job: Job) : return (job: Job, phase: Phase, mode: Mode)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where job is running and has a later phase
  then
    set its phase to the next one
    return job, phase, and mode
  where job is running and has no later phase
  then
    set its state to finished
    return job, its last phase, and mode

abandon (job: Job, reason: Text) : return (job: Job, reason: Text)
  where job is not running
  then
    refuse JOB_NOT_RUNNING "This job is not running."
  where job is running
  then
    set its state to failed with reason
    return job and reason
```

```queries
_job (job: Job) : one (phase: Phase, state: State, mode: Mode)
_running () : many (job: Job, phase: Phase, mode: Mode)
_outcome (job: Job) : optional (state: State, reason: Text)
```

Phasing announces a phase; it does not detect that a phase's work is done. The
host that started the job asks for the next phase once the previous
announcement's work has settled, which the runtime can report because execution
is sequential and a flow settles. This is the one place the design leans on the
runtime rather than on a behavior; part 8 says what that costs.

*Not its business:* what happens in a phase.


---

# Part 4 · The composition

Everything that makes these seventeen behaviors a static site generator is
written here. No concept holds a reference to any of it.

Two rules govern the whole part. **Nothing depends on the order in which
reactions fire**: where order matters it is expressed as a chain on a returned
action or as a phase barrier, and where several things must happen in no
particular order they are labelled siblings. **Everything derives on every job;
only what is stale is recomputed.**

## 4.1 Shared questions

Each admitting view has an explicit negative twin, so a branch can answer the
other case.

```ts
export const pathIsPageSource = view("(path) is a page source", ({ path }, _o, _b) =>
  where(Matching._matches({ pattern: "**/*.{md,html}", path }).is({ matched: true })),
).holds();

export const fileIsARasterImage = view("(file) is a raster image", ({ file }, _o, { path }) =>
  where(
    Filing._file({ file }).is({ path }),
    Matching._matches({ pattern: "**/*.{png,jpg,jpeg,gif,webp,avif}", path }).is({ matched: true }),
  ),
).holds();

export const fileIsNotARasterImage = view("(file) is not a raster image", ({ file }, _o, { path }) =>
  where(
    Filing._file({ file }).is({ path }),
    Matching._matches({ pattern: "**/*.{png,jpg,jpeg,gif,webp,avif}", path }).is({ matched: false }),
  ),
).holds();

export const pageIsPublished = view("(page) is published", ({ page }, _o, _b) =>
  where(Layering._flag({ subject: page, key: "build.publish", otherwise: true }).is({ value: true })),
).holds();

export const pageIsWithheld = view("(page) is withheld", ({ page }, _o, _b) =>
  where(Layering._flag({ subject: page, key: "build.publish", otherwise: true }).is({ value: false })),
).holds();

export const theLayoutOf = view("the layout of (page)", ({ page }, { template }, { name }) =>
  where(
    Layering._value({ subject: page, key: "build.template" }).is({ value: name }),
    Templating._template({ name }).is({ template }),
  ),
).optional();

export const theLayoutName = view("the layout name of (page)", ({ page }, { name }, _b) =>
  where(Layering._value({ subject: page, key: "build.template" }).is({ value: name })),
).optional();

export const theMarkupOf = view("the markup of (page)", ({ page }, { dialect }, { name }) =>
  where(
    Layering._value({ subject: page, key: "build.markup" }).is({ value: name }),
    Converting._dialect({ name }).is({ dialect }),
  ),
).optional();

export const theSettingsFile = view("the settings file", (_i, { file }, { root }) =>
  where(
    Filing._named({ name: "project" }).is({ root }),
    Filing._at({ root, path: "site.yaml" }).is({ file }),
  ),
).optional();

export const theSiteRecord = view("the site record", (_i, { values }, { root }) =>
  where(
    Configuring._active().is({ root }),
    Configuring._values({ node: root, key: "site", otherwise: {} }).is({ values }),
  ),
).optional();

export const theAssetFolder = view("the asset folder", (_i, { folder }, { root }) =>
  where(
    Configuring._active().is({ root }),
    Configuring._scalar({ node: root, key: "paths.assets", otherwise: "assets" }).is({ value: folder }),
  ),
).optional();

export const theImageSettings = view("the image settings", (_i, { widths, formats }, { root }) =>
  where(
    Configuring._active().is({ root }),
    Configuring._values({ node: root, key: "images.widths", otherwise: [480, 960, 1440] }).is({ values: widths }),
    Configuring._values({ node: root, key: "images.formats", otherwise: ["avif", "webp", "original"] }).is({ values: formats }),
  ),
).optional();

export const theRuleOf = view(
  "the rule of collection (name)",
  ({ name }, { glob, sortKey }, { root, node, rule }) =>
    where(
      Configuring._active().is({ root }),
      Configuring._child({ node: root, key: "collections" }).is({ child: node }),
      Configuring._child({ node, key: name }).is({ child: rule }),
      Configuring._child({ node: rule, key: "match" }).is({ value: glob }),
      Configuring._scalar({ node: rule, key: "sort.by", otherwise: "" }).is({ value: sortKey }),
    ),
).optional();

export const theOutputFolderOf = view("the output folder of (page)", ({ page }, { folder }, { address, path }) =>
  where(
    Routing._address({ owner: page }).is({ address }),
    Routing._file({ address }).is({ path }),
    Filing._directory({ path }).is({ prefix: folder }),
  ),
).optional();

export const theImageOfReference = view(
  "the image of reference (reference)",
  ({ reference }, { original, page, target }, { source, raw }) =>
    where(
      Referencing._reference({ reference }).is({ source, raw }),
      Referencing._source({ source }).is({ subject: page }),
      Filing._resolve({ file: page, address: raw }).is({ target }),
      Transcoding._original({ subject: target }).is({ original }),
    ),
).optional();

export const theJobIsStrict = view("the job is strict", (_i, _o, _b) =>
  where(Phasing._running().is({ mode: "once" })),
).holds();

export const theJobIsLenient = view("the job is lenient", (_i, _o, _b) =>
  where(Phasing._running().is({ mode: "live" })),
).holds();
```

`build.markup` is what removes the need for any concept to know that `.md` means
Markdown: the mapping is an ordinary default rule, and adding a third markup is
a dialect declaration plus one rule.

## 4.2 Sources arrive

The host pushes every file through one endpoint. Placement records and
invalidates; it derives nothing.

```ts
export const ChangedFileInvalidates = reaction(({ file }) =>
  when(Filing.place({}).responds({ file, changed: true })).then(Depending.touch({ input: file })),
);

export const RemovedFileInvalidates = reaction(({ file, path }) =>
  when(Filing.discard({ file }).responds({ path })).then(
    Emitting.retract({ producer: file }).named("outputs"),
    Diagnosing.retract({ source: path }).named("diagnostics"),
    Depending.touch({ input: file }).named("dependents"),
    Depending.drop({ subject: file }).named("result"),
  ),
);

export const RemovedPageForgets = reaction(({ file }) =>
  when(Filing.discard({ file }).responds({}))
    .where(Documenting._document({ subject: file }))
    .then(
      Documenting.forget({ subject: file }).named("document"),
      Layering.clear({ subject: file }).named("layers"),
      Collecting.withdraw({ item: file }).named("collections"),
      Converting.release({ subject: file }).named("conversions"),
      Composing.clear({ subject: file, part: "context" }).named("context"),
      Composing.clear({ subject: file, part: "card" }).named("card"),
    ),
);

export const RemovedRouteReleases = reaction(({ file }) =>
  when(Filing.discard({ file }).responds({}))
    .where(Routing._address({ owner: file }))
    .then(Routing.release({ owner: file })),
);
```

The existence guards matter: without them, discarding a stylesheet would produce
a cascade of refusals from concepts that never held anything for it.

## 4.3 Settings phase

```ts
export const BuiltInPatternsCompile = reaction(() =>
  when(Phasing.advance({}).responds({ phase: "settings" })).then(
    Matching.compile({ text: "**/*.{md,html}" }).named("pages"),
    Matching.compile({ text: "includes/**" }).named("includes"),
    Matching.compile({ text: "**/*.{png,jpg,jpeg,gif,webp,avif}" }).named("raster"),
  ),
);

export const SettingsLoad = reaction(({ file, content }) =>
  when(Phasing.advance({}).responds({ phase: "settings" }))
    .where(theSettingsFile().is({ file }), Filing._file({ file }).is({ content }))
    .then(Configuring.load({ source: content, notation: "yaml" })),
);

export const SettingsApply = reaction(({ root, base, destination }) =>
  when(Configuring.load({}).responds({ root, changed: true }))
    .where(
      Configuring._scalar({ node: root, key: "site.basePath", otherwise: "/" }).is({ value: base }),
      Configuring._scalar({ node: root, key: "paths.output", otherwise: "dist" }).is({ value: destination }),
    )
    .then(
      Routing.rebase({ base }).named("base"),
      Emitting.direct({ destination }).named("destination"),
      Diagnosing.retract({ source: "site.yaml" }).named("diagnostics"),
      Collecting.reset().named("collections"),
    ),
);

export const CollectionsDeclare = reaction(({ root, node, name, rule, direction }) =>
  when(Collecting.reset({}).responds({}))
    .where(
      Configuring._active().is({ root }),
      Configuring._child({ node: root, key: "collections" }).is({ child: node }),
      Configuring._entries({ node }).is({ key: name, child: rule }),
      Configuring._scalar({ node: rule, key: "sort.order", otherwise: "asc" }).is({ value: direction }),
    )
    .then(Collecting.declare({ name, direction })),
);

export const RulePatternsCompile = reaction(({ root, node, rule, glob }) =>
  when(Configuring.load({}).responds({ root, changed: true }))
    .where(
      Configuring._child({ node: root, key: "defaults" }).is({ child: node }),
      Configuring._items({ node }).is({ item: rule }),
      Configuring._child({ node: rule, key: "match" }).is({ value: glob }),
    )
    .then(Matching.compile({ text: glob })),
);

export const DialectsDeclare = reaction(({ root, extensions, raw, separator }) =>
  when(Configuring.load({}).responds({ root, changed: true }))
    .where(
      Configuring._values({
        node: root,
        key: "markdown.extensions",
        otherwise: ["tables", "footnotes", "strikethrough", "autolinks"],
      }).is({ values: extensions }),
      Configuring._scalar({ node: root, key: "markdown.raw", otherwise: true }).is({ value: raw }),
      Configuring._scalar({ node: root, key: "markdown.excerptSeparator", otherwise: "<!--more-->" }).is({
        value: separator,
      }),
    )
    .then(
      Converting.declare({ name: "markdown", extensions, raw, separator }).named("markdown"),
      Converting.declare({ name: "verbatim", extensions: [], raw: true, separator }).named("verbatim"),
    ),
);
```

`Collecting.reset` before re-declaring is what lets a collection be renamed or
removed in `site.yaml` without leaving a ghost. It is safe because the collect
phase re-includes every page, and because every page records the settings file
among its inputs, so a configuration change invalidates all of them. Ordering
inside the phase is by chain: `reset` returns before `declare` is asked.

`Configuring._scalar` and `_values` answer a stated fallback rather than dropping
the case. Without them, a reaction reading three settings would not fire at all
because one of them was left out of `site.yaml`.

## 4.4 Read phase

```ts
export const DocumentsParse = reaction(({ root, file, path, content }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(
      Filing._named({ name: "content" }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      pathIsPageSource({ path }),
      Filing._file({ file }).is({ content }),
    )
    .then(Documenting.parse({ subject: file, text: content })),
);

export const TemplatesDefine = reaction(({ root, file, path, content }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(
      Filing._named({ name: "templates" }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Matching._matches({ pattern: "includes/**", path }).is({ matched: false }),
      Filing._file({ file }).is({ content }),
    )
    .then(Templating.define({ name: path, source: content })),
);

export const PartialsDefine = reaction(({ root, file, path, leaf, content }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(
      Filing._named({ name: "templates" }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Matching._matches({ pattern: "includes/**", path }).is({ matched: true }),
      Filing._file({ file }).is({ name: leaf, content }),
    )
    .then(Templating.define({ name: leaf, source: content })),
);

export const PublicFilesEmit = reaction(({ root, file, path, content, medium }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(
      Filing._named({ name: "public" }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._file({ file }).is({ content }),
      Filing._medium({ path }).is({ medium }),
    )
    .then(Emitting.intend({ producer: file, path, content, medium })),
);

export const AttributesLayer = reaction(({ subject, attributes }) =>
  when(Documenting.parse({ subject }).responds({ attributes }))
    .then(Layering.clear({ subject }).responds({}))
    .then(Layering.contribute({ subject, rank: 1000000, values: attributes })),
);

export const DefaultsLayer = reaction(({ subject, path, root, node, index, rule, glob, values, record }) =>
  when(Layering.clear({ subject }).responds({}))
    .where(
      Filing._file({ file: subject }).is({ path }),
      Configuring._active().is({ root }),
      Configuring._child({ node: root, key: "defaults" }).is({ child: node }),
      Configuring._items({ node }).is({ index, item: rule }),
      Configuring._child({ node: rule, key: "match" }).is({ value: glob }),
      Matching._matches({ pattern: glob, path }).is({ matched: true }),
      Configuring._child({ node: rule, key: "values" }).is({ child: values }),
      Configuring._record({ node: values }).is({ values: record }),
    )
    .then(Layering.contribute({ subject, rank: index, values: record })),
);
```

`PartialsDefine` registers a partial under its bare filename, because templates
write `{% render "header.html" %}` while the file lives at
`templates/includes/header.html`. The two definition reactions discriminate with
a literal test on a `one` relation — `matched: false` — and not with `no(...)`,
which can never hold over a relation that always supplies a row.

`DefaultsLayer` fires once per matching rule and contributes at the rule's own
index. Whatever order the firings take, the resolved record is identical, because
rank — not arrival — decides the merge. The page's own attributes sit above every
rule at rank 1000000. If the page was discarded in the meantime, `Filing._file`
supplies no row and the whole thing quietly does not happen.

## 4.5 Route phase

Two independent reactions: one for a derived route, one for a stated one. They
are not exclusive branches of a decision; they are two rules that happen never to
hold at once.

```ts
export const DerivedRoutesClaim = reaction(({ page, path, address }) =>
  when(Phasing.advance({}).responds({ phase: "route" }))
    .where(
      Documenting._all().is({ subject: page }),
      pageIsPublished({ page }),
      no(Layering._value({ subject: page, key: "build.route" })),
      Filing._file({ file: page }).is({ path }),
      Routing._derive({ path }).is({ address }),
    )
    .then(Routing.claim({ owner: page, address })),
);

export const StatedRoutesClaim = reaction(({ page, address }) =>
  when(Phasing.advance({}).responds({ phase: "route" }))
    .where(
      Documenting._all().is({ subject: page }),
      pageIsPublished({ page }),
      Layering._value({ subject: page, key: "build.route" }).is({ value: address }),
    )
    .then(Routing.claim({ owner: page, address })),
);

export const WithheldPagesRelease = reaction(({ page }) =>
  when(Phasing.advance({}).responds({ phase: "route" }))
    .where(
      Documenting._all().is({ subject: page }),
      pageIsWithheld({ page }),
      Routing._address({ owner: page }),
    )
    .then(
      Routing.release({ owner: page }).named("route"),
      Emitting.retract({ producer: page }).named("outputs"),
    ),
);

export const RouteCollisionReports = reaction(({ page, address, incumbent, path, other, diagnostic }) =>
  when(Routing.claim({ owner: page, address }).refuses({ refusal: "ADDRESS_TAKEN" }))
    .where(
      Routing._owner({ address }).is({ owner: incumbent }),
      Filing._file({ file: page }).is({ path }),
      Filing._file({ file: incumbent }).is({ path: other }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "ROUTE_COLLISION",
        message: "Two pages claim one address.",
        source: path,
      }).responds({ diagnostic }),
    )
    .then(Diagnosing.relate({ diagnostic, source: other, note: "already claims this address" })),
);
```

The collision is detected by a concept refusing, not by a check someone
remembered to write, and the incumbent is unaffected: `claim` is the only way in
and it refuses the second caller whoever that is. A page re-claiming the address
it already holds succeeds and reports no change, which is what makes a second job
harmless.

## 4.6 Excerpt phase

```ts
export const ExcerptsConvert = reaction(({ page, body, dialect }) =>
  when(Phasing.advance({}).responds({ phase: "excerpt" }))
    .where(
      Routing._claims().is({ owner: page }),
      Documenting._document({ subject: page }).is({ body }),
      theMarkupOf({ page }).is({ dialect }),
    )
    .then(Converting.convert({ subject: page, part: "excerpt", dialect, source: body })),
);
```

One reaction, and it is the whole excerpt feature. It converts the authored body,
before any templating, which is what keeps collections and rendering independent.

## 4.7 Collect phase

The card is built by `Composing`, one fact at a time, and the collection is
joined on the last set.

```ts
export const CardsCompose = reaction(({ page, data, url, path, excerpt }) =>
  when(Phasing.advance({}).responds({ phase: "collect" }))
    .where(
      Routing._address({ owner: page }).is({ url }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Filing._file({ file: page }).is({ path }),
      whether(Converting._for({ subject: page, part: "excerpt" }).is({ excerpt })),
    )
    .then(Composing.clear({ subject: page, part: "card" }).responds({}))
    .then(Composing.set({ subject: page, part: "card", key: "data", value: data, raw: false }).responds({}))
    .then(Composing.set({ subject: page, part: "card", key: "url", value: url, raw: false }).responds({}))
    .then(Composing.set({ subject: page, part: "card", key: "excerpt", value: excerpt, raw: true }).responds({}))
    .then(Composing.set({ subject: page, part: "card", key: "source.path", value: path, raw: false })),
);

export const PagesJoinCollections = reaction(
  ({ page, path, card, collection, name, glob, sortKey, key }) =>
    when(Composing.set({ subject: page, part: "card", key: "source.path" }).responds({}))
      .where(
        Filing._file({ file: page }).is({ path }),
        Composing._record({ subject: page, part: "card" }).is({ values: card }),
        Collecting._collections().is({ collection, name }),
        theRuleOf({ name }).is({ glob, sortKey }),
        Matching._matches({ pattern: glob, path }).is({ matched: true }),
        whether(Layering._value({ subject: page, key: sortKey }).is({ value: key })),
      )
      .then(
        where(collectionHasNoFilter({ name }))
          .then(Collecting.include({ collection, item: page, key, tiebreak: path, card }))
          .named("unfiltered"),
        where(pageMatchesEquality({ page, name }))
          .then(Collecting.include({ collection, item: page, key, tiebreak: path, card }))
          .named("equals"),
        where(pageMatchesContainment({ page, name }))
          .then(Collecting.include({ collection, item: page, key, tiebreak: path, card }))
          .named("contains"),
        where(pageMatchesPresence({ page, name }))
          .then(Collecting.include({ collection, item: page, key, tiebreak: path, card }))
          .named("present"),
      ),
);

export const theFilterOf = view("the filter of collection (name)", ({ name }, { filter }, { root, node, rule }) =>
  where(
    Configuring._active().is({ root }),
    Configuring._child({ node: root, key: "collections" }).is({ child: node }),
    Configuring._child({ node, key: name }).is({ child: rule }),
    Configuring._child({ node: rule, key: "where" }).is({ child: filter }),
  ),
).optional();

export const collectionHasNoFilter = view("collection (name) has no filter", ({ name }, _o, _b) =>
  where(no(theFilterOf({ name }))),
).holds();

export const pageMatchesEquality = view(
  "(page) matches the equality filter of (name)",
  ({ page, name }, _o, { filter, field, value }) =>
    where(
      theFilterOf({ name }).is({ filter }),
      Configuring._child({ node: filter, key: "field" }).is({ value: field }),
      Configuring._child({ node: filter, key: "equals" }).is({ value }),
      Layering._holds({ subject: page, key: field, value }).is({ equal: true }),
    ),
).holds();
```

`pageMatchesContainment` reads `contains` and tests `contains: true`;
`pageMatchesPresence` reads `exists` and tests `present: true`.

Three things are worth noticing.

**The card is finished before it is used.** `PagesJoinCollections` triggers on
the last `Composing.set` of the card chain rather than on the phase, so the
record it reads is complete. Building in a chain and triggering the consumer on
the last link is the general shape used wherever the composition assembles a
value and then passes it, because a `where` block reads state as it was when the
reaction was evaluated.

**The sort field is a value, not a name.**
`Layering._value({ subject: page, key: sortKey })` reads a key bound from
configuration, so arbitrary metadata can be sorted on without any concept knowing
the field. It is read under `whether`, so a page missing the field is still
included and `Collecting` sorts it last.

**The filter operators are the branches.** Each is one view and one labelled
sibling, and the set is exactly what `Layering._holds` exposes. Adding an
operator adds a view and a sibling and changes no concept.

## 4.8 Render phase

Rendering begins for every routed page whose result is not current — on a first
build that is every page, on a rebuild exactly the stale ones. Both take the same
path.

```ts
export const RenderBegins = reaction(({ page }) =>
  when(Phasing.advance({}).responds({ phase: "render" }))
    .where(Routing._claims().is({ owner: page }), no(Depending._current({ subject: page })))
    .then(Depending.begin({ subject: page })),
);

export const RenderPrepares = reaction(({ page, path, data, url, site, catalog, settings }) =>
  when(Depending.begin({ subject: page }).responds({}))
    .where(
      Filing._file({ file: page }).is({ path }),
      Layering._resolved({ subject: page }).is({ values: data }),
      Routing._address({ owner: page }).is({ url }),
      theSiteRecord().is({ values: site }),
      Collecting._catalog().is({ collections: catalog }),
      theSettingsFile().is({ file: settings }),
    )
    .then(Emitting.begin({ producer: page }).responds({}))
    .then(Diagnosing.retract({ source: path }).responds({}))
    .then(Depending.use({ subject: page, input: page }).responds({}))
    .then(Depending.use({ subject: page, input: settings }).responds({}))
    .then(Composing.clear({ subject: page, part: "context" }).responds({}))
    .then(Composing.set({ subject: page, part: "context", key: "site", value: site, raw: false }).responds({}))
    .then(Composing.set({ subject: page, part: "context", key: "collections", value: catalog, raw: false }).responds({}))
    .then(Composing.set({ subject: page, part: "context", key: "page.data", value: data, raw: false }).responds({}))
    .then(Composing.set({ subject: page, part: "context", key: "page.url", value: url, raw: false }).responds({}))
    .then(Composing.set({ subject: page, part: "context", key: "page.source.path", value: path, raw: false })),
);

export const BodyFills = reaction(({ page, body, context, raw }) =>
  when(Composing.set({ subject: page, part: "context", key: "page.source.path" }).responds({}))
    .where(
      Documenting._document({ subject: page }).is({ body }),
      Composing._record({ subject: page, part: "context" }).is({ values: context, raw }),
    )
    .then(Templating.fill({ subject: page, source: body, context, raw })),
);

export const FilledBodyConverts = reaction(({ page, output, dialect }) =>
  when(Templating.fill({ subject: page }).responds({ output }))
    .where(theMarkupOf({ page }).is({ dialect }))
    .then(Converting.convert({ subject: page, part: "body", dialect, source: output })),
);

export const ConvertedBodyScans = reaction(({ page, output }) =>
  when(Converting.convert({ subject: page, part: "body" }).responds({ output }))
    .then(Referencing.scan({ subject: page, part: "body", text: output })),
);
```

Opening an emit attempt is the first link of the render chain. A page's previous
outputs stay in place while it recomputes and are dropped only when the new
attempt commits, so a page that fails to render keeps serving what it last
produced, and a page that stops producing a file loses that file at commit.

Dependencies are recorded as they are used:

```ts
export const BodyInputsRecord = reaction(({ page, filling, used, template }) =>
  when(Templating.fill({ subject: page }).responds({ filling }))
    .where(
      Templating._tree({ owner: filling }).is({ used }),
      Templating._template({ name: used }).is({ template }),
    )
    .then(Depending.use({ subject: page, input: template })),
);

export const BodyCollectionsRecord = reaction(({ page, filling, member, collection }) =>
  when(Templating.fill({ subject: page }).responds({ filling }))
    .where(
      Templating._reads({ owner: filling }).is({ root: "collections", member }),
      Collecting._named({ name: member }).is({ collection }),
    )
    .then(Depending.use({ subject: page, input: collection })),
);
```

with three matching reactions for the layout, which read `_tree` and `_reads` on
the rendered template and record the template itself.

`_reads` being split into a root and a member is what makes this precise: a page
depends on the collections its templates actually mention, not on every
collection that exists. No reaction can take a string apart, so the split has to
exist in the concept.

## 4.9 First reference pass — resolution

The body's references are resolved against the project. Every reaction here
dispatches on the reference's `kind`, the classification of its raw target, and
the target's class, so **no two of them can answer the same reference**. That
disjointness is required: two answers to one reference would let the gate in 4.11
fire twice.

```ts
export const InternalLinksAnswer = reaction(({ source, page, reference, raw, target, address }) =>
  when(Referencing.scan({ part: "body" }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: page }),
      Referencing._references({ source }).is({ reference, raw, kind: "link" }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
      Filing._resolve({ file: page, address: raw }).is({ target }),
      Routing._address({ owner: target }).is({ address }),
    )
    .then(
      Referencing.answer({ reference, form: "address", value: address }).named("answer"),
      Depending.use({ subject: page, input: target }).named("input"),
    ),
);

export const DownloadsCopy = reaction(
  ({ source, page, reference, raw, target, leaf, content, medium, folder, path, address }) =>
    when(Referencing.scan({ part: "body" }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ reference, raw, kind: "link" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        Filing._file({ file: target }).is({ name: leaf, content }),
        Filing._medium({ path: leaf }).is({ medium }),
        theOutputFolderOf({ page }).is({ folder }),
        Filing._join({ prefix: folder, name: leaf }).is({ path }),
        Routing._locate({ path }).is({ address }),
      )
      .then(Emitting.intend({ producer: page, path, content, medium }).responds({}))
      .then(
        Referencing.answer({ reference, form: "address", value: address }).named("answer"),
        Depending.use({ subject: page, input: target }).named("input"),
      ),
);

export const BodyAbsoluteReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: "body" }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "absolute" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

export const BrokenReferencesReport = reaction(({ source, page, path, reference, raw, line, column }) =>
  when(Referencing.scan({ part: "body" }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: page }),
      Referencing._references({ source }).is({ reference, raw, line, column }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
      no(Filing._resolve({ file: page, address: raw })),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      where(theJobIsStrict())
        .then(
          Diagnosing.report({
            severity: "error",
            code: "MISSING_LOCAL_ASSET",
            message: "This reference names no file.",
            source: path,
            line,
            column,
          }),
        )
        .named("strict"),
      where(theJobIsLenient())
        .then(
          Diagnosing.report({
            severity: "warning",
            code: "MISSING_LOCAL_ASSET",
            message: "This reference names no file.",
            source: path,
            line,
            column,
          }).responds({}),
        )
        .then(Referencing.answer({ reference, form: "address", value: raw }))
        .named("lenient"),
    ),
);
```

`BodyAbsoluteReferencesHold` answers a site-absolute reference **with itself**. It
looks like a no-op and is essential: the gate is "every reference has an answer",
so a reference nobody needs to change still has to be answered. Its twins do the
same for external targets and fragments.

`BrokenReferencesReport` is where severity and emission are decided together. In
a strict job the reference stays unanswered, the page never finishes, and nothing
is emitted for it. In a lenient job the reference is answered with its raw text,
so the page renders with a broken link and a warning.

## 4.10 Images

One chain per image reference: admit, render the whole rendition set, declare the
embedding with the count it must expect.

```ts
export const ImagesEmbed = reaction(
  ({ source, page, reference, raw, label, target, content, widths, formats, original, width, height, count }) =>
    when(Referencing.scan({ part: "body" }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ reference, raw, kind: "image", label }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        fileIsARasterImage({ file: target }),
        Filing._file({ file: target }).is({ content }),
        theImageSettings().is({ widths, formats }),
      )
      .then(Depending.use({ subject: page, input: target }).responds({}))
      .then(Transcoding.admit({ subject: target, content }).responds({ original, width, height }))
      .then(Transcoding.render({ original, widths, formats }).responds({ count }))
      .then(Embedding.declare({ subject: reference, alternative: label, width, height, expects: count })),
);

export const RenditionsEmit = reaction(
  ({ reference, page, original, rendition, leaf, content, medium, folder, path }) =>
    when(Embedding.declare({ subject: reference }).responds({}))
      .where(
        theImageOfReference({ reference }).is({ original, page }),
        Transcoding._renditions({ original }).is({ rendition, name: leaf, content, medium }),
        theAssetFolder().is({ folder }),
        Filing._join({ prefix: folder, name: leaf }).is({ path }),
      )
      .then(Emitting.intend({ producer: page, path, content, medium })),
);

export const RenditionsOffer = reaction(
  ({ reference, embedding, original, rendition, leaf, width, format, order, folder, path, address }) =>
    when(Embedding.declare({ subject: reference }).responds({ embedding }))
      .where(
        theImageOfReference({ reference }).is({ original }),
        Transcoding._renditions({ original }).is({ rendition, width, format, order, name: leaf }),
        theAssetFolder().is({ folder }),
        Filing._join({ prefix: folder, name: leaf }).is({ path }),
        Routing._locate({ path }).is({ address }),
      )
      .then(Embedding.offer({ embedding, address, format, width, order })),
);

export const EmbeddingsAnswer = reaction(({ embedding, reference, markup }) =>
  when(Embedding.offer({ embedding }).responds({}))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Embedding._markup({ embedding }).is({ markup }),
    )
    .then(Referencing.answer({ reference, form: "markup", value: markup })),
);
```

`_markup` is absent until the promised number of renditions has arrived, so
`EmbeddingsAnswer` fires once, on the last offer, with complete markup.

Renditions are intended by the **page**, not by the rendition. Two pages
referencing one image intend the same path with the same bytes, which `Emitting`
permits, and a page that stops referencing it drops its own intent when its next
attempt commits. Making the rendition its own producer would leave orphaned files
that nothing is responsible for.

A vector image, or a raster image reached through a `link` rather than an
`image`, falls to `DownloadsCopy`. The guards are `kind` and `fileIsARasterImage`
with its twin, so every reference lands in exactly one reaction.

## 4.11 The gate, the layout, and the rebasing pass

```ts
export const BodyFinishesOnScan = reaction(({ page, text }) =>
  when(Referencing.scan({ subject: page, part: "body" }).responds({}))
    .where(Referencing._finished({ subject: page, part: "body" }).is({ text }))
    .then(Composing.set({ subject: page, part: "context", key: "page.content", value: text, raw: true })),
);

export const BodyFinishesOnAnswer = reaction(({ page, text }) =>
  when(Referencing.answer({}).responds({ subject: page, part: "body" }))
    .where(Referencing._finished({ subject: page, part: "body" }).is({ text }))
    .then(Composing.set({ subject: page, part: "context", key: "page.content", value: text, raw: true })),
);

export const LayoutRenders = reaction(({ page, layout, context, raw }) =>
  when(Composing.set({ subject: page, part: "context", key: "page.content" }).responds({}))
    .where(
      theLayoutOf({ page }).is({ template: layout }),
      Composing._record({ subject: page, part: "context" }).is({ values: context, raw }),
    )
    .then(Templating.render({ template: layout, subject: page, context, raw })),
);

export const MissingLayoutReports = reaction(({ page, path }) =>
  when(Composing.set({ subject: page, part: "context", key: "page.content" }).responds({}))
    .where(no(theLayoutOf({ page })), Filing._file({ file: page }).is({ path }))
    .then(
      Diagnosing.report({
        severity: "error",
        code: "TEMPLATE_NOT_FOUND",
        message: "This page resolves no template.",
        source: path,
      }),
    ),
);

export const LayoutScans = reaction(({ page, output }) =>
  when(Templating.render({ subject: page }).responds({ output }))
    .then(Referencing.scan({ subject: page, part: "layout", text: output })),
);

export const LayoutReferencesRebase = reaction(({ source, reference, raw, url }) =>
  when(Referencing.scan({ part: "layout" }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "absolute" }),
      Routing._url({ target: raw }).is({ url }),
    )
    .then(Referencing.answer({ reference, form: "address", value: url })),
);
```

Two triggers, one continuation: a page with no references proceeds on its scan, a
page with references on the answer that completes the set. Since `_finished` is
absent in every other case, the continuation fires exactly once. `raw: true` on
`page.content` is the only place in the design where escaping is suppressed, and
it is suppressed for a value a concept produced.

**The two passes have different jobs, and that is what makes the base path
correct.** The first resolves references to site-absolute addresses and never
applies the base. The second applies the base once, to the finished document —
including to the addresses the first pass installed and to the `srcset` entries
inside generated image markup. Its twins answer external targets and fragments
with themselves, and a relative reference surviving into a layout is reported,
because a template has no source directory to resolve against.

## 4.12 Emit phase

```ts
export const PageEmitsOnAnswer = reaction(({ page, text, address, path }) =>
  when(Referencing.answer({}).responds({ subject: page, part: "layout" }))
    .where(
      Referencing._finished({ subject: page, part: "layout" }).is({ text }),
      Routing._address({ owner: page }).is({ address }),
      Routing._file({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer: page, path, content: text, medium: "text/html" }).responds({}))
    .then(Emitting.commit({ producer: page }).responds({}))
    .then(Depending.settle({ subject: page })),
);

export const StrictJobReconciles = reaction(() =>
  when(Phasing.advance({}).responds({ phase: "emit", mode: "once" }))
    .where(Diagnosing._clean().is({ clean: true }))
    .then(Emitting.reconcile()),
);

export const StrictJobFails = reaction(({ job }) =>
  when(Phasing.advance({ job }).responds({ phase: "emit", mode: "once" }))
    .where(Diagnosing._clean().is({ clean: false }))
    .then(Phasing.abandon({ job, reason: "diagnostics" })),
);

export const LiveJobReconciles = reaction(() =>
  when(Phasing.advance({}).responds({ phase: "emit", mode: "live" })).then(Emitting.reconcile()),
);

export const GitHubPagesMarker = reaction(({ root, settings }) =>
  when(Phasing.advance({}).responds({ phase: "emit" }))
    .where(
      Configuring._active().is({ root }),
      Configuring._scalar({ node: root, key: "deploy.nojekyll", otherwise: false }).is({ value: true }),
      theSettingsFile().is({ file: settings }),
    )
    .then(Emitting.intend({ producer: settings, path: ".nojekyll", content: "", medium: "text/plain" })),
);
```

with the `…OnScan` twin of `PageEmitsOnAnswer`, for a layout that introduced no
references at all.

Three reactions carry the whole difference between production and development
behavior. A strict job stops on an error and writes nothing. A lenient job
reconciles what it has, leaving the last valid output of every unaffected page in
place, because `reconcile` only rewrites what changed and only removes what is no
longer intended. There is no second rendering model because there is no second
path.

## 4.13 Failures

Every refusal that can reach an author becomes a diagnostic. They share one
shape; two stand for the rest.

```ts
export const MalformedAttributesReport = reaction(({ subject, path, message }) =>
  when(Documenting.parse({ subject }).refuses({ refusal: "MALFORMED_ATTRIBUTES", message }))
    .where(Filing._file({ file: subject }).is({ path }))
    .then(
      Diagnosing.report({ severity: "error", code: "MALFORMED_ATTRIBUTES", message, source: path, line: 1 }),
    ),
);

export const TemplateFailureReports = reaction(({ page, path, refusal, message }) =>
  when(Templating.render({ subject: page }).refuses({ refusal, message }))
    .where(Filing._file({ file: page }).is({ path }))
    .then(Diagnosing.report({ severity: "error", code: refusal, message, source: path })),
);
```

with the same for `Templating.fill`, `Converting.convert`, `Matching.compile`,
`Configuring.load`, and `Emitting.intend` — whose `PATH_CONTESTED` refusal is the
output-collision diagnostic, reported against both producers' paths.

A page whose render was refused never settles. It stays *building*, which is why
`Depending.touch` invalidates building results as well as current ones: when the
author fixes the file, the next job finds the page not current and renders it
again. Its previous output survives in the meantime, because its emit attempt was
never committed.

Diagnostics attached to a page's source are retracted when that page's render
begins, so every check that can attach a diagnostic to a page's source runs
inside that page's render chain. Parse failures are the exception and need none:
a page that fails to parse never gets a document, never routes, and never renders.

## 4.14 What a change costs

Every reaction above serves both the first build and every rebuild. A change is
not a special path; it is the same path with fewer stale pages.

| Edit | What re-derives | What re-renders |
| --- | --- | --- |
| A post's body | that document, its layers | that post, plus listings if its card changed |
| A post's front matter | that document, its layers, its card | that post, plus every page reading a collection whose listing changed |
| `post.html` | that template | every page whose layout tree reaches it |
| `includes/header.html` | that template | every page whose layout tree reaches it, transitively |
| An image | its renditions | every page that referenced it |
| A public file | its intent | nothing |
| `site.yaml` | settings, collections, every page's layers | every page, since every page records the settings file as an input |
| A new post | its document, layers, route, card | itself, plus readers of the collections it joined |
| A deleted post | nothing | readers of the collections it left; its outputs go at reconciliation |

---

# Part 5 · Inspection

`site inspect` needs no new state. Every question it asks is a read across
concepts, which is what formers are for.

```ts
export const thePageReport = former(
  "the page report (page)",
  ({ page }, { path, address, url, layout, rank, values, name, input, output, reason, code, message, line }) =>
    where(
      Filing._file({ file: page }).is({ path }),
      whether(Routing._address({ owner: page }).is({ address, url })),
      whether(theLayoutName({ page }).is({ name: layout })),
      whether(Depending._reason({ subject: page }).is({ reason })),
    ).form({
      page,
      path,
      address,
      url,
      layout,
      rebuiltBecause: reason,
      defaults: each(Layering._layers({ subject: page }).is({ rank, values })).form({ rank, values }),
      collections: each(Collecting._membership({ item: page }).is({ name })).form({ name }),
      inputs: each(Depending._uses({ subject: page }).is({ input })).form({ input }),
      outputs: each(Emitting._byProducer({ producer: page }).is({ path: output })).form({ output }),
      problems: each(Diagnosing._for({ source: path }).is({ code, message, line })).form({
        code,
        message,
        line,
      }),
    }),
);

export const theRouteReport = former("the route report (address)", ({ address }, { owner, path }) =>
  where(
    Routing._owner({ address }).is({ owner }),
    Filing._file({ file: owner }).is({ path }),
  ).form({ address, owner, path }),
).optional();

export const theOutputReport = former("the output report (path)", ({ path }, { producer, digest, medium }) =>
  where(Emitting._intent({ path }).is({ digest, medium })).form({
    path,
    digest,
    medium,
    producers: each(Emitting._producers({ path }).is({ producer })).form({ producer }),
  }),
).optional();

export const theBuildReport = former(
  "the build report (job)",
  ({ job }, { phase, state, mode, subject, reason, severity, code, message, source, line }) =>
    where(Phasing._job({ job }).is({ phase, state, mode })).form({
      job,
      phase,
      state,
      mode,
      stale: each(Depending._stale().is({ subject, reason })).form({ subject, reason }),
      problems: each(Diagnosing._all().is({ severity, code, message, source, line })).form({
        severity,
        code,
        message,
        source,
        line,
      }),
    }),
);
```

Between them these answer every question `site inspect` is asked, because each
concept already had to keep that fact in order to do its own job. Nothing in the
model exists for inspection alone.

---

# Part 6 · The boundary

Six endpoints. The commands are host programs over them, so `site build`,
`site build --watch`, `site dev`, and `site inspect` can be renamed without
touching a concept or a reaction.

```ts
export const OpenRoot = endpoint("/source/root", ({ name, root }) =>
  receive({ name }).then(Filing.open({ name }).responds({ root })).then(respond({ root })),
);

export const PlaceSource = endpoint("/source/place", ({ root, path, content, file, changed }) =>
  receive({ root, path, content })
    .then(Filing.place({ root, path, content }).responds({ file, changed }))
    .then(respond({ file, changed })),
);

export const RemoveSource = endpoint("/source/remove", ({ root, path, file }) =>
  receive({ root, path })
    .where(Filing._at({ root, path }).is({ file }))
    .then(Filing.discard({ file }).responds({}))
    .then(respond({ file })),
);

export const StartJob = endpoint("/job/start", ({ mode, sequence, job, phase }) =>
  receive({ mode })
    .then(
      Phasing.declare({
        name: "build",
        phases: ["ready", "settings", "read", "route", "excerpt", "collect", "render", "emit"],
      }).responds({ sequence }),
    )
    .then(Phasing.start({ sequence, mode }).responds({ job, phase }))
    .then(respond({ job, phase })),
);

export const AdvanceJob = endpoint("/job/advance", ({ job, phase }) =>
  receive({ job }).then(Phasing.advance({ job }).responds({ phase })).then(respond({ phase })),
);

export const InspectPage = endpoint("/inspect/page", ({ page }) =>
  receive({ page }).then(respond({ report: thePageReport({ page }) })),
);
```

The host programs are short:

- **`site build`** — open the four roots, place every file, start a job in `once`
  mode, advance it once per phase, and read the build report. Exit non-zero if
  the job was abandoned.
- **`site build --watch`** — the same, then for each change the watcher reports,
  place or remove the file and run another job.
- **`site dev`** — watch, plus an HTTP server over the destination directory. It
  serves files, so an unaffected page keeps serving its last valid output for
  free, and reload is triggered by watching the destination: the host already
  knows what it wrote.
- **`site inspect`** — one call, printed.

Two obligations fall on the host, and they are the only things the model does not
enforce itself.

**The host drains between advances.** A phase is a barrier only because the host
waits for the previous phase's work to settle before asking for the next.

**The host opens roots under fixed names.** Root names — `project`, `content`,
`templates`, `public` — are composition vocabulary, while the directories they
stand for are configuration. The host places `site.yaml` in the `project` root
first, reads the resolved paths from a completed settings phase, and opens the
other roots under their fixed names pointing at the configured directories. The
circularity the product would otherwise have — configuration lives in a
directory, directories come from configuration — is cut in the host, where it
belongs, rather than inside a concept.

---

# Part 7 · Determinism

Each thing a build must not depend on is prevented structurally rather than by
convention.

| Must not depend on | Why it cannot |
| --- | --- |
| Filesystem enumeration order | `Filing._under` answers in ascending byte order of path; nothing else enumerates files |
| Reaction order | Defaults merge by declared **rank**; collection order is by key then tie-break; `Emitting` reconciles a set; `Composing` is keyed |
| Reaction registration order | No reaction depends on another having fired. Every ordering is a chain on a returned action, an `optional` query absent until ready, or a phase barrier |
| Concurrent completion order | Both gates are absent until complete, so which action completes them is decided by the data |
| Last-writer-wins | `Routing.claim` refuses a second owner; `Emitting.intend` refuses a disagreement. No action overwrites another producer's work |
| Random identifiers | Rendition names come from a content digest and declared settings; output paths come from addresses |
| Current time | No concept reads a clock. A `date` in front matter is authored data |
| Undeclared environment | No concept reads the environment. `Configuring.load` is the only way settings enter |

Two orderings are fixed inside concepts and are therefore testable in one place:
`Collecting` fixes how missing and mixed-kind sort keys compare, and `Diagnosing`
fixes the order a run reports its problems in. A build that fails twice fails
identically.

The rule to apply when extending this design: **any new reaction that writes
state must be keyed, ranked, or chained.** A reaction that appends to an
unordered set, or that relies on having fired before another, breaks the property
everything above preserves.

---

# Part 8 · Limits

**Phase completion is not a concept.** `Phasing` announces a phase; nothing in
the model knows when a phase's work is finished, so the host advances after
draining. The alternatives cost more: a concept tracking outstanding work per
phase, which every reaction must remember to report to; or removing phases by
making each stage trigger on its own predecessor per page, which is elegant for
rendering but cannot express the three genuinely global barriers.

**Two concepts are only almost generic.** `Referencing` knows that texts contain
addresses at positions, and `Embedding` knows how to write a responsive image
element. Both are recognizable outside this product — link rewriting and content
negotiation appear in mail clients, feed readers, and document converters — but
both carry markup knowledge a purist would place elsewhere. Reactions cannot
manipulate strings, so that knowledge would otherwise land in a less appropriate
concept.

**Four reactions exist in pairs.** Every gate needs one reaction triggered by
`scan` and one by `answer`, with identical consequences, because a reaction has
one trigger and the language has no disjunction.

**Assembling a value takes a chain.** Building a nested context from five
concepts is a chain of `Composing.set` stages whose consumer is a second reaction
triggered by the last of them. It is explicit and order-independent, and it is
the least pleasant thing in the composition to read. If a former could be read in
a reaction's `where`, most of it would collapse to one line.

**Dependency granularity is the page.** A change to any input re-renders a whole
page rather than the part that used it. `Templating._reads` narrows the
collection case; nothing narrows the others.

**Every page depends on `site.yaml`.** A one-character change to a comment there
rebuilds the whole site. Making that precise would mean recording which settings
a page read, which means routing every configuration read through something that
can attribute it.

**Derivation is unconditional.** Every job re-parses every document and
re-defines every template. Derivation is a pure function of file content and is
cheap next to rendering, and doing it unconditionally removes a class of
staleness bugs — but on a very large site it is measurable, and a digest guard on
`Documenting.parse` is the first optimization to reach for.

**`Configuring` may want splitting.** It holds both a document tree and the
notion of the active configuration. With a second notation or a second source,
"a parsed document tree" is one concept and "which one is current" is another.

---

# Part 9 · Extension

Each deferred feature is a small number of reactions over the concepts already
present, with at most one new concept.

| Feature | What it needs |
| --- | --- |
| Feeds, sitemaps | A reaction at the emit phase: read `Collecting._items`, fill a template, `Emitting.intend`. No new concept |
| Pagination | One new concept — `Paging`: split an ordered set into numbered pages with neighbours — plus reactions claiming a route per page |
| Redirects | Reactions only: `Routing.claim` for the old address, `Emitting.intend` of a redirect document |
| Search indexing | A reaction collecting `Converting._for` output into one intended output |
| Internationalization | A locale is a rank dimension in `Layering` and a prefix in `Routing`; probably one concept for negotiation |
| Art direction | `Embedding` grows an offer condition, `Transcoding` grows a crop; both within their existing purposes |
| Remote content sources | A host that places files into a `Filing` root. Nothing in the build changes |
| Multiple output targets | A second `Emitting` destination, or a second assembly |
| Third-party plugins | A concept plus reactions, registered at assembly |

The features that would genuinely disturb this design are the ones the product
also rules out: server-side rendering and API routes, which would stop the output
tree from being the product; and arbitrary code in configuration, which would put
an interpreter inside `Configuring` and end its independence.

---

# Appendix · Language constructs used

| Construct | Where | Rule relied on |
| --- | --- | --- |
| `when(A.act(pattern).responds(result))` | every reaction | Watches the returned outcome; the call pattern binds inputs, the response pattern binds outputs |
| `when(A.act(pattern).refuses({ refusal, message }))` | every diagnostic reaction | Refused payloads expose `refusal` and may expose `message` |
| Literal in a call or response pattern | `phase: "render"`, `changed: true`, `kind: "link"` | A literal tests; a fresh symbol binds |
| Reusing a bound name in `.is` | comparing a claim's owner | Reusing a symbol tests equality; no equality word exists |
| Bare call with empty `.is` | `Routing._address({ owner: page })` as a guard | An empty `.is` is an existence read |
| `no(line)` | `no(Depending._current(...))`, `no(Routing._address(...))`, `no(Filing._resolve(...))`, `no(theFilterOf(...))`, `no(theLayoutOf(...))` | Holds only when no row exists at all; usable only over `optional` and `many` relations; admits no fresh names |
| Literal test instead of `no` | `matched: false` on `Matching._matches` | A `one` relation always supplies a row, so a denial over it can never hold |
| `whether(line)` | the optional excerpt, the optional sort key, report formers | Absence passes the case on with blank names |
| Query promises | every `where` line | `one` always supplies, `optional` may drop, `many` fans out once per row |
| Views in `where` | every policy question | A `where` line reads one relation: a concept query or a view |
| Labelled sibling groups | removal, settings, filter operators, broken references | Every matching sibling runs; labels give path names, not priority; a multi-member group requires one label per sibling |
| Chained `.then` | every ordered sequence | A later group extends each path after that path's action returns, pinned to the preceding ask |
| Zero-input queries | `Documenting._all()`, `Collecting._catalog()`, `Diagnosing._clean()`, `Phasing._running()`, `Configuring._active()` | A query may take no parameter |
| Record-valued query outputs and action inputs | contexts, cards, resolved layers | Values are values; the container check accepts any non-null, non-array object |
| Query memoization | both gates | Instrumented actions invalidate the acted-on concept's caches before and after, so a same-concept read after a same-concept action sees new state |
| Formers at endpoints | the reports | `respond({ report: aFormer({ input }) })` |
| `each(...)` and `.form(...)` in formers | the reports | Record entries may capture rows |

Every binding a reaction opens is read by a later line or a consequence;
registration rejects names opened and never used.

Two constructs are deliberately not used, and the design would be simpler with
them: reading a former inside a reaction's `where`, which would collapse the
context-building chains; and disjunction in a trigger, which would halve the
paired reactions.
