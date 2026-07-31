---
title: Why build a static site generator with a sync engine?
date: 2026-07-31
description: What synchronization adds to a static build, where the design pays off, and where an ordinary pipeline remains the better choice.
featured: true
topics: [architecture, reactions, site-building]
---

A static site generator is usually an imperative program: it reads a directory, transforms each document, and writes another directory, with the order of operations spelled out in the control flow. A synchronization engine seems poorly matched to a job whose main steps already have an obvious order.

For a small generator, the imperative version is the obvious choice. The case becomes more interesting once pages share routes, collections, templates, links, generated assets, and deployment files, because work that begins with one source file can end up affecting output across the site. Syncpress uses synchronization to manage those relationships, and publishes only after every required part of the build has finished without error.

<!--more-->

## One post, several consequences

Consider adding a Markdown post. Before it can be rendered, its front matter has to be combined with matching defaults and its route has to be claimed. Claiming the route makes the post eligible for collections, where its position may change the home page, an archive, pagination, and the feed. Links in the converted body have to be resolved against the complete route table, while a referenced image may produce an original copy plus several renditions. Only then can the layout render the final page.

On disk this began as one new file. In the published tree it may change half a dozen existing files and create several more. In Syncpress, a route collision, missing link, or failed image conversion rejects the build before reconciliation, so none of the partial result reaches the destination.

An imperative SSG can handle all of this, and many do. The usual implementation is an ordered pipeline with a shared build context, perhaps supplemented by hooks or a dependency graph. That is a sensible design, especially while the number of stages is small. It becomes harder to reason about when several stages can create routes, when unrelated producers can claim the same output path, or when a branch of asynchronous work is not accounted for by the function that appears to finish the build.

Syncpress gives each contested decision one owner. Routing handles canonical addresses and duplicate claims, while Emitting arbitrates output paths before installing anything. Collection ordering and page rendering have similarly narrow owners. The rest is composition: a reaction that resolves a Markdown link combines a resolved source path, the target's published route, and the page waiting for the rewritten HTML. The file store does not need URL policy, and the router does not need to parse HTML.

The reaction graph does not remove ordering. Syncpress declares a short phase sequence for the points at which one complete set of results is needed by the next:

```text
settings → read → route → excerpt → collect → render → emit
```

The application waits for the reactions started in one phase to settle before it advances to the next. As a result, collections never capture half-built route data, and layouts never see collections whose order is still changing. These barriers reduce the amount of work that can run in parallel, but they also keep collection order, pagination, feeds, and sitemaps from depending on reaction timing.

## Finishing is part of the model

In a conventional asynchronous pipeline, returning from the top-level function normally means the build is done, but that conclusion is only as sound as the bookkeeping beneath it. A forgotten promise can make unfinished work look like an empty result. Syncpress records an outcome for each routed page and deployment task, then admits publication only when the phase sequence and deployment are complete, every routed page has a current result, and no error remains.

This distinguishes a page that finished with an error from one that never finished because an image or reference branch did not report back. Both prevent publication, but they point to different faults in the build.

No producer writes directly to the destination. Pages, copied files, image renditions, redirects, pagination, the sitemap, and the feed all propose their output through Emitting. If two producers choose the same path, Emitting reports the collision instead of allowing completion order to choose the winner.

A page first stages everything it intends to produce and commits that set after rendering and reference processing have finished. Those committed outputs remain internal until the site as a whole is clean and settled, at which point Emitting reconciles a complete tree with the destination. A broken template during watch mode therefore leaves the last successful site in place instead of mixing old files with a partial new build.

There is also a rule for replacing an unfinished render inside one application. Once a new attempt starts, late results from the old attempt cannot add dependencies, restore an obsolete diagnostic, or complete the replacement. Composition tests cover these races; current watch mode starts a fresh application for each build and does not use this machinery for incremental rebuilding, but the replacement rule is explicit rather than left to callback timing.

The final directory swap has a narrower guarantee than the in-memory work. It is not a durable transaction: terminating the process during the rename sequence, or having both installation and restoration fail, can leave the destination absent. Syncpress protects the published tree from normal build errors, not from every possible operating-system or process failure.

## The SSG that exists now

Today, Syncpress is a usable, if deliberately narrow, static publisher. It reads YAML configuration, Markdown or verbatim HTML, Liquid layouts, and ordinary local assets, with support for front matter, ordered defaults, explicit and derived routes, collections, excerpts, content-relative links, responsive images, redirects, pagination, sitemaps, and Atom feeds. The [user guide](../reference/index.md) covers the full feature set.

Builds are strict. A bad local reference, malformed template, invalid image, route conflict, or output collision is an error rather than a warning followed by partial publication. The command line provides build, watch, local development, and inspection commands, while the programmatic API exposes the same operations to Node.js callers. The generated directory has no Syncpress runtime and can be served by an ordinary static host.

Syncpress has no server rendering, API routes, database, executable configuration, or public plugin system. Liquid partial names and context paths must be static, and the `include`, `layout`, and `cycle` tags are rejected. These restrictions keep template dependencies analyzable, but a site that relies on arbitrary build-time code is outside the intended use case.

## Extending the composition

Suppose Syncpress needed another generated index. The new code could read the existing route and collection results, claim its own route, render its output, and submit the file through Emitting. It would inherit the same collision and publication behavior as pages, pagination, and feeds without each of those features learning about the new index. A new reference check or image transformation can be inserted in much the same way, close to the concepts whose results it combines.

Most of the new code can stay close to the decisions it depends on, but that does not make a substantial addition small. It can still touch a concept's specification and implementation, the composition that connects it to the build, generated review artifacts, and several layers of tests. Tracing one page through those reactions is plainly harder than reading a single rendering function, even though the local rule and its integration can be tested separately.

This modularity is currently internal: the public API can build, inspect, watch, and serve a site, but it does not expose the application assembly for third-party concepts or reactions, so site authors do not have a plugin interface.

## Asking why an output exists

Build logs answer questions about chronology: which file was read, which template ran, and which output was written. They are less useful when a page has the wrong title and the real question is which default supplied it, or when an unexpected partial appears somewhere in the template tree.

Syncpress retains enough information to investigate those cases. For a page, it records the origins of layered data, the selected layout and its transitive partials, collection positions, input dependencies, and the owner and digest of each output. Diagnostics can include related locations when, for example, two producers contend for one path.

`syncpress inspect` queries this information for a source page or canonical route. Inspection runs an isolated application and does not publish anything; it explains the result from the build's own records rather than from debug logging added later.

## Where the design costs us

Watch mode is not incremental: a source change creates a fresh application and runs another strict batch. Reconciliation recognizes byte-identical outputs, but every source transformation runs again and deployment artifacts are processed serially, which favors reproducibility over the shortest possible edit cycle.

The indirection is noticeable during development as well. With an imperative pipeline, a debugger can often step from parsing to rendering to writing in one call chain. Here, the path crosses concept actions, queries, and reactions, and the generated assembly is sometimes the quickest way to see the complete route. The inspection model helps with the running application, but it does not make the source-level control flow local.

For a directory of Markdown and a couple of templates, the ordinary loop remains the better implementation. The synchronization approach starts to justify its machinery when several features share routes and output paths, asynchronous branches need explicit completion, failed work must not disturb the previous site, and the build needs to explain how it reached a result. That is the boundary Syncpress is testing. All of the unusual machinery stays on the build side; what gets deployed is still just a directory of files.
