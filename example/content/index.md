---
title: Static publishing with explicit rules
description: Syncpress builds Markdown, HTML, templates, and local files into a deterministic static site.
topics: [overview, site-building]
---

Syncpress is a static site generator for documentation, blogs, portfolios, and other content-oriented sites. A project contains YAML policy, Markdown or HTML content, Liquid layouts, and ordinary files. A successful build writes a static directory with no server-side runtime.

This documentation is also the repository's executable example. Every page is built from [`example/`](https://github.com/mit-sdg/syncpress/tree/main/example), and the integration suite checks the complete output tree by SHA-256. The examples therefore demonstrate the interfaces they describe.

## Start here

1. [Build the example](./guides/getting-started.md) to see one complete project lifecycle.
2. Read [configuration](./reference/configuration.md), [content and routes](./reference/content-routing.md), [templates and data](./reference/templates.md), and [assets and images](./reference/assets.md) when changing a site.
3. Use [commands, deployment, and diagnostics](./reference/operations.md) when running builds locally or in automation.
4. Read [how Syncpress is built](./about.md) for the concept-and-reaction architecture.

## What a build guarantees

Equal declared input bytes and configuration produce equal output bytes. The build does not use filesystem enumeration order, a clock, random identifiers, or undeclared environment values as publishing inputs. A build rejected before reconciliation does not replace the previous output tree. See [reconciliation failures](./reference/operations.md#build) for the filesystem assumptions at the final installation step.

Syncpress does not provide server rendering, API routes, a database, executable configuration, or a plugin platform. Use another system when a page must depend on request-time state or arbitrary build-time code.

## This page as an example

The source for this page demonstrates front matter, Markdown, Liquid collection access, a named partial, local page references, an ordinary SVG, and a responsive raster image. Inspect [`content/index.md`](https://github.com/mit-sdg/syncpress/blob/main/example/content/index.md) beside the generated result.

<figure class="responsive-swatch">
  <img src="./assets/blue.png?variant=field-note#pixel" alt="A flat blue field used as a responsive image fixture" class="field-image" sizes="(min-width: 48rem) 42rem, 100vw" data-fixture="responsive">
  <figcaption>A one-pixel raster keeps this fixture compact while still producing a responsive <code>picture</code> with AVIF and WebP offers.</figcaption>
</figure>

<figure class="mark-demo">
  <img src="./assets/mark.svg" alt="Blue circular Syncpress mark">
  <figcaption>The adjacent SVG is a normal local asset, copied beside the referencing page.</figcaption>
</figure>

## Reference handling in this page

[Build the example](./guides/getting-started.md?from=home#prerequisites), [trace the implementation](./about.md?from=home#build-lifecycle), or [inspect a verbatim HTML page](./legal.html#escaping). These content-relative links retain their query strings and fragments when Syncpress retargets them to canonical routes.

The `documented` collection uses an existence filter and currently contains **{{ collections.documented.size }}** routed documents. The `siteBuilding` collection uses a list-contains filter, while the featured section below uses a boolean equality filter.

## Documentation routes selected by a collection

<div class="feature-grid">
{% for item in collections.featured %}
{% render "cards/feature.html", item: item %}
{% endfor %}
</div>

## Design notes

<div id="journal" class="post-list">
{% for post in collections.posts %}
{% render "cards/post.html", post: post %}
{% endfor %}
</div>
