---
title: Liquid templates and page data
description: Body evaluation, layouts, includes, available values, escaping, and template restrictions.
topics: [templates, liquid, site-building]
---

Syncpress uses Liquid for page bodies, layouts, and named includes. Body Liquid runs before markup conversion. The selected layout runs after body references have resolved and receives the completed body as `page.content`.

## Layouts and includes

Layouts are files below `templates/`. Includes are files below `templates/includes/` and are called with a literal name:

{% raw %}
```liquid
{% render "header.html" %}
{% render "cards/article.html", article: item %}
```
{% endraw %}

The include name is relative to `templates/includes/`. It cannot be dynamic, absolute, or relative to the caller. `render ... with` and `render ... for` are not supported. Liquid `include`, Liquid `layout`, and `cycle` are rejected.

This page uses [`templates/guide.html`](https://github.com/mit-sdg/syncpress/blob/main/example/templates/guide.html). The shared header is [`templates/includes/header.html`](https://github.com/mit-sdg/syncpress/blob/main/example/templates/includes/header.html).

## Template context

| Value | Availability | Meaning |
| --- | --- | --- |
| `site` | Bodies and layouts | The `site` configuration mapping. |
| `collections` | Bodies and layouts | Configured collections of publication cards. |
| `page.data` | Bodies and layouts | Merged defaults and front matter. |
| `page.url` | Bodies and layouts | Canonical site-relative route. |
| `page.source.path` | Bodies and layouts | Content-root-relative source path. |
| `page.content` | Layouts | Completed converted body HTML. |
| `page.canonicalUrl` | Bodies and layouts when `site.origin` is valid | Absolute canonical URL including the base path. |

Collection cards expose `data`, `url`, `excerpt`, and `source.path`. They do not expose another page's rendered `page.content`.

## Escaping and trusted HTML

Ordinary interpolated values are HTML-escaped:

{% raw %}
```liquid
<h1>{{ page.data.title }}</h1>
```
{% endraw %}

The `raw` filter is an identity operation and does not bypass escaping. Completed `page.content` is inserted without another escaping pass because Syncpress formed it from the body pipeline. When `markdown.raw` is true, that content can include authored HTML; Syncpress does not sanitize it. Rendered collection excerpts receive the same treatment only through the fixed `collections/*/*/excerpt` capability. No general-purpose author value becomes trusted HTML.

Ordinary Liquid output receives HTML text escaping. That escaping is not URI, CSS, or JavaScript sanitization. A template must not place unvalidated author data into `href`, `src`, inline style, or script contexts.

The [verbatim HTML page](../legal.html#escaping) displays an input containing tags, an ampersand, and quotes as text.

## Strict lookup

Context paths must be static. `collections.posts` is supported; dynamic selection such as `collections[collectionName]` is rejected. Undefined variables are errors except for a missing value tested directly by `if`, `elsif`, or `unless`, or passed as input to `default`.

{% raw %}
```liquid
{% if page.data.description %}
  <p>{{ page.data.description }}</p>
{% endif %}

<h1>{{ page.data.title | default: site.title }}</h1>
```
{% endraw %}

LiquidJS built-in tags and filters are otherwise available unless Syncpress rejects a construct needed to keep dependencies static and analyzable. Syncpress defines no author plugin interface for custom filters or tags.

## Evaluation order

For a normal Markdown page, the observable order is:

1. Merge defaults and front matter into `page.data`.
2. Fill Liquid in the authored body.
3. Convert the filled body with the selected markup profile.
4. Resolve body links and local assets.
5. Render the selected layout with completed `page.content`.
6. Resolve final layout references and apply `site.basePath`.

Relative references introduced by layouts are errors. A layout is not adjacent to a content page, so Syncpress cannot assign one unambiguous content-relative source. Use site-absolute, external, or fragment-only references in layouts.

## Template failures

Missing layouts, missing includes, recursive include trees, syntax errors, unsupported constructs, undefined variables, and evaluation failures are fatal. Diagnostics retain the named template and one-based position where available. Body errors account for front-matter lines when reporting the source location.
