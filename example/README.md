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

## Theme layout

The presentation lives in two places. `public/styles.css` contains the color
tokens, responsive page shell, typography, and component styles. `templates/`
contains the three layouts and their shared includes. The stylesheet avoids
fixed decorative layers, filters, and scroll effects so document scrolling does
not require repainting large visual effects.

| Layout | Used by | Shape |
| --- | --- | --- |
| `page.html` | Home, verbatim HTML pages, generated archive pages | Single column; renders a hero when a page sets `hero: true`, and collection cards with a pager when `pagination` is present. |
| `guide.html` | Guides, reference, and implementation pages | Responsive document layout with section navigation and, on wide screens, an on-page table of contents. |
| `post.html` | Field notes | Single column with dated header and the remaining notes below. |

The section navigation is built from the `startHere`, `userGuide`, and
`implementation` collections, which select pages by their `group` front-matter
value and order them by `order`. Adding a page to the sidebar is therefore a
front-matter change, not a template change.

The pages are complete without client-side code. `templates/includes/head.html`
contains one small progressive-enhancement script that adds the light and dark
theme toggle, heading anchors, the table of contents, and code-copy buttons.
Without it the site still renders, follows the operating system color scheme,
and stays fully navigable.

The published documentation is available at <https://mit-sdg.github.io/syncpress/>.
Maintainers should use [RELEASING.md](../RELEASING.md) for package and Pages
release procedure.
