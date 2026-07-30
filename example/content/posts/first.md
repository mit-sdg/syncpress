---
title: Routes begin with ordinary files
date: 2026-07-28
description: Derived paths and explicit claims make each published document predictable before a layout renders.
featured: true
topics: [routing, site-building]
---

Every routed document starts with an ordinary content path. `posts/first.md` derives `/posts/first/`, while the source-tree tour overrides its derived address with an explicit route.

<!--more-->

Collections receive this authored prefix as an excerpt before page rendering. The post card renders that conversion as trusted markup through Syncpress's fixed excerpt capability; front matter remains escaped.

[Read the build lifecycle](../about.md#build-lifecycle) for the project-level view.
