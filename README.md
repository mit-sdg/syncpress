# Syncpress

Syncpress is a deterministic static publishing generator for Markdown, HTML,
Liquid templates, and local files. A successful build produces an ordinary
static directory with no server-side runtime. The source repository is
<https://github.com/mit-sdg/syncpress>.

## Install

Syncpress 0.1.0 is published to the npm registry as the public package
`@mit-sdg/syncpress`. Install it as a development dependency:

```sh
npm install --save-dev @mit-sdg/syncpress
```

or with Bun:

```sh
bun add --dev @mit-sdg/syncpress
```

The package requires Node.js 24 (`>=24 <25`) or Bun 1.3.14 or later in the 1.3
series (`>=1.3.14 <1.4`). The built package has been smoke-tested with Node.js
24.

## Quick start

A site directory contains `site.yaml` and the `content/`, `templates/`, and
`public/` directories. See the [example project](example/README.md) for a
complete independently installable site and the [authoring
tutorial](example/content/guides/getting-started.md) for the smallest working
configuration.

Add project scripts that invoke the installed `syncpress` executable:

```json
{
  "scripts": {
    "build": "syncpress build .",
    "dev": "syncpress dev .",
    "inspect": "syncpress inspect"
  }
}
```

Then build or serve the site:

```sh
npm run build
npm run dev
npm run inspect -- /
```

The default output is `dist` under the site directory. `site.yaml` can select a
different `paths.output`.

## Command-line interface

Installing the package provides `syncpress`:

```text
syncpress build [site-directory] [output-directory]
syncpress build --watch [site-directory] [output-directory]
syncpress dev [--port PORT] [site-directory] [output-directory]
syncpress inspect <page-or-route> [site-directory]
```

The site directory defaults to the current directory. An omitted output
directory uses `paths.output` from `site.yaml`, or `dist` when that setting is
absent. The [operations reference](example/content/reference/operations.md)
defines command behavior, diagnostics, watch mode, and reconciliation limits.

## Programmatic API

The package root exports `runCli`, `buildSite`, `inspectSite`, `watchSite`, and
`serveSite`, together with their public TypeScript types:

```ts
import { buildSite } from "@mit-sdg/syncpress";

const result = await buildSite("./site");
console.log(result.written);
```

The internal application assembly, including `buildSyncpress`, is not a public
export. See the [programmatic API
reference](example/content/reference/programmatic-api.md) for signatures and
lifecycle requirements.

## Package contents

The published package contains `dist`, public declarations under `types`, and
this README. The build bundles Syncpress's internal TypeScript and Markdown
specifications into the library and CLI artifacts under `dist`. Third-party
runtime packages remain normal npm dependencies and are installed by the
package manager.

## Publishing the npm package

Publishing requires an npm account authorized for the `@mit-sdg` scope. From a
clean checkout:

```sh
npm login
npm whoami
npm publish
```

`publishConfig.access` is `public`, so `npm publish` publishes the scoped
package publicly. After publication, verify the registry record and the exact
version:

```sh
npm view @mit-sdg/syncpress@0.1.0 name version
```

The registry will not accept another publication of the same package name and
version. Update `package.json` to a new version before each later publication,
then build and verify that version before publishing it.

## Contributor workflow

Repository contributors use Bun 1.3.14 and the root scripts:

```sh
bun install
bun run generate
bun run check
bun run principle
bun test
```

`generate` writes `generated/syncpress.md` and `generated/wire.ts`. `check`
compares declarations with concept implementations, checks generated artifacts,
runs application diagnostics, and typechecks the repository. `principle` runs
the direct concept Principle tests.

The repository-only `bun run site ...` script executes `src/cli.ts` without an
installed package. For example, `bun run site build ./example` builds the
fixture while developing Syncpress. Consumer projects should use the installed
`syncpress` executable through their own project scripts.

To add behavior, update the relevant concept specification and implementation,
register any new concept, connect it under `src/compositions/`, run
`bun run generate`, review both generated files, and run `bun run check`.
Generated files are derived from `generated.config.ts`; do not edit them by
hand.
