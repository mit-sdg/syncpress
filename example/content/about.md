---
title: A tour of the source tree
description: How defaults, routes, collections, templates, and files fit together in one small project.
featured: true
topics: [site-building, configuration]
build:
  route: /example-tour/
---

<h2 id="route-policy">Route policy</h2>

This document begins as `content/about.md`, but its front matter claims the explicit `/example-tour/` route. The other documents keep their derived directory routes, and `not-found.html` demonstrates a file-style `/404.html` route. All of those canonical addresses receive the configured `/field-notes/` base path only in the final HTML pass.

## Project layout

| Source area | Purpose in this example |
| --- | --- |
| `site.yaml` | Declares defaults, collections, Markdown options, image offers, and the base path. |
| `content/` | Holds Markdown, verbatim HTML, an unpublished draft, and local files reached by references. |
| `templates/` | Holds page layouts and literal-name includes for shared chrome and cards. |
| `public/` | Copies files unchanged, including the stylesheet, favicon, manifest, robots file, and this site's download. |

## Collection filters

The `siteBuilding` collection selects pages whose `topics` list contains `site-building`; it currently has **{{ collections.siteBuilding.size }}** entries. The `documented` collection selects pages with a `description`, and the featured cards on the overview select `featured: true`. Each card receives data, a canonical URL, a source path, and an optional excerpt without receiving a page's full rendered body.

## Intentional omission

`content/drafts/hidden.md` is parsed and layered like any other Markdown file, then withheld with `build.publish: false`. It has no route, output file, or collection card, and this site intentionally never links to it.

<p><a class="button" href="/downloads/build-checklist.txt" download>Download the copied public checklist</a></p>
