---
title: How Syncpress is built
description: The design boundaries, batch model, transactions, and selected composition paths behind Syncpress.
group: implementation
order: 1
featured: true
topics: [site-building, configuration]
build:
  route: /internals/
---

<h2 id="build-lifecycle">Design overview</h2>

Syncpress models a site build as a finite synchronization job. The filesystem edge imports declared facts, the concept set establishes domain invariants, and composition derives publication work across specialized concepts.

This page describes the current design for readers familiar with concept design and sync-engine composition. The user guide defines the package interface.

## Package boundary

The public npm package is `@mit-sdg/syncpress`. Its root exports the filesystem-edge operations `runCli`, `buildSite`, `inspectSite`, `watchSite`, and `serveSite` plus their public types. The [programmatic API reference](./reference/programmatic-api.md) defines their signatures, results, callbacks, and cleanup requirements.

The package build bundles Syncpress's internal TypeScript and Markdown specifications into distribution artifacts under `dist`. Third-party runtime packages remain external dependencies. The bundled distribution retains the concept boundaries and build lifecycle described below.

## Boundaries follow invariants

The concept boundaries separate decisions that can be specified and tested independently:

- Filing owns roots, path resolution, media bytes, and text decoding.
- Documenting owns front-matter and body boundaries.
- Layering owns ranked page data and provenance.
- Routing owns canonical addresses and exclusive claims.
- Templating and Converting own two different transformations: context evaluation and markup conversion.
- Referencing classifies and rewrites HTML references; Transcoding forms image renditions; Embedding forms replacement markup.
- Depending records a page's inputs and settled result.
- Emitting owns output intentions, producer contention, replacement attempts, and tree reconciliation.

Filing owns filesystem policy, Documenting owns content parsing, Referencing owns HTML reference policy, and Routing owns canonical addresses. Composition connects these policies while preserving each concept boundary.

[`src/concept-set.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/concept-set.ts) lists the full inventory, and [`src/concepts/*/spec.md`](https://github.com/mit-sdg/syncpress/tree/main/src/concepts) contains the individual contracts. This page provides the architectural overview.

Composition consists of declarative views, formers, reactions, and endpoints exported from [`src/compositions/full-site.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/full-site.ts). Assembly connects those declarations to fresh concept instances. Calling an assembled concept action records an occurrence, and matching reactions perform the cross-concept work.

## A batch uses explicit barriers

The build sequence is declared in [`src/compositions/shared.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/shared.ts):

```text
settings → read → route → excerpt → collect → render → emit
```

Deferred reactions advance a phase only after the previous announcement's causal flow reaches a settlement frontier. The barriers make completion facts explicit: every published address exists before collection cards capture URLs, and every collection is ordered before a layout reads it.

This batch design gives the composition simple global facts and deterministic ordering. Watch mode creates a fresh application and schedules another strict build after each source change.

| Phase | State established for later phases |
| --- | --- |
| `settings` | Assessed policy, conversion profiles, compiled patterns, routing base, and collection definitions. |
| `read` | Documents, templates, public-file intentions, and layered page data. |
| `route` | The complete set of authored page claims. |
| `excerpt` | Converted authored excerpts. |
| `collect` | Complete, totally ordered publication cards. |
| `render` | Settled page results and all page-owned output intentions. |
| `emit` | Redirects, pagination, sitemap, feed, and marker artifacts. |

Phasing owns progression and completion. The reactions under [`src/compositions/`](https://github.com/mit-sdg/syncpress/tree/main/src/compositions) attach the work in this table to phase outcomes.

## Complete values cross boundaries

Composition forms complete values before handing them across concept boundaries. Page contexts contain resolved site, page, and collection projections. A collection card contains data, route, source path, and an optional excerpt. Cataloging receives the complete card and owns admission and total order.

The same formed values support operational inspection through the shared views and formers in [`src/compositions/views.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/views.ts).

## Rendering is a per-page transaction

At the render barrier, each routed page begins a Depending result and an Emitting replacement attempt. The composition tracks the source and every transitive body or layout template as inputs, fills and converts the body, resolves local references, renders the layout, and performs a final reference pass.

Page output is committed only after the final scan completes. A failed transformation records a diagnostic and leaves the replacement attempt and dependency result unsettled, so the publication gate blocks reconciliation. Assets and responsive-image renditions are staged under producer claims before the page that refers to them commits.

The full chain is in [`src/compositions/render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts), with reference and image branches in [`references.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/references.ts) and [`images.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/images.ts).

## Publication is a second transaction

Per-page commits establish intentions inside Emitting. The destination changes during filesystem reconciliation, which the `/site/reconcile` endpoint admits after:

- the phase job finished;
- no error diagnostic stands;
- deployment work completed; and
- every routed owner has a current Depending result.

This gate is defined in [`src/compositions/endpoints.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/endpoints.ts). [`src/edge/site.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/edge/site.ts) invokes that endpoint after the final quiescence barrier. Separate page attempts let independent failures accumulate diagnostics while whole-tree reconciliation preserves one coherent destination.

[Operations and diagnostics](./reference/operations.md#build) describes the filesystem failure limits of the final rename sequence.

## The host remains narrow

[`src/edge/site.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/edge/site.ts) owns operating-system work: validating project boundaries, reading directory entries, encoding bytes for the application boundary, waiting for quiescence, and coordinating destination access. The `/site/stage` endpoint declaratively opens Filing roots and places decoded bytes; computations and domain concepts retain path projection, template interpretation, and publication eligibility.

[`src/assembly.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/assembly.ts) binds the vocabulary, fresh implementations, and full-site composition. The host starts the Phasing concept through that assembly, while staging, configuration, reconciliation, summaries, and inspection cross the protocols in generated [`wire.ts`](https://github.com/mit-sdg/syncpress/blob/main/generated/wire.ts). Deferred phase reactions keep the complete build in one causal flow whose root action settles only after the final frontier.

## Selected composition paths

[Selected reactions](./internals/reactions.md) traces routing, rendering, image handling, deployment, and diagnostic paths. The page names only reactions that expose an important design decision; the generated [assembly read-back](https://github.com/mit-sdg/syncpress/blob/main/generated/syncpress.md) remains the complete expansion.

## Verification follows the boundaries

Concept tests establish each principle in isolation. [`tests/compositions/full-site.test.ts`](https://github.com/mit-sdg/syncpress/blob/main/tests/compositions/full-site.test.ts) tests assembled behavior, including output preservation after diagnosed failures. [`tests/golden/example-site.json`](https://github.com/mit-sdg/syncpress/blob/main/tests/golden/example-site.json) records the exact output of this documentation project.

`bun run check` compares declared contracts with implementations, verifies generated artifacts, runs application diagnostics, and typechecks the repository. `bun test` runs both concept-level and assembled tests.
