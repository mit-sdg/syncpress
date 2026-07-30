---
title: A small, complete site
description: A documentation-first Syncpress project that can be built exactly as it appears here.
topics: [overview, site-building]
---

Syncpress turns ordinary files into a deterministic static site. This field guide is both a readable example and an integration-sized source project: its configuration, content, templates, local assets, and copied public files all live beside one another.

## A build that explains itself

- Ordered defaults choose Markdown or verbatim HTML and then specialize guides and posts.
- Content-relative links become routed pages, copied downloads, or optimized image output.
- A base path lets the same output deploy below a domain root without authoring special URLs.
- Liquid values are escaped by default; only the finished page body is trusted by its layout.

<figure class="responsive-swatch">
  <img src="./assets/blue.png?variant=field-note#pixel" alt="A flat blue field used as a responsive image fixture" class="field-image" sizes="(min-width: 48rem) 42rem, 100vw" data-fixture="responsive">
  <figcaption>A one-pixel raster keeps this fixture compact while still producing a responsive <code>picture</code> with AVIF and WebP offers.</figcaption>
</figure>

<figure class="mark-demo">
  <img src="./assets/mark.svg" alt="Blue circular Syncpress mark">
  <figcaption>The adjacent SVG is a normal local asset, copied beside the referencing page.</figcaption>
</figure>

## Follow the source

[Build the guide](./guides/getting-started.md?from=home#install), [tour the source tree](./about.md?from=home#route-policy), or [inspect the verbatim HTML page](./legal.html#escaping). Those local links retain their query strings and fragments after Syncpress retargets them to routed output.

The `documented` collection uses an existence filter and currently contains **{{ collections.documented.size }}** routed documents. The `siteBuilding` collection uses a list-contains filter, while the featured section below uses a boolean equality filter.

## Featured routes

<div class="feature-grid">
{% for item in collections.featured %}
{% render "cards/feature.html", item: item %}
{% endfor %}
</div>

## Latest field notes

<div id="journal" class="post-list">
{% for post in collections.posts %}
{% render "cards/post.html", post: post %}
{% endfor %}
</div>
