---
title: Assets follow references, not conventions
date: 2026-07-29
description: Local links, downloads, SVGs, and primary raster images each take an explicit output path through the build.
featured: true
topics: [assets, responsive-images]
---

The newest note appears first because the `posts` collection sorts `data.date` in descending order. Its card gets a canonical URL and source path without having access to this fully rendered article.

<!--more-->

An ordinary local download is copied under its content-root-relative path. A primary local PNG takes the responsive-image path and keeps an original fallback, while an SVG remains an ordinary copied asset. [The overview](../index.md#journal) shows both image cases in one page.
