---
title: Selected composition paths
description: Representative reaction chains that show how Syncpress routes, renders, diagnoses, and publishes work.
group: implementation
order: 2
topics: [architecture, reactions, concepts]
---

This page assumes knowledge of sync-engine actions, queries, views, formers, causality, and endpoint composition. It traces selected paths where reaction structure expresses a Syncpress design choice. The generated assembly provides the complete reaction index.

## Explicit and derived routes

[`src/compositions/routes.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/routes.ts) gives explicit page policy priority over convention.

When the route phase advances, a published page with `build.route` asks Routing to claim that address. Routing derives an address from the content path when the page has no explicit value. A page with `build.publish: false` is withheld from routing.

The alternatives are separate reactions because “no explicit route” is a current-state condition, while participation in the route phase is causal evidence. Routing refusals become source-located diagnostics, allowing unrelated route failures to accumulate before reconciliation is refused.

## Body before layout

The render composition uses reference completion as the boundary between body and layout work:

```text
begin dependency result
→ open output replacement attempt
→ retract stale source diagnostics
→ fill body Liquid
→ convert markup
→ scan and resolve body references
→ render selected layout with completed page.content
→ scan final layout references
→ commit page output
→ settle dependency result
```

The chain is distributed across [`render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts), [`references.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/references.ts), and [`images.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/images.ts).

The body scan must complete before layout rendering because `page.content` includes retargeted page links and completed local embeddings. The final scan has a different policy: layouts may contain site-absolute or external references, but a relative layout reference is diagnosed because no content-relative source directory can be assigned to it.

Originated and unoriginated contexts are distinct alternatives. When `site.origin` exists, the context includes `page.canonicalUrl`. When `site.origin` is absent, the context omits that key.

## Local files fork by role and bytes

A resolved body reference to another document is answered with the routed address. A resolved reference to an unrouted local file first claims an output beside the page.

Primary raster image references then take a longer path. Filename matching admits the reference to Transcoding, byte inspection establishes the actual format and dimensions, configured renditions are staged under digest-derived names, and Embedding forms the final `<picture>`. The reference is answered only after every promised rendition and the exact fallback have output intentions.

Other local files, including SVG images, take the ordinary copy path. Both branches use the same Emitting producer claims, which turn collisions with public files or page output into diagnostics.

## Diagnostics are part of settlement

Expected domain failures are translated into Diagnosing actions near the reaction that has the necessary source evidence. Template selection failures know the page path; configuration assessment knows the YAML node; route contention knows both producers.

A render diagnostic leaves the active Emitting attempt and Depending result unsettled. The error diagnostic and unsettled routed owner both make the build ineligible for publication.

The relevant terminal reactions are near the end of [`src/compositions/render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts). Diagnostic ordering and source data remain owned by [Diagnosing](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/diagnosing/spec.md).

## Deployment is serialized deliberately

[`src/compositions/deployment.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/deployment.ts) starts one ordered Deploying queue during the emit phase. Redirects, pagination pages, the sitemap, the feed, and marker files are prepared one item at a time.

The queue gives generated route claims deterministic priority and lets later artifacts observe earlier generated work. Pagination routes therefore exist before sitemap formation. A failed item is diagnosed and terminated before the queue advances; deployment reaches `completed` only after every item has a terminal result.

Serial deployment reduces parallel generation and makes route and output collision results independent of reaction scheduling.

## One request is one build

[`src/compositions/endpoints.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/endpoints.ts) receives `/site/build`, records what the caller wants through Locating, declares and starts the phase sequence, and then holds its answer for a settlement frontier. Its conditions are re-read at every frontier of that flow, so the answer is chosen at the first frontier where the job has reached a terminal state.

That choice is the publication predicate: the finished-and-clean branch asks Emitting to reconcile and returns file counts, while the errored, incomplete, and failed branches return a build error and leave the destination unchanged. Nothing outside the application decides when a build may publish.

## Staging is a phase, not a caller

[`src/compositions/staging.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/staging.ts) brings the host project into the model in two phases. The locate phase grounds the recorded site directory, admits `site.yaml` beside it, reads it through Scanning, files it, and assesses it. The stage phase admits every configured location, surveys the ones that stay inside the site, reads their entries, and files them under matching Filing roots.

Every host refusal along that path becomes a Diagnosing report rather than a failed request, so an unreadable directory, an escaping symbolic link, and an unparsable configuration all fail the same way: the build finishes, the publication predicate refuses it, and the caller receives every reason at once.

## Reading the complete assembly

Use the source composition for intent and [`generated/syncpress.md`](https://github.com/mit-sdg/syncpress/blob/main/generated/syncpress.md) for the expanded assembly. Generated files are review artifacts; changes begin in concept specifications, implementations, views, formers, reactions, or endpoints and are propagated with `bun run generate`.
