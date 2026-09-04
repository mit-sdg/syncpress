---
title: Build static sites from ordinary files
description: Syncpress turns Markdown, HTML, Liquid templates, and local assets into a static site with repeatable output.
hero: true
topics: [overview, site-building]
---

Syncpress builds content-oriented sites from a YAML configuration file, Markdown
or HTML content, Liquid layouts, and ordinary local files. A successful build
writes a directory for deployment to a static host.

Install the public `@mit-sdg/syncpress` package from npm as a development
dependency. It provides the `syncpress` executable and a programmatic API. This
documentation is also an independently installable [example site](https://github.com/mit-sdg/syncpress/tree/main/example).

## Choose a starting point

- [Build a site](./guides/getting-started.md) for a complete first project.
- Use the [user guide](./reference/index.md) for configuration, templates, assets, commands, and the programmatic API.
- Read [how Syncpress is built](./about.md) when contributing to the repository.

## What a build guarantees

Equal declared source paths, file bytes, and configuration produce equal output bytes. Those declared values are the complete publishing inputs. A build rejected before reconciliation preserves the previous output tree. See [reconciliation failures](./reference/operations.md#build) for the filesystem assumptions at the final installation step.

Syncpress targets build-time static pages. Pages that require request-time state, API routes, database access, or arbitrary build-time code require another system.

## What this example covers

This documentation is also a working Syncpress project. Its source demonstrates
front matter, Markdown, collections, partials, local links, copied assets, and
responsive images. Compare [`content/index.md`](https://github.com/mit-sdg/syncpress/blob/main/example/content/index.md)
with this generated page.

<figure class="responsive-swatch">
  <img src="./assets/blue.png?variant=field-note#pixel" alt="A flat blue field used as a responsive image fixture" class="field-image" sizes="(min-width: 48rem) 42rem, 100vw" data-fixture="responsive">
  <figcaption>This small PNG is emitted as a responsive <code>picture</code> with AVIF and WebP alternatives.</figcaption>
</figure>

<figure class="mark-demo">
  <img src="./assets/mark.svg" alt="Blue circular Syncpress mark">
  <figcaption>This SVG follows the ordinary local-asset copy path.</figcaption>
</figure>

## Links and collections

[Build the example](./guides/getting-started.md?from=home#prerequisites), [trace the implementation](./about.md?from=home#build-lifecycle), or [inspect a verbatim HTML page](./legal.html#escaping). Syncpress resolves these content-relative links to their canonical routes while retaining query strings and fragments.

The `documented` collection uses an existence filter and currently contains **{{ collections.documented.size }}** routed documents. The `siteBuilding` collection uses a list-contains filter, while the featured section below uses a boolean equality filter.

## Featured documentation

<div class="feature-grid">
{% for item in collections.featured %}
{% render "includes/cards/feature.html", item: item %}
{% endfor %}
</div>

## Recent implementation notes

<div id="journal" class="post-list">
{% for post in collections.posts %}
{% render "includes/cards/post.html", post: post %}
{% endfor %}
</div>
