---
title: Build a Syncpress site
description: Create the required project files, render one Markdown page, and verify the static output.
featured: true
topics: [guides, site-building]
---

This tutorial covers the smallest complete Syncpress lifecycle. It uses the repository checkout because Syncpress does not currently publish a standalone package or installation command. The [user guide](../reference/configuration.md) defines the complete configuration and authoring contracts.

<h2 id="prerequisites">Prerequisites</h2>

- Bun 1.3.14 or another 1.3 release accepted by `package.json`.
- A Syncpress repository checkout with dependencies installed by `bun install`.

## Create the project boundary

Create a directory containing all four required inputs:

```text
notes/
├── site.yaml
├── content/
│   └── index.md
├── templates/
│   └── page.html
└── public/
    └── styles.css
```

`content/`, `templates/`, and `public/` must exist even when one of the directories is empty. Source entries must be regular files or directories; the host rejects symbolic links.

## Configure the site

Write `notes/site.yaml`:

```yaml
site:
  title: Engineering Notes

defaults:
  - match: "**/*.md"
    values:
      build:
        template: page.html
        markup: markdown
```

Omitted paths use `content`, `templates`, `public`, `assets`, and `dist`. Defaults apply in order. Front matter overrides every matching default.

## Add a page

Write `notes/content/index.md`:

{% raw %}
```md
---
title: System index
description: Entry points for the system documentation.
---

# {{ page.data.title }}

{{ page.data.description }}
```
{% endraw %}

Front matter is an optional strict YAML mapping fenced by exact `---` lines. Its values become `page.data`. Liquid runs before Markdown conversion, so the heading receives the front-matter title and then becomes `<h1>`.

## Add the layout

Write `notes/templates/page.html`:

{% raw %}
```liquid
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{{ page.data.title }} | {{ site.title }}</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main>{{ page.content }}</main>
  </body>
</html>
```
{% endraw %}

`page.content` is completed body HTML and is trusted in layouts. Ordinary values such as `page.data.title` are HTML-escaped. Layouts must use site-absolute, external, or fragment-only references; relative references in a layout are build errors.

Add any CSS to `notes/public/styles.css`. Every regular file below `public/` is copied unchanged to the same output-relative path.

## Build and inspect

From the Syncpress checkout, run:

```sh
bun run site build ./notes
bun run site inspect / ./notes
```

The build writes `notes/dist/index.html` and `notes/dist/styles.css`. `inspect` reports the route owner, selected template, data origins, dependencies, collection positions, outputs, and current diagnostics without replacing `dist`.

To serve successful builds and reload after source changes, run:

```sh
bun run site dev ./notes
```

The development server listens on `127.0.0.1:3000` by default. It continues to serve the last successful output after a failed rebuild.

## Features exercised by this tutorial page

The configured profile for this documentation recognizes tables, footnotes, ~~strikethrough~~, and bare addresses such as https://example.com. Raw authored HTML is enabled, so this page can render a named include inside Markdown.

| Input | Result |
| --- | --- |
| `content/index.md` | Derived route `/`, emitted as `index.html`. |
| `templates/page.html` | Layout selected by the matching default. |
| `public/styles.css` | Byte-for-byte output at `styles.css`. |

{% render "callout.html", title: "This callout is a literal-name Liquid partial rendered by the page body." %}

The footnote extension is enabled too.[^profiles]

[^profiles]: The profile is declared once in `site.yaml`; each routed Markdown page uses it through the ordered defaults.

<h2 id="verify-local-asset-handling">Verify local asset handling</h2>

<p><a class="button" href="../assets/guide.txt?format=text#checklist" download>Download the content-root checklist</a></p>

That link resolves from this source page to `content/assets/guide.txt`. Syncpress copies the file beside this page's output and applies `/field-notes/` to its final URL. [Return to the introduction](../index.md?from=guide#journal) to see the same rules applied to page links and images.

If any page, template, route, or reference is invalid, the command exits before reconciliation and leaves the preceding output tree in place. See [operations and diagnostics](../reference/operations.md) for failure categories and final-installation failures.
