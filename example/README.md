# Syncpress example site

This directory is a complete Syncpress project. It is independently installable
after its pinned `@mit-sdg/syncpress` dependency is published to npm.

## Run locally

From this directory, install dependencies and start the development server:

```sh
npm install
npm run dev
```

The server watches the project and serves the last successful build on
`127.0.0.1:3000`. Build or inspect the site with:

```sh
npm run build
npm run inspect -- /
```

`npm run build` writes the static output to `dist`. Syncpress does not provide a
production server; deploy that directory to a static file host.

This example configures `site.basePath: /syncpress/` for its GitHub Pages
deployment. The built-in development server does not mount a base path, so set
`site.basePath: /` when serving this project directly during local development.

The published documentation is available at <https://mit-sdg.github.io/syncpress/>.
Maintainers should use [RELEASING.md](../RELEASING.md) for package and Pages
release procedure.
