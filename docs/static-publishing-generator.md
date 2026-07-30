# Syncpress Static Publishing Generator

**A deterministic static publisher composed from independently specified
sync-engine concepts and explicit reactions.**

This document defines the intended Syncpress product, records what the current
batch implementation delivers, and makes the remaining delivery work explicit.
It deliberately does not duplicate individual concept action/query contracts.

## Contract Authority

The current concept specifications in `src/concepts/*/spec.md` and the generated
assembly read-back in `generated/syncpress.md` are authoritative for low-level
behavior. If this document conflicts with them, those sources win. In particular,
current composition code uses path arrays, conversion profiles, and
`Templating.trusted`; it does not use the historical dotted-key, dialect, `raw`,
or `Filing._medium` APIs.

## Status Legend

- **Implemented**: available through the product surface and covered by focused
  or composition-level verification.
- **Out of scope**: intentionally not a Syncpress feature.

## 1. Product Contract

Syncpress reads a local project directory and emits an ordinary directory of
static files. The result has no server-side runtime requirement and can deploy to
any static host.

It is intended for documentation, blogs, portfolios, small publications, and
content-oriented sites. Authors work with ordinary files, YAML, Markdown, HTML,
and Liquid. Project configuration never executes author-supplied code.

### Product Principles

- **Declarative projects.** YAML declares project policy. Liquid is the only
  authoring language evaluated during a build.
- **Ordinary files.** Content, layouts, local assets, and public files remain
  inspectable on disk without a database or proprietary editor.
- **Minimal reserved vocabulary.** Front matter is author data. Syncpress
  controls live under `build`; fields such as `tags`, `author`, and `featured`
  have no inherent meaning.
- **Relative references.** Pages can refer to neighboring images and downloads
  with ordinary relative paths.
- **Explicit composition.** Defaults, collections, routes, templates, and
  output behavior are declared rather than inferred from field names.
- **Deterministic output.** Equal declared input bytes and configuration produce
  equal output bytes, independent of filesystem enumeration, reaction order,
  process scheduling, clocks, random identifiers, or undeclared environment
  values.
- **Safe publication.** A failed strict build must not partially replace a prior
  reconciled output tree.

### Non-goals

The following are out of scope:

- Server-side rendering, API routes, databases, authentication, sessions, or
  background jobs.
- Remote content synchronization and remote build inputs.
- Arbitrary JavaScript or other executable configuration.
- A third-party plugin platform.

## 2. Build Surface And Project Boundary

### Commands

```sh
bun run site build [site-directory] [output-directory]
bun run site build --watch [site-directory] [output-directory]
bun run site dev [--port 3000] [site-directory] [output-directory]
bun run site inspect <page-or-route> [site-directory]
```

`<output-directory>` is resolved relative to `<site-directory>`. When omitted,
`paths.output` selects it and defaults to `dist`. A strict invocation creates a
fresh application model, stages the project deterministically, drives a batch
build, and reconciles only after all routed and generated pages settle without an
error diagnostic.

Current control endpoints are intentionally narrow:

- `/site/configure` loads `site.yaml`, directs the output destination, and
  declares the build phase sequence.
- `/site/reconcile` publishes only a finished, clean, fully settled build.

`build --watch` retains the last reconciled output on a failed rebuild. `dev`
serves that output and sends an EventSource reload after a successful rebuild.
`inspect` uses an isolated in-memory application and reports current provenance
without replacing the configured output tree.

### Project Layout

The default project layout is:

```text
site/
├── site.yaml
├── content/
│   ├── index.md
│   ├── about.md
│   └── posts/
│       └── first.md
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

The host currently requires `site.yaml`, `content/`, `templates/`, and `public/`
to exist. It rejects symbolic links, non-regular source entries, configured roots
or configured output that resolve outside the project, output/input overlap, and
duplicate logical Liquid template names. An explicit output destination may be
outside the project.

`example/` is the executable source project in this repository. Its full output
tree is golden by SHA-256 in `tests/golden/example-site.json`.

## 3. Configuration

`site.yaml` is strict YAML and must contain one normalized YAML document.
Configuration controls generator policy; values below `site` remain author data
for templates except where specifically documented.

### Configuration Shape

```yaml
site:
  title: Ada's Notes
  origin: https://example.com
  basePath: /
  owner: Ada
  navigation:
    - { label: Home, url: / }

