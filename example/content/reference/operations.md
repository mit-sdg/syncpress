---
title: Commands, deployment, and diagnostics
description: Build, watch, serve, inspect, generate deployment artifacts, and interpret strict failures.
topics: [commands, deployment, diagnostics, site-building]
---

The command-line interface builds one local project into an ordinary static directory. Commands return a nonzero status for invalid usage and build failures.

## Commands

```text
syncpress build [site-directory] [output-directory]
syncpress build --watch [site-directory] [output-directory]
syncpress dev [--port PORT] [site-directory] [output-directory]
syncpress inspect <page-or-route> [site-directory]
```

`site-directory` defaults to the current directory. The output defaults to `paths.output`, which defaults to `dist`. An explicit output is resolved from the site directory; an absolute explicit path remains absolute.

Install `@mit-sdg/syncpress` as a development dependency and invoke
`syncpress` from a project script or package runner. The repository's
`bun run site ...` command is a contributor shortcut, not the consumer CLI.

<h3 id="build"><code>build</code></h3>

`build` creates a fresh application, validates and stages the project, runs all phases, and reconciles the destination only after the build is complete and has no error diagnostics. Success reports route-claim and input counts plus written, replaced, kept, and removed output counts. The CLI labels the route-claim count as `pages`; it includes authored pages, redirects, and generated pagination routes.

A failure detected before reconciliation leaves the preceding destination tree unchanged. Stale output is removed only as part of successful reconciliation.

Reconciliation prepares a complete tree beside the destination, moves the previous destination aside, and then installs the prepared tree. If installation fails, Syncpress attempts to restore the previous destination. An operating-system or filesystem failure that prevents both installation and restoration can leave the destination absent while the previous tree remains in the transaction directory. Process termination during these final renames has the same operational risk. Do not treat output-directory replacement as a durable transaction across arbitrary filesystem or process failure.

### `build --watch`

Watch mode performs a strict initial build, monitors the project recursively, and coalesces bursts of changes. A change during a rebuild queues another rebuild. Output reconciliation events are ignored. Failed rebuilds report diagnostics and retain the last successful output.

### `dev`

Development mode combines watch behavior with a server for the reconciled destination. It listens on `127.0.0.1:3000` by default. `--port` accepts an integer from 1 through 65535. HTML responses receive a small EventSource client, and connected pages reload only after a successful build.

The server is for local development. It is not a production HTTP server.

The current server maps request paths directly into the output directory and does not mount `site.basePath`. A project with a non-root base path therefore emits prefixed links that the development server does not resolve unless the output is mounted under that prefix by another local server. Use the built-in server directly only with `site.basePath: /`.

### `inspect`

`inspect` accepts a canonical route beginning with `/` or a content-root-relative page path. It reports the source, selected template and transitive partials, layered data origins, collection positions, dependencies, outputs, route claims, stale reasons, and diagnostics. Inspection uses an isolated application and does not reconcile the configured destination.

## Deployment settings

Deployment work runs after authored pages have settled and participates in route and output collision checks.

### Not-found page and `.nojekyll`

`deploy.nojekyll: true` emits an empty `.nojekyll`. `deploy.requireNotFound: true` requires an authored document whose canonical route is `/404.html`; it does not synthesize the page.

### Sitemap

`deploy.sitemap: true` emits `sitemap.xml`. A valid `site.origin` is required. The sitemap excludes `/404.html` and redirect routes and includes generated pagination routes.

### Atom feed

```yaml
deploy:
  feed:
    collection: posts
    path: feed.xml
    title: Engineering notes
    description: Recent changes.
```

The named collection must exist and `path` must be a portable output path. `site.origin` is required. Entry dates must be `YYYY-MM-DD` or timezone-qualified RFC 3339 values; host-local time is not inferred.

### Redirects

```yaml
deploy:
  redirects:
    /old-guide/: /guide/
    /external/: https://example.com/reference
```

Keys are canonical site-relative routes. Targets are canonical site-relative routes or HTTP(S) URLs. Redirect cycles and route collisions are errors. Redirect output is static HTML, so host-specific redirect semantics are not implied.

### Pagination

```yaml
deploy:
  pagination:
    archive:
      collection: posts
      perPage: 20
      route: /archive/:page/
      template: archive.html
      title: Article archive
```

`perPage` must be positive. The route must contain exactly one `:page` marker. The collection and template must exist. Pagination generates one page even for an empty collection and participates in ordinary route collision checks.

The pagination layout receives the ordinary `site`, `collections`, and `page` values plus:

| Value | Meaning |
| --- | --- |
| `pagination.collection` | Configured collection name. |
| `pagination.current` | One-based page number. |
| `pagination.pages` | Total page count; at least one. |
| `pagination.items` | Collection cards for the current slice, with the normal `data`, `url`, `excerpt`, and `source.path` fields. |
| `pagination.previous` | Previous canonical route; absent on the first page. |
| `pagination.next` | Next canonical route; absent on the last page. |

For generated page number `N`, `page.source.path` is `[generated]/<pagination-name>/N`. `page.data` contains `section: Collection page`, the configured title, and an empty description. `page.content` is a generated list of the current cards. A custom layout may render `pagination.items` instead.

## Failure classes

The host rejects project-boundary failures immediately, including missing roots, unsafe configured paths, symbolic links, non-regular files, inaccessible entries, source/output overlap, and duplicate logical template names.

Build diagnostics accumulate independent domain failures. Current categories include malformed front matter, invalid configuration, malformed patterns, route and output collisions, missing profiles or templates, Liquid failures, conversion and image failures, invalid local references, unsupported relative layout references, and deployment failures.

Diagnostics use the form `SEVERITY CODE source:line:column: message` when a source position is available. Configuration diagnostics point to YAML nodes. Liquid diagnostics point to the named template or authored body; body positions account for front matter. A generated reference does not receive an invented authored coordinate.

No warning downgrades a strict error in watch or development mode. The previous successful site remains available until a clean rebuild reconciles.
