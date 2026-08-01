---
title: Selected composition paths
description: Representative reaction chains that show how Syncpress routes, renders, diagnoses, and publishes work.
group: implementation
order: 2
topics: [architecture, reactions, concepts]
---

This page assumes knowledge of sync-engine actions, queries, views, formers, causality, and endpoint composition. It follows selected paths where the reaction structure expresses a Syncpress design choice. It is not a reaction-by-reaction index.

## Explicit and derived routes

[`src/compositions/routes.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/routes.ts) gives explicit page policy priority over convention.

When the route phase advances, a published page with `build.route` asks Routing to claim that address. A published page with no explicit value asks Routing to derive an address from its content path. A page with `build.publish: false` is released instead of routed.

The alternatives are separate reactions because “no explicit route” is a current-state condition, while participation in the route phase is causal evidence. Routing refusals do not terminate the reaction engine. They become source-located diagnostics, allowing unrelated route failures to accumulate before reconciliation is refused.

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

Originated and unoriginated contexts are distinct alternatives. When `site.origin` exists, the former includes `page.canonicalUrl`; the latter omits the key rather than supplying an invented or null canonical URL.

## Local files fork by role and bytes

A resolved body reference to another document is answered with the routed address. A resolved reference to an unrouted local file first claims an output beside the page.

Primary raster image references then take a longer path. Filename matching admits the reference to Transcoding, byte inspection establishes the actual format and dimensions, configured renditions are staged under digest-derived names, and Embedding forms the final `<picture>`. The reference is answered only after every promised rendition and the exact fallback have output intentions.

Other local files, including SVG images, take the ordinary copy path. Both branches use the same Emitting producer claims, so an image optimization cannot silently overwrite a public file or another page's output.

## Diagnostics are part of settlement

Expected domain failures are translated into Diagnosing actions near the reaction that has the necessary source evidence. Template selection failures know the page path; configuration assessment knows the YAML node; route contention knows both producers.

The render chain does not treat a diagnostic as page completion. Failure reactions report the problem but leave the active Emitting attempt and Depending result unsettled. The error diagnostic and unsettled routed owner both make the build ineligible for publication.

The relevant terminal reactions are near the end of [`src/compositions/render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts). Diagnostic ordering and source data remain owned by [Diagnosing](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/diagnosing/spec.md).

## Deployment is serialized deliberately

[`src/compositions/deployment.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/deployment.ts) starts one ordered Deploying queue during the emit phase. Redirects, pagination pages, the sitemap, the feed, and marker files are prepared one item at a time.

The queue gives generated route claims deterministic priority and lets later artifacts observe earlier generated work. Pagination routes therefore exist before sitemap formation. A failed item is diagnosed and terminated before the queue advances; deployment reaches `completed` only after every item has a terminal result.

This ordering is stricter than parallel generation, but it avoids making route and output collision results depend on reaction scheduling.

## Reconciliation is an endpoint alternative

[`src/compositions/endpoints.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/endpoints.ts) does not expose Emitting reconciliation directly. The endpoint selects among finished-and-clean, incomplete, failed, unsettled, deployment-incomplete, and diagnosed-error alternatives.

Only the finished-and-clean branch asks Emitting to reconcile and returns file counts. The other branches return a build error without publishing. The host therefore does not reproduce the publication predicate in imperative code.

## Reading the complete assembly

Use the source composition for intent and [`generated/syncpress.md`](https://github.com/mit-sdg/syncpress/blob/main/generated/syncpress.md) for the expanded assembly. Generated files are review artifacts; changes begin in concept specifications, implementations, views, formers, reactions, or endpoints and are propagated with `bun run generate`.
