---
title: Liquid templates and page data
description: Body evaluation, layouts, includes, available values, escaping, and template restrictions.
group: guide
order: 4
topics: [templates, liquid, site-building]
---

Syncpress uses Liquid for page bodies, layouts, and named includes. Body Liquid runs before markup conversion. The selected layout runs after body references have resolved and receives the completed body as `page.content`.

## Layouts and reusable templates

Every file below `templates/` has one name: its complete templates-root-relative path. There are no reserved subdirectories. Projects may organize reusable templates under a conventional `includes/` directory and call them by literal path:

{% raw %}
```liquid
{% render "includes/header.html" %}
{% render "includes/cards/article.html", article: item %}
```
{% endraw %}

The rendered template name cannot be dynamic, absolute, or relative to the caller. `render ... with` and `render ... for` are not supported. Liquid `include`, Liquid `layout`, and `cycle` are rejected.

This page uses [`templates/guide.html`](https://github.com/mit-sdg/syncpress/blob/main/example/templates/guide.html). The shared header is [`templates/includes/header.html`](https://github.com/mit-sdg/syncpress/blob/main/example/templates/includes/header.html) and is rendered as `includes/header.html`.

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

Collection cards contain `data`, `url`, `excerpt`, and `source.path`. Rendered body content belongs to the current page's `page.content`.

## Escaping and trusted HTML

Ordinary interpolated values are HTML-escaped:

{% raw %}
```liquid
<h1>{{ page.data.title }}</h1>
```
{% endraw %}

The `raw` filter leaves its input unchanged, and ordinary output escaping still applies. Completed `page.content` is inserted as trusted HTML formed by the body pipeline. When `markdown.raw` is true, authored HTML passes through unsanitized. Rendered collection excerpts receive the same treatment through the fixed `collections/*/*/excerpt` capability. Other author values receive ordinary escaping.

Ordinary Liquid output receives HTML text escaping. URI, CSS, and JavaScript contexts require separate validation. A template must validate author data before placing it in `href`, `src`, inline style, or script contexts.

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

LiquidJS built-in tags and filters are available subject to the static-dependency restrictions above. Syncpress provides a fixed author-facing set of filters and tags.

## Evaluation order

For a normal Markdown page, the observable order is:

1. Merge defaults and front matter into `page.data`.
2. Fill Liquid in the authored body.
3. Convert the filled body with the selected markup profile.
4. Resolve body links and local assets.
5. Render the selected layout with completed `page.content`.
6. Resolve final layout references and apply `site.basePath`.

Layouts lack a content-relative source directory. Relative references introduced by layouts are errors; use site-absolute, external, or fragment-only references.

## Template failures

Missing layouts, missing includes, recursive include trees, syntax errors, unsupported constructs, undefined variables, and evaluation failures are fatal. Diagnostics retain the named template and one-based position where available. Body errors account for front-matter lines when reporting the source location.
