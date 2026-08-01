---
title: Content, front matter, and routes
description: Which files become pages, how page data is formed, and how canonical routes map to output files.
group: guide
order: 3
topics: [content, routing, site-building]
---

Only `.md` and `.html` files below the configured content root become documents. Other content files are local assets and are emitted only when a page references them.

## Front matter

Front matter is optional. It must start at the first byte with an exact `---` line and end at a later exact `---` line.

{% raw %}
```md
---
title: Compiler design
topics: [compilers, semantics]
build:
  template: article.html
---

# {{ page.data.title }}
```
{% endraw %}

The front-matter root must be a mapping with unique string keys. Syncpress accepts normalized JSON-like YAML values. It rejects custom tags, timestamp values, unsafe integers, non-finite numbers, malformed aliases, duplicate keys, and unclosed headers. Invalid front matter is a build error.

Resolved defaults and front matter form `page.data`. Front matter wins when the same path was supplied by a default.

## Reserved build controls

Only `build` is reserved in page data.

| Key | Behavior |
| --- | --- |
| `build.template` | Selects a layout by its template-root-relative name. The fallback is `page.html`. |
| `build.markup` | Selects `markdown` or `verbatim`. The source extension supplies the normal default. |
| `build.route` | Claims one explicit canonical route. |
| `build.publish` | Includes or withholds the document. The default is `true`. |

An unpublished document is parsed and layered while remaining outside routing, output, and collections. Links to unpublished documents are errors. This project keeps [`content/drafts/hidden.md`](https://github.com/mit-sdg/syncpress/blob/main/example/content/drafts/hidden.md) as an executable example.

## Derived routes

Without `build.route`, Syncpress removes the final extension and then removes a final `index` segment:

```text
content/index.md                 → /
content/about.md                 → /about/
content/about/index.md           → /about/
content/api/client.md            → /api/client/
```

Directory routes emit `index.html`. A canonical file route such as `/404.html` emits that file directly. Explicit routes must be canonical and site-relative. Route collisions and invalid route forms are build errors.

Front matter maps `content/about.md` to `/internals/` and the [not-found page](../not-found.html) to `/404.html`.

## Markdown and verbatim bodies

The `markdown` profile fills body Liquid and then converts Markdown to HTML. The `verbatim` profile fills Liquid but retains authored HTML as HTML. Both profiles use the same layouts and reference processing.

The [verbatim HTML example](../legal.html) demonstrates that authored tags remain markup while interpolated Liquid data remains escaped.

## Base paths

Canonical routes are independent of deployment location. Authors normally write content-relative or root-relative site references; the final HTML pass applies `site.basePath` to supported site-absolute references.

For this documentation, `/reference/content-routing/` is projected as `/syncpress/reference/content-routing/` in generated links. Syncpress applies the prefix once.

## Output ownership

Every page, copied asset, public file, generated rendition, redirect, and deployment artifact claims its output. Emitting rejects competing claims with a diagnostic that identifies the producers, and the build remains unreconciled.
