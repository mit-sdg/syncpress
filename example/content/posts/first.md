---
title: Routes begin with ordinary files
date: 2026-07-28
description: Derived paths and explicit claims make each published document predictable before a layout renders.
featured: true
topics: [routing, site-building]
---

Every routed document begins as a file below the content root. `posts/first.md` derives `/posts/first/`; a page can instead claim an explicit route in front matter.

<!--more-->

Syncpress extracts this authored prefix as the collection excerpt before rendering the complete page. The post card may render the converted excerpt as trusted markup, while ordinary front-matter values remain escaped.

[Read the build lifecycle](../about.md#build-lifecycle) for the project-level view.
