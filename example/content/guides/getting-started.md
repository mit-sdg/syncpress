---
title: Build a Syncpress site
description: Create the required project files, render one Markdown page, and verify the static output.
group: start
order: 1
featured: true
topics: [guides, site-building]
---

This introductory tutorial builds one Markdown page with a Liquid layout. It
installs the public package, creates the required files, builds the site, and
starts the development server. The [user guide](../reference/index.md) defines
the complete configuration, authoring, command-line, and programmatic contract.

<h2 id="prerequisites">Prerequisites</h2>

- Node.js `>=24 <25` and npm.
- Alternatively, Bun `>=1.3.14 <1.4` can install and run the package.

## Install Syncpress and create the project boundary

Create the project and install Syncpress as a development dependency:

```sh
mkdir notes
cd notes
npm init -y
npm install --save-dev @mit-sdg/syncpress
```

The equivalent Bun installation is `bun add --dev @mit-sdg/syncpress`.

Add all four required inputs below the `notes` project directory:

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

Write `site.yaml`:

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

Write `content/index.md`:

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

Write `templates/page.html`:

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

Add any CSS to `public/styles.css`. Every regular file below `public/` is copied unchanged to the same output-relative path.

## Build and inspect

From the `notes` directory, run the installed executable through npm:

```sh
npx syncpress build
npx syncpress inspect /
```

The build writes `dist/index.html` and `dist/styles.css`. `inspect` reports the route owner, selected template, data origins, dependencies, collection positions, outputs, and current diagnostics while leaving `dist` unchanged.

To serve successful builds and reload after source changes, run:

```sh
npx syncpress dev
```

The development server listens on `127.0.0.1:3000` by default. It continues to serve the last successful output after a failed rebuild.

## Verify local asset handling

Open this [local checklist](../assets/guide.txt?format=text#checklist). The source
file is `content/assets/guide.txt`; Syncpress copies it to `assets/guide.txt`
because the page links to it. Unreferenced content assets remain source-only.

## Next steps

For content-relative links and local files, see [references and assets](../reference/assets.md).
For front matter, routes, and publication controls, see [content and routes](../reference/content-routing.md).
If a page, template, route, or reference is invalid, the command exits before
reconciliation and leaves the preceding output tree in place. [Commands,
deployment, and diagnostics](../reference/operations.md) lists failure classes
and the limits of final output installation.
