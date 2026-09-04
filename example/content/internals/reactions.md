---
title: Selected composition paths
description: Representative reaction chains that show how Syncpress routes, renders, diagnoses, and publishes work.
group: implementation
order: 2
topics: [architecture, reactions, concepts]
---

This page assumes knowledge of sync-engine actions, queries, views, formers, causality, and endpoint composition. It traces selected paths where reaction structure expresses a Syncpress design choice. The generated assembly provides the complete reaction index.

## Reading a reaction locally

[`src/concepts.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/concepts.ts) declares the inert concept and computation references used while authoring composition. In a reaction, `when(action(...).responds(...))` observes a successful returned action occurrence, while `.refuses(...)` observes a declared refusal. A variable first binds where it appears; reusing that variable, or using a literal, tests the occurrence or current state. `where(...)` asks views and concept queries without changing state, and `then(...)` asks the next action.

Later stages of one declaration appear in the generated read-back as `#2`, `#3`, and so on. Named alternatives add `:name`. Alternatives are independently eligible: their conditions must partition the cases rather than relying on registration order. `earlier(...)` requires causal evidence from the same flow, while `.afterFlowSettles()` waits for the current flow's ordinary work to reach a settlement frontier. It does not wait for the whole application to become idle.

Reaction exports are grouped by composition module. For example, `AdmittedConfigurationIsLoaded` in [`src/compositions/staging.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/staging.ts) appears as `fullSite.staging.AdmittedConfigurationIsLoaded`. Read the source export for intent, its module-qualified entry in `generated/syncpress.md` for the expanded construction, and the participating specifications in `design/concepts/` for action and query contracts.

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

A resolved body reference to another document is answered with the routed address. A resolved reference to an unrouted local file first claims its content-root-relative output path.

Primary raster image references then take a longer path. Filename matching admits the reference to Transcoding, byte inspection establishes the actual format and dimensions, configured renditions are staged under digest-derived names, and Embedding forms the final `<picture>`. The reference is answered only after every promised rendition and the exact fallback have output intentions.

Other local files, including SVG images, take the ordinary copy path. Both branches use the same Emitting producer claims, which turn collisions with public files or page output into diagnostics.

## Diagnostics are part of settlement

Expected domain failures are translated into Diagnosing actions near the reaction that has the necessary source evidence. Template selection failures know the page path; configuration assessment knows the YAML node; route contention knows both producers.

A render diagnostic marks the rendering failed. Cleanup waits until already-qualified work in that flow settles, then independently aborts staged output and abandons provisional dependency inputs. Phase progression remains blocked while either failed owner-local attempt is still open.

The relevant terminal reactions are near the end of [`src/compositions/render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts). Diagnostic ordering and source data remain owned by [Diagnosing](https://github.com/mit-sdg/syncpress/blob/main/design/concepts/Diagnosing.md).

## Deployment is serialized deliberately

[`src/compositions/deployment.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/deployment.ts) starts one ordered Deploying queue during the emit phase. Redirects, pagination pages, the sitemap, the feed, and marker files are prepared one item at a time.

The queue gives generated route claims deterministic priority and lets later artifacts observe earlier generated work. Pagination routes therefore exist before sitemap formation. A failed item is diagnosed and terminated before the queue advances; deployment reaches `completed` only after every item has a terminal result.

Serial deployment reduces parallel generation and makes route and output collision results independent of reaction scheduling.

## One request is one build

[`src/compositions/endpoints.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/endpoints.ts) receives `/site/build`, records what the caller wants through Locating, declares and starts the phase sequence, and then holds its answer for a settlement frontier. Its conditions are re-read at every frontier of that flow, so the answer is chosen at the first frontier where the job has reached a terminal state.

That choice is the publication predicate: the finished-and-clean branch asks Emitting to reconcile and returns file counts, while the errored, incomplete, and failed branches return a build error and leave the destination unchanged. Nothing outside the application decides when a build may publish.

DeliveryArbitration arbitrates that deferred aggregate answer against direct refusals and runtime faults in the same build flow. A direct boundary answer interrupts aggregate delivery; a clean terminal flow settles delivery exactly once before selecting an endpoint branch.

## Staging is a phase, not a caller

[`src/compositions/staging.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/staging.ts) brings the host project into the model in two phases. The locate phase grounds the recorded site directory, admits `site.yaml`, asks Filing to load it as one singleton tree, and assesses it. The stage phase admits every configured location and asks Filing once per source to read a complete candidate tree before replacing that logical root.

Expected host problems along that path are returned outcomes rather than refusals and become Diagnosing reports. An unreadable directory, an escaping symbolic link, and an unparsable configuration therefore finish staging without a partial Filing replacement, block publication, and let the caller receive every accumulated reason.

## Reading the complete assembly

Use the source composition for intent and [`generated/syncpress.md`](https://github.com/mit-sdg/syncpress/blob/main/generated/syncpress.md) for the expanded assembly. The read-back is a static design expansion, not a chronological runtime log, and it is authoritative only after artifact generation succeeds. Generated files are review artifacts; changes begin in concept specifications, implementations, views, formers, reactions, or endpoints and are propagated with `bun run generate`.