paths:
  content: content
  templates: templates
  public: public
  assets: assets
  output: dist

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

deploy:
  nojekyll: false
  requireNotFound: true
  sitemap: true
  feed:
    collection: posts
    path: feed.xml
  redirects:
    /old-notes/: /notes/
  pagination:
    archive:
      collection: posts
      perPage: 10
      route: /archive/:page/
      template: page.html
```

### Current Configuration Behavior

| Setting | Current behavior | Status |
| --- | --- | --- |
| `site` | Available to Liquid as `site`; `site.basePath` is projected onto final site-absolute references. | Implemented |
| `paths.content` | Project-relative source directory; default `content`. | Implemented |
| `paths.templates` | Project-relative layouts/includes directory; default `templates`. | Implemented |
| `paths.public` | Project-relative copied-file directory; default `public`. | Implemented |
| `paths.assets` | Portable relative output prefix for derived image renditions; default `assets`. | Implemented |
| `paths.output` | Project-relative default destination; defaults to `dist`, and an explicit CLI destination overrides it. | Implemented |
| `defaults` | Ordered glob rules whose mappings merge by rank; page front matter wins. | Implemented |
| `collections` | Named `match`, `sort`, and `where` rules. | Implemented |
| `images` | Widths and formats used for local primary raster images. | Implemented |
| `markdown` | Extensions, raw HTML handling, and excerpt separator. The current default separator is empty. | Implemented |
| `deploy` | `.nojekyll`, required authored 404s, sitemap, Atom feed, static redirects, and generated collection pagination. | Implemented |

Defaults apply in written order. Mappings merge recursively; scalars and
sequences replace earlier values. The host validates the product-owned schema
before staging source files, accumulates independent errors, and reports their
`site.yaml` line and column. Unknown top-level, `paths`, and `deploy` settings
are rejected; arbitrary values below `site` and `defaults.*.values` remain
author data.

## 4. Content And Front Matter

Only `**/*.md` and `**/*.html` under the configured content root become page
documents. Other content-root files are local assets and are emitted only when a
page references them.

### Front Matter

Front matter is an optional strict YAML mapping fenced by exact `---` lines at
the beginning of a source file:

```md
---
title: Compiler Design
date: 2026-07-28
topics: [compilers, semantics]
description: Notes on a small compiler.
build:
  template: post.html
---

