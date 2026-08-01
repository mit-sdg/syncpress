# Syncpress

[![npm version](https://img.shields.io/npm/v/%40mit-sdg%2Fsyncpress)](https://www.npmjs.com/package/@mit-sdg/syncpress)
[![CI](https://github.com/mit-sdg/syncpress/actions/workflows/ci.yml/badge.svg)](https://github.com/mit-sdg/syncpress/actions/workflows/ci.yml)

Syncpress builds Markdown, HTML, Liquid templates, and local files into a
deterministic static site. A successful build produces an ordinary directory of
files; the deployed site has no Syncpress server-side runtime.

## Install

Install `@mit-sdg/syncpress` as a development dependency:

```sh
npm install --save-dev @mit-sdg/syncpress
```

The package supports Node.js `>=24 <25` and Bun `>=1.3.14 <1.4`. It is an ESM
package. CommonJS `require()` is not supported.

## Build a site

A Syncpress project requires `site.yaml` plus `content/`, `templates/`, and
`public/` directories. The following commands create and build the smallest
useful site:

```sh
mkdir notes && cd notes
npm init -y
npm install --save-dev @mit-sdg/syncpress
mkdir content templates public
```

Create `site.yaml`:

```yaml
defaults:
  - match: "**/*.md"
    values:
      build:
        template: page.html
        markup: markdown
```

Create `content/index.md`:

```md
---
title: Notes
---

# {{ page.data.title }}
```

Create `templates/page.html`:

```liquid
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>{{ page.data.title }}</title></head>
  <body><main>{{ page.content }}</main></body>
</html>
```

Build the project:

```sh
npx syncpress build
```

The command writes `dist/index.html`. `npx syncpress dev` watches the project
and serves successful builds on `127.0.0.1:3000`. The development server is not
a production server.

## Commands

```text
syncpress build [site-directory] [output-directory]
syncpress build --watch [site-directory] [output-directory]
syncpress dev [--port PORT] [site-directory] [output-directory]
syncpress inspect <page-or-route> [site-directory]
```

The site directory defaults to the current directory. Without an explicit
output directory, Syncpress uses `paths.output` from `site.yaml`, or `dist`.

For configuration rules, content routing, templates, assets, deployment, and
failure behavior, read the [documentation site](https://mit-sdg.github.io/syncpress/).
The [example project](example/README.md) is a complete installable site.

## Programmatic API

The package root exports `runCli`, `buildSite`, `inspectSite`, `watchSite`, and
`serveSite`, along with their TypeScript types:

```ts
import { buildSite } from "@mit-sdg/syncpress";

const result = await buildSite("./site");
console.log(result.written);
```

See the [programmatic API reference](https://mit-sdg.github.io/syncpress/reference/programmatic-api/)
for function signatures, result values, callbacks, and cleanup requirements.

## Limitations

Syncpress does not provide server rendering, API routes, a database, executable
configuration, or a plugin interface. Use a different system when a page depends
on request-time state or arbitrary build-time code.

## Contributing and releases

Repository development is documented in [CONTRIBUTING.md](CONTRIBUTING.md).
Package release procedure and GitHub Pages maintenance are documented in
[RELEASING.md](RELEASING.md).
