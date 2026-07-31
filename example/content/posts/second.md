---
title: Assets follow references, not conventions
date: 2026-07-29
description: Local links, downloads, SVGs, and primary raster images each take an explicit output path through the build.
featured: true
topics: [assets, responsive-images]
---

The `posts` collection sorts `data.date` in descending order, so this note appears before older entries. Its collection card contains publication data and an excerpt, not the fully rendered article.

<!--more-->

A linked download is copied next to the page that references it. A primary local PNG enters responsive-image processing and retains its original fallback; an SVG remains an ordinary copied asset. [The introduction](../index.md#recent-implementation-notes) shows both image paths.
