---
title: Why build a static site generator with a sync engine?
date: 2026-07-31
description: What synchronization adds to a static build, where the design pays off, and where an ordinary pipeline remains the better choice.
featured: true
topics: [architecture, reactions, site-building]
---

A static site generator usually expresses its work as an imperative sequence that reads a directory, transforms each document, and writes another directory.

Syncpress uses synchronization when pages share routes, collections, templates, links, generated assets, and deployment files. Work that begins with one source file can affect output across the site. Publication begins after every required part of the build completes successfully.

<!--more-->

## One post, several consequences

Consider adding a Markdown post. Before it can be rendered, its front matter has to be combined with matching defaults and its route has to be claimed. Claiming the route makes the post eligible for collections, where its position may change the home page, an archive, pagination, and the feed. Links in the converted body have to be resolved against the complete route table, while a referenced image may produce an original copy plus several renditions. Only then can the layout render the final page.

On disk this began as one new file. In the published tree it may change half a dozen existing files and create several more. In Syncpress, a route collision, missing link, or failed image conversion rejects the build before reconciliation, so none of the partial result reaches the destination.

An ordered pipeline with a shared build context works well while the number of stages and shared decisions stays small. Multiple route-producing stages, contested output paths, and asynchronous branches require additional ownership and completion bookkeeping.

Syncpress assigns each contested decision to one owner. Routing handles canonical addresses and duplicate claims, while Emitting arbitrates output paths before installation. Collection ordering and page rendering have similarly narrow owners. Composition connects those owners: a reaction that resolves a Markdown link combines a resolved source path, the target's published route, and the page waiting for rewritten HTML. Filing retains file policy, and Routing retains URL policy.

Syncpress declares a short phase sequence for the points at which one complete set of results is needed by the next:

```text
settings → read → route → excerpt → collect → render → emit
```

The application waits for the reactions started in one phase to settle before it advances. Collections receive complete route data, and layouts receive fully ordered collections. These barriers reduce parallel execution in exchange for collection order, pagination, feeds, and sitemaps that are independent of reaction timing.

## Finishing is part of the model

Asynchronous build completion depends on complete bookkeeping. A forgotten promise can make unfinished work look like an empty result. Syncpress records an outcome for each routed page and deployment task, then admits publication when the phase sequence and deployment are complete, every routed page has a current result, and the build is free of errors.

The retained outcomes distinguish a completed failure from an incomplete image or reference branch. Each state points to a different fault and blocks publication.

Pages, copied files, image renditions, redirects, pagination, the sitemap, and the feed submit proposed output through Emitting. Emitting reports path collisions before completion order can select a winner.

A page stages its complete output set and commits after rendering and reference processing finish. Emitting reconciles those committed outputs after the complete site is clean and settled. A template failure during watch mode preserves the last successful site.

An application can replace an unfinished render. Once a new attempt starts, late results from the old attempt are excluded from dependency tracking, diagnostics, and completion. Composition tests cover these races. Current watch mode starts a fresh application for each build; the replacement rule covers same-application work.

The final directory swap provides process-local recovery. Process termination during the rename sequence, or failure of both installation and restoration, can leave the destination absent. The [operations reference](../reference/operations.md#build) states the filesystem assumptions.

## The SSG that exists now

Today, Syncpress is a usable, if deliberately narrow, static publisher. It reads YAML configuration, Markdown or verbatim HTML, Liquid layouts, and ordinary local assets, with support for front matter, ordered defaults, explicit and derived routes, collections, excerpts, content-relative links, responsive images, redirects, pagination, sitemaps, and Atom feeds. The [user guide](../reference/index.md) covers the full feature set.

Builds are strict. A bad local reference, malformed template, invalid image, route conflict, or output collision stops publication. The command line provides build, watch, local development, and inspection commands, while the programmatic API exposes the same operations to Node.js callers. The generated directory is ready for an ordinary static host.

Syncpress targets build-time static pages with analyzable template dependencies. Liquid partial names and context paths must be static, and the `include`, `layout`, and `cycle` tags are rejected. Pages that require request-time state, database access, or arbitrary build-time code require another system.

## Extending the composition

A new generated index could read the existing route and collection results, claim a route, render output, and submit the file through Emitting. The index would inherit the collision and publication behavior used by pages, pagination, and feeds while those features retained their current boundaries. A new reference check or image transformation can use the same composition mechanism close to the concepts whose results it combines.

A substantial addition can require changes to a concept specification and implementation, the composition that connects it to the build, generated review artifacts, and several test layers. The resulting local rule and its integration remain independently testable.

The public operational API consists of `runCli` plus the build, inspect, watch, and serve interfaces. Concept and reaction extension remains an internal repository mechanism.

## Asking why an output exists

Build logs answer questions about chronology: which file was read, which template ran, and which output was written. They are less useful when a page has the wrong title and the real question is which default supplied it, or when an unexpected partial appears somewhere in the template tree.

Syncpress retains enough information to investigate those cases. For a page, it records the origins of layered data, the selected layout and its transitive partials, collection positions, input dependencies, and the owner and digest of each output. Diagnostics can include related locations when, for example, two producers contend for one path.

`syncpress inspect` queries this information for a source page or canonical route. Inspection runs an isolated application, leaves the destination unchanged, and explains the result from records retained by the build.

## Where the design costs us

Watch mode creates a fresh application and runs a complete strict batch for each source change. Reconciliation recognizes byte-identical outputs; source transformations run again and deployment artifacts are processed serially. This design favors reproducibility over the shortest possible edit cycle.

Source-level control flow crosses concept actions, queries, and reactions. The generated assembly shows the complete route, and the inspection model explains the running application's retained state.

Use an ordinary loop for a directory of Markdown and a couple of templates. Synchronization becomes useful when several features share routes and output paths, asynchronous branches need explicit completion, failed work must preserve the previous site, and the build must explain how it reached a result. Syncpress keeps that machinery on the build side and deploys an ordinary directory of files.
