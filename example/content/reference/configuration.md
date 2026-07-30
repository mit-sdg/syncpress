---
title: Configuration reference
description: The site.yaml schema, path defaults, ordered page defaults, Markdown profiles, image policy, collections, and deployment settings.
topics: [configuration, site-building]
---

`site.yaml` is the required project policy file. It is parsed as YAML 1.2, its root must be a mapping, and configuration errors are reported with line and column coordinates before source staging begins.

The accepted top-level keys are `site`, `paths`, `defaults`, `collections`, `images`, `markdown`, and `deploy`. Unknown top-level, `paths`, and `deploy` keys are errors. Values below `site` and `defaults[].values` are author data unless a documented Syncpress control interprets them.

## Complete shape

```yaml
site:
  title: Engineering Notes
  origin: https://docs.example.com
  basePath: /notes/

paths:
  content: content
  templates: templates
  public: public
  assets: assets
  output: dist

defaults:
  - match: "**/*.md"
    values:
      build:
        template: page.html
        markup: markdown
        publish: true

collections:
  articles:
    match: "articles/**/*.md"
    where:
      field: data.status
      equals: published
    sort:
      by: data.date
      order: desc

markdown:
  extensions: [tables, footnotes, strikethrough, autolinks]
  raw: true
  excerptSeparator: "<!--more-->"

images:
  widths: [480, 960, 1440]
  formats: [avif, webp, original]

deploy:
  nojekyll: true
  requireNotFound: true
  sitemap: true
```

## `site`

The complete `site` mapping is available to Liquid as `site`. Syncpress additionally interprets:

| Key | Meaning |
| --- | --- |
| `basePath` | Canonical directory address projected onto supported site-absolute references in final HTML. It must begin and end with `/`; the default is `/`. |
| `origin` | Exact HTTP(S) origin used for canonical URLs, sitemap entries, and Atom feed identifiers. It cannot contain credentials, a path, query, or fragment. A trailing `/` is accepted and normalized away. Sitemap and feed generation require it. |

Other keys have no built-in meaning. A layout can read `site.title`, `site.navigation`, or any other configured value by its static member path.

## `paths`

| Key | Default | Use |
| --- | --- | --- |
| `content` | `content` | Markdown, HTML, and content-relative assets. |
| `templates` | `templates` | Layouts and the `includes/` subtree. |
| `public` | `public` | Files copied unchanged. |
| `assets` | `assets` | Output prefix for generated image renditions. |
| `output` | `dist` | Destination used when the CLI receives no explicit destination. |

Configured paths are portable, project-relative paths. They cannot contain `.` or `..` segments, backslashes, empty segments, drive prefixes, or control characters. The configured source roots and output must remain inside the project and must not overlap. An explicit CLI output path may be outside the project, but it still may not overlap source input.

## `defaults`

Each rule matches a content-root-relative path. Rules apply in written order. Mapping values merge recursively; a later scalar or sequence replaces the earlier value. Front matter has the highest rank and wins over every default.

```yaml
defaults:
  - match: "**/*.md"
    values:
      section: Documentation
      build: { template: page.html, markup: markdown }
  - match: "api/**/*.md"
    values:
      section: API reference
      build: { template: api.html }
```

For `api/client.md`, the second rule retains `build.markup: markdown`, replaces `build.template`, and replaces `section`.

Patterns are case-sensitive and match the complete slash-separated relative path. The matcher supports `*`, `**`, character classes, braces, and extglobs. Dotfiles participate in matching.

## `markdown`

`extensions` accepts `tables`, `footnotes`, `strikethrough`, and `autolinks`. All four are enabled by default. `raw` controls whether authored HTML remains markup; the default is `true`. When `raw` is `false`, authored HTML is escaped.

`excerptSeparator` marks the end of a collection excerpt in an authored body. The default separator is empty, which disables excerpts. Excerpt extraction occurs before body Liquid evaluation.

## `images`

`widths` contains positive target widths. The defaults are 480, 960, and 1440 pixels. A rendition is not generated above the source's oriented width.

`formats` accepts `avif`, `gif`, `jpeg` or its `jpg` alias, `png`, `webp`, and the `original` sentinel. The defaults are `avif`, `webp`, and `original`. The exact original fallback is always present, even when `original` is omitted. Syncpress also generates smaller source-format renditions when the source encoder supports them. A requested format that cannot preserve an animated source is omitted. See [assets and responsive images](./assets.md).

## `collections`

Each collection requires `match`. `where` is optional and accepts exactly one of `equals`, `contains`, or `exists: true`. `sort.by` names a dotted collection-card field and `sort.order` is `asc` or `desc`; ascending is the default.

See [collections and excerpts](./collections.md) for card data, ordering, and Liquid access.

## `deploy`

| Key | Effect |
| --- | --- |
| `nojekyll` | Emit an empty `.nojekyll`. |
| `requireNotFound` | Require an authored page claiming `/404.html`. |
| `sitemap` | Emit `sitemap.xml`; requires `site.origin`. |
| `feed` | Emit an Atom feed from one configured collection, or `false` to disable it. |
| `redirects` | Map canonical routes to canonical site routes or HTTP(S) URLs. |
| `pagination` | Generate routed pages over a collection. |

See [commands and deployment](./operations.md) for feed, redirect, and pagination requirements.

## Validation failures

Independent configuration problems are accumulated and reported together. A configuration failure prevents source staging and leaves the previous output destination unchanged. Unknown top-level keys and unknown keys below `paths` or `deploy` are errors. The current validator may ignore unknown keys in other nested product mappings. Do not use unlisted nested keys as an extension mechanism; they have no defined behavior.

The executable configuration for this documentation is [`example/site.yaml`](https://github.com/mit-sdg/syncpress/blob/main/example/site.yaml).
