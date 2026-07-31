# Syncpress example site

This directory is an independently installable Syncpress site. Its package is
named `syncpress-example-site`, is private, and depends on the exact public
package version `@mit-sdg/syncpress@0.1.0`. A checkout of this directory does
not require the Syncpress source tree after that package version is available
from the npm registry.

## Install and run

Node.js 24 is required by this example and by Syncpress 0.1.0. From this
directory, install dependencies and start the development server:

```sh
npm install
npm run dev
```

The server watches the site and serves the last successful build on
`127.0.0.1:3000`. The configured non-root `site.basePath` is not mounted by the
built-in server; set `site.basePath: /` for direct local serving or use a local
server that mounts the output at the configured prefix.

Build or inspect the site with the project scripts:

```sh
npm run build
npm run inspect -- /
```

`npm run build` writes the static site to `example/dist` (the `dist` directory
relative to this file). The output directory can be deployed to a static file
host; Syncpress does not provide a production server.

## Deployment configuration

The example is published at <https://mit-sdg.github.io/syncpress/>. Its
`site.yaml` sets `site.origin` to `https://mit-sdg.github.io` and
`site.basePath` to `/syncpress/`. Generated site-absolute URLs therefore use
the `/syncpress/` prefix.

`public/site.webmanifest` is copied without rewriting. Its `start_url` is
`/syncpress/`; update it together with `site.yaml` if the deployment location
changes.

## GitHub Pages deployment

The example's exact dependency must exist in the npm registry before an
independent checkout can install it. For a later Syncpress release, publish the
package first, update the example's exact dev dependency and lockfile, and then
rebuild the site.

The repository's Pages source is GitHub Actions. The `Deploy example site`
workflow in `.github/workflows/pages.yml` runs when a push to `main` changes
`example/**` or the workflow itself. It can also be started by manual dispatch.
The workflow independently installs the example with `npm ci`, runs
`npm run build`, and deploys `example/dist` to GitHub Pages.
