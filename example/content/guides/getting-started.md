---
title: Build the field guide
description: A compact walkthrough of the project boundary, Markdown profile, includes, and local references.
featured: true
topics: [guides, site-building]
---

## Install

Create `site.yaml`, `content/`, `templates/`, and `public/`. Then build this project with `bun run site build example /tmp/syncpress-field-notes`. The destination is reconciled only after every routed page and referenced file has completed successfully.

## Markdown, Liquid, and HTML

The configured profile recognizes tables, footnotes, ~~strikethrough~~, and bare addresses such as https://example.com. It also keeps authored HTML, which lets a named include sit naturally inside Markdown.

| Authoring input | What Syncpress does |
| --- | --- |
| Markdown links | Retargets local pages to canonical routes. |
| Local downloads | Copies the source asset and preserves safe query and fragment suffixes. |
| Liquid output | Escapes ordinary data before Markdown conversion. |

{% render "callout.html", title: "A reusable include inside Markdown" %}

The footnote extension is enabled too.[^profiles]

[^profiles]: The profile is declared once in `site.yaml`; each routed Markdown page uses it through the ordered defaults.

## Keep references local

<p><a class="button" href="../assets/guide.txt?format=text#checklist" download>Download the content-root checklist</a></p>

That link starts beside this guide, so Syncpress copies `content/assets/guide.txt` to a stable output path and rebases it under `/field-notes/`. [Return to the overview](../index.md?from=guide#journal) to see the same rules applied to page links and images.
