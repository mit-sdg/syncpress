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

The production URL for this example has not been selected. Before publishing
the site, replace the placeholder `site.origin` and set `site.basePath` in
`site.yaml` for the deployment target. Use `/` when the site is hosted at the
origin root, or a leading-and-trailing-slash path such as `/docs/` when the site
is hosted below the root.

`public/site.webmanifest` is copied without rewriting. Its `start_url` must
match the deployed base path. Update any other absolute URLs in copied public
files at the same time. Do not deploy with the current
`https://syncpress.example` placeholder.

## Publish and deploy

The example's exact dependency must exist in the npm registry before an
independent checkout can install it:

1. Publish `@mit-sdg/syncpress@0.1.0` as described in the repository README.
2. Check out or copy the `example` directory as the site project.
3. Set `site.origin`, `site.basePath`, and the matching webmanifest URL for the
   deployment target.
4. Run `npm install` and `npm run build` in the site project.
5. Deploy the resulting `dist` directory at the configured base path.

For a later Syncpress release, update the example's exact dev dependency,
publish that package version first, reinstall, and rebuild the site.