# {{ page.data.title }}
```

The mapping is available as `page.data`. Invalid or unclosed front matter is a
build error and leaves the prior output destination untouched.

### Reserved `build` Controls

| Key | Behavior | Status |
| --- | --- | --- |
| `build.template` | Select a named layout. | Implemented; missing value falls back to `page.html`. |
| `build.markup` | Select `markdown` or `verbatim` conversion. | Implemented; extension selects the default when absent. |
| `build.route` | Claim one explicit canonical site-relative route. | Implemented. |
| `build.publish` | Include or withhold a document from routing/output. | Implemented. Links to withheld documents are errors, never copied source files. |

Markdown pages use the configured Markdown profile by default. HTML pages use
the verbatim profile by default, while still supporting front matter and body
Liquid.

## 5. Liquid, Templates, And Escaping

An authored body is filled with Liquid before markup conversion. Its layout is
rendered after body references are resolved.

Layouts live under `templates/`. Files below `templates/includes/` are available
to literal Liquid `render` calls by their path below `includes/`:

```liquid
{% render "header.html" %}
{% render "cards/post.html", post: page.data %}
```

The template context contains:

| Value | Meaning |
| --- | --- |
| `site` | Values from the `site` configuration mapping. |
| `page.data` | Resolved defaults and front matter. |
| `page.url` | Canonical page address during rendering; final HTML receives its base-path projection. |
| `page.source.path` | Content-root-relative source path. |
| `page.content` | Completed converted body HTML. |
| `collections` | Catalog of configured, ordered collection cards. |

All interpolated values are HTML-escaped. `page.content` is the sole standard
trusted path because Syncpress produced it. Liquid uses strict variables, literal
template names, and static context paths so dependencies remain understandable.
Missing templates, missing partials, recursive partial trees, unsupported Liquid
features, and failed evaluation are build errors.

### Template Behavior

Syncpress supports named layouts and reusable partials only. There is no author
plugin code, dynamic template lookup, or implicit theme system. `site inspect`
reports a page's selected layout and transitive partial tree.

## 6. Collections And Excerpts

A collection is a named, ordered set of routed pages. Collection names have no
built-in meaning.

```liquid
{% for post in collections.posts %}
  <a href="{{ post.url }}">{{ post.data.title }}</a>
{% endfor %}
```

Each card exposes:

```text
data
url
excerpt
source.path
```

Full rendered page content is deliberately not exposed to collection cards, which
prevents collection/page render cycles.

### Selection And Ordering

- `match` uses the portable glob contract.
- `where.field` names a card field such as `data.featured`.
- `where.equals`, `where.contains`, and `where.exists: true` are the supported
  filter forms.
- `sort.by` selects a card field; `sort.order` is `asc` or `desc`.
- Ordering is total: present keys compare by type and value, missing keys sort
  after present keys, and ties break by source path then item identity.

Excerpts are derived from the authored body before Liquid evaluation and end at
the configured separator. A card has `excerpt: null` when no separator occurs. The narrowly
scoped `collections/*/*/excerpt` trusted declaration permits rendered excerpts
in collection cards while every other interpolated value remains escaped.

Internally, `Cataloging` owns each named catalog's condition, sort field,
membership reconciliation, projection snapshot, and total order. Path-pattern
admission remains a separate `Matching` decision. Composition forms each
complete card once and asks Cataloging to index it; no field-by-field card state
is retained.

## 7. Routes And Output Paths

Routes derive from content paths:

```text
content/index.md                        -> /
content/about.md                        -> /about/
content/about/index.md                  -> /about/
content/posts/compiler-design/index.md  -> /posts/compiler-design/
```

Directory routes emit `index.html`; file routes such as `/404.html` emit that
file. An explicit route must be canonical and site-relative. Two owners cannot
claim one route; collisions and invalid routes are diagnostics.

`site.basePath` supports deployments below the domain root. Composition first
uses canonical site addresses, then rewrites supported site-absolute references
in final layout HTML exactly once. Authors therefore write ordinary relative
references or root-relative site addresses without remembering a URL helper.

### Route And Output Guarantees

- No page, copied public file, local asset, or generated rendition may silently
  overwrite a different output.
- Output-collision diagnostics identify competing producers as related locations.
- Deployment policy can require an authored `404.html`, generate `.nojekyll`, and
  add generated routes/files without changing authored page routing.

## 8. References, Assets, And Public Files

### Supported HTML References

The current reference scanner recognizes URLs in:

| Elements | Attributes |
| --- | --- |
| `a`, `area`, `base`, `link` | `href` |
| `img`, `input[type=image]` | `src` |
| `img`, `source` | `srcset` candidates |
| `source`, `audio`, `video`, `script`, `iframe`, `embed`, `track` | `src` |
| `video` | `poster` |

External, site-absolute, and fragment-only references are answered without
local-file lookup. A local reference to a routed page is rewritten to its route,
retaining query and fragment suffixes. A missing, invalid, escaping, or
unpublished-document reference is a strict build error.

CSS URLs, SVG-internal URLs, form actions, citation URLs, `srcdoc`, and unsupported
URL-bearing attributes are outside the current reference contract.

### Local Asset Policy

Referenced non-page local files keep their filename and are emitted beside the
referencing page's output. A page at
`content/posts/example/index.md` can therefore refer to `./diagram.png` and
publish it as `posts/example/diagram.png`. One source asset referenced from
multiple page directories is emitted for each required output address. Each
output has an explicit producer claim, so an unrelated page or generated artifact
cannot silently replace it.

Every regular file below `public/` is copied unchanged with its path preserved.
Public files bypass image optimization. Generic copied files retain opaque media
labels so `Filing` does not infer deployment behavior from filename extensions.

## 9. Responsive Raster Images

For a local primary raster `<img src>`, Syncpress:

1. Resolves the source relative to the content page.
2. Validates supported raster bytes and reads intrinsic dimensions.
3. Produces eligible configured widths and formats without upscaling.
4. Keeps the exact original fallback beside the referencing page output.
5. Emits derived renditions under `paths.assets` with digest-based names.
6. Replaces the image element with a deterministic `<picture>` only after every
   promised derived offer is staged.
7. Applies the configured base path during the final layout reference pass.

The fallback preserves a safe source query/fragment suffix. SVG and other
non-raster primary images follow the ordinary copy path. Unsupported or corrupt
raster bytes are build errors.

Generated markup supplies original `alt`, intrinsic `width` and `height`,
`loading="lazy"`, and `decoding="async"`. Safe authored image attributes,
including `class`, `sizes`, `data-*`, and `aria-*`, are retained on the generated
`<img>` fallback.

## 10. Batch Lifecycle And Reactions

The current batch sequence is:

```text
settings -> read -> route -> excerpt -> collect -> render -> emit
```

The host waits for the application to settle between transitions. Phases are
global barriers: route claims exist before collection cards use URLs; collections
are complete before layouts render them.

| Phase | Required composition outcome |
| --- | --- |
| `settings` | Load YAML, declare profiles, compile fixed/configured patterns, rebase routes, and reset/declare catalog policy. |
| `read` | Parse content, define layouts/includes, emit public files, and layer defaults plus front matter. |
| `route` | Claim published routes and report invalid or colliding claims. |
| `excerpt` | Convert authored bodies before body Liquid rendering. |
| `collect` | Form complete cards and index path-matched pages under catalog-owned conditions and ordering. |
| `render` | Open per-page replacement attempts; form complete contexts; fill/convert/resolve bodies; process assets/images; render layouts; rebase final references; commit finished pages. |
| `emit` | Current barrier reserved for publication policy. It does not reconcile itself. |
| post-phase reconcile | Require a finished job, no error diagnostics, and no routed page without a current `Depending` result; atomically reconcile active intents. |

`Depending` records each page's source, body-template, and layout-template
inputs together with its settled result. A fresh strict application is used for
each filesystem rebuild; this preserves atomic reconciliation and avoids a
separate persistent dependency database.

## 11. Build Modes

### Strict Batch Build: Implemented

A strict batch build reads the project, resolves all configured work, accumulates
diagnostics, and reconciles only when all routes/pages are settled and no error
stands. `Emitting` installs the resulting tree atomically and removes stale
entries. A failed build leaves the prior destination tree in place.

### Watch Build: Implemented

`site build --watch`:

- Performs the same strict initial build.
- Watches the project recursively, ignores its output directory, and coalesces
  bursts of filesystem events.
- Runs a fresh strict rebuild after changes, retaining the last reconciled output
  if the rebuild fails.
- Rebuilds dependency relationships from current source rather than persisting an
  external build database.

### Development Server: Implemented

`site dev` serves the reconciled destination, runs watch behavior, and reloads
connected clients after successful output changes. It uses no separate rendering
model and never publishes a partially failed strict build.

### Inspection: Implemented

`site inspect` reports:

- The owner of a route and the selected page template.
- Resolved defaults and the layer/rank that supplied each value.
- Collection memberships, positions, and card facts.
- Inputs, stale reasons, and active output producers.
- Ordered standing diagnostics and related locations when available.

The report is formed from existing concept state rather than duplicate
inspection-only state.

## 12. Diagnostics And Filesystem Safety

A diagnostic has severity, code, message, source, and optional location. The
diagnostic concept orders errors before warnings, then source, position, and code
deterministically.

### Current Strict Errors

Current composition reports errors for malformed front matter, invalid settings
that reach a concept, malformed patterns, invalid/colliding routes, undefined
profiles/templates, failed Liquid/conversion/image work, output contention,
unsupported relative layout references, and local reference failures.

The host reports project-boundary failures directly: missing roots, invalid
configured root/output paths, source symlinks, non-regular files, source roots
escaping through symlinks, duplicate template names, and inaccessible filesystem
entries.

Configuration policy diagnostics include exact YAML node coordinates. Liquid
failures report their named source and one-based coordinates; authored body
locations are adjusted past front matter. References discovered only after
Markdown or layout generation deliberately do not claim a false authored
coordinate.

### Diagnostic Experience

The product accumulates independent problems rather than stopping at the first
one. Route/output collisions include related producers, policy errors include
configuration-node locations, and strict batch mode remains fail-closed. Live
mode serves the prior reconciled tree rather than downgrading errors.

## 13. Deployment

The output is an ordinary static directory. A completed batch can deploy to
GitHub Pages, Cloudflare Pages, or an equivalent static host.

| Deployment behavior | Status |
| --- | --- |
| Static HTML/assets and directory-style routes | Implemented |
| `site.basePath` for subpath deployments | Implemented |
| Atomic output reconciliation | Implemented |
| Configured `.nojekyll` generation | Implemented |
| Deployment-oriented required authored `404.html` policy | Implemented |
| Origin-aware canonical URLs, sitemap, and Atom feed | Implemented |
| Static redirect pages and collection pagination | Implemented |

`deploy.nojekyll` emits an empty `.nojekyll`. `deploy.requireNotFound` requires
an authored `/404.html` route. `deploy.sitemap` emits `sitemap.xml`; both it and
`deploy.feed` require a valid `site.origin`. A feed names a configured collection
and a portable output path. Redirect keys are canonical site-relative routes and
their targets are canonical site-relative routes or HTTP(S) URLs. Pagination
rules name a collection, positive `perPage`, a route containing exactly one
`:page`, and a layout template. Generated routes participate in ordinary route
and output collision checks; redirect cycles are rejected. Feed entry dates are
either `YYYY-MM-DD` or timezone-qualified RFC 3339 timestamps, keeping Atom
output independent of the host timezone.

`Governing` owns the product-specific configuration assessment and its
source-located policy problems; generic YAML storage remains in `Configuring`.
The emit phase starts one ordered `Deploying` queue. Reactions connect each
current item to `Routing`, `Templating`, `Referencing`, `Depending`, and
`Emitting`, so pagination routes exist before sitemap formation and deployment
collisions retain deterministic priority. The filesystem edge only imports
source facts, advances phases, and reconciles the completed application model.

## 14. Delivery Status

| Area | Status | Evidence or next step |
| --- | --- | --- |
| Configured strict batch publication | Implemented | `src/edge/`, `src/compositions/` |
| Markdown and verbatim HTML pages | Implemented | `example/content/`, golden output |
| Defaults, page controls, and routing | Implemented | Full-site composition tests |
| Liquid layouts/includes and escaping | Implemented | Example templates and direct concept coverage |
| Collections and authored excerpts | Implemented | Example post navigation and trusted card excerpts |
| Local links, downloads, public files, and base rebasing | Implemented | Golden links/assets and strict negative tests |
| Responsive raster images | Implemented | Golden `<picture>`, rendition hashes, and preserved safe attributes |
| Watch/dev | Implemented | Filesystem watcher, reconciled output server, and live reload |
| Inspect/report endpoint | Implemented | Isolated provenance report from current concept state |
| Configuration schema diagnostics | Implemented | `Governing` concept with independent YAML-node diagnostics |
| Template-location diagnostics | Implemented | Liquid source coordinates, including authored body offsets past front matter |
| Deployment markers, feeds, sitemaps, redirects, pagination | Implemented | Emit-phase `Deploying` queue and byte-exact golden output |

## 15. Verification Gate

Every completed delivery item must:

1. Be represented by explicit concepts, views, formers, and composition reactions; only external resource access remains at the host boundary.
2. Appear correctly in regenerated `generated/syncpress.md` and `generated/wire.ts`
   when it changes the assembly.
3. Have behavior-oriented tests, with byte-exact golden coverage where practical.
4. Pass the repository gate:

```sh
bun test
bun run check
```

The example project is the baseline end-to-end fixture. Its golden manifest must
change only when an intentional, reviewed product behavior changes.
