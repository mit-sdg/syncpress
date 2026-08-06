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

Syncpress models a site build as a finite synchronization job. Concepts own every fact and every effect, including the host ones; composition derives publication work across them; and the package root is a thin adapter that creates batch or controller applications for the requested operation.

This page describes the current design for readers familiar with concept design and sync-engine composition. The user guide defines the package interface.

## Package boundary

The public npm package is `@mit-sdg/syncpress`. Its root exports the filesystem-edge operations `runCli`, `buildSite`, `inspectSite`, `watchSite`, and `serveSite` plus their public types. The [programmatic API reference](./reference/programmatic-api.md) defines their signatures, results, callbacks, and cleanup requirements.

The package build bundles Syncpress's internal TypeScript and Markdown specifications into distribution artifacts under `dist`. Third-party runtime packages remain external dependencies. The bundled distribution retains the concept boundaries and build lifecycle described below.

## Boundaries follow invariants

The concept boundaries separate decisions that can be specified and tested independently:

- Filing owns atomic host-tree loading, logical roots, path resolution, media bytes, and text decoding.
- DocumentParsing owns front-matter and body boundaries.
- Layering owns ranked page data and provenance.
- Routing owns canonical addresses and exclusive claims.
- Templating and Converting own two different transformations: context evaluation and markup conversion.
- Referencing classifies and rewrites HTML references; Transcoding forms image renditions; Embedding forms replacement markup.
- DependencyTracking records a page's inputs and settled result.
- Emitting owns output intentions, producer contention, replacement attempts, and tree reconciliation.

Filing owns filesystem policy, DocumentParsing owns content parsing, Referencing owns HTML reference policy, and Routing owns canonical addresses. Composition connects these policies while preserving each concept boundary.

[`src/concept-set.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/concept-set.ts) lists the full inventory, and [`src/concepts/*/spec.md`](https://github.com/mit-sdg/syncpress/tree/main/src/concepts) contains the individual contracts. This page provides the architectural overview.

Composition consists of declarative views, formers, reactions, and endpoints exported from [`src/compositions/full-site.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/full-site.ts). Assembly connects those declarations to fresh concept instances. Calling an assembled concept action records an occurrence, and matching reactions perform the cross-concept work.

## Application lifetime

A batch build or inspection application is fresh and single-use by Syncpress policy. Concept state and retained occurrences belong to that application, and a Deploying instance owns only one deployment attempt. A failed batch may answer one read-only site summary before being discarded, but Syncpress never reuses that application for another build.

| Public operation | Application lifetime |
| --- | --- |
| `buildSite` | One fresh application for one `/site/build` job. |
| `inspectSite` | One fresh application for one `/site/inspect` job. |
| `watchSite` | A retained Watching controller; its initial build and every rebuild use separate fresh batch applications. |
| `serveSite` | A retained Serving controller plus the watch topology; builds remain fresh batches. |
| `runCli` | A retained command controller for the invocation; the selected operation creates its own applications. |

Single-use therefore describes strict batch applications, not every assembly. Watching, Serving, and command controllers intentionally accept repeated calls until closed. Fresh Emitting instances still serialize reconciliation to the same destination within one process.

## A batch uses explicit barriers

The build sequence is declared in [`src/compositions/shared.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/shared.ts):

```text
locate → stage → settings → read → route → excerpt → collect → render → emit
```

Deferred reactions advance a phase only after the previous announcement's causal flow reaches a settlement frontier. The barriers make completion facts explicit: every published address exists before collection cards capture URLs, and every collection is ordered before a layout reads it.

This batch design gives the composition simple global facts and deterministic ordering. Watch mode retains only its controller and schedules a fresh strict batch after each source change.

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

The same formed values support operational inspection through focused formers in [`src/compositions/inspection.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/inspection.ts).

## RenderTracking is a per-page transaction

At the render barrier, each routed page begins a DependencyTracking result and an Emitting replacement attempt. The composition tracks the source and every transitive body or layout template as inputs, fills and converts the body, resolves local references, renders the layout, and performs a final reference pass.

Page output is committed only after the final scan completes. A failed transformation records a diagnostic, marks the rendering failed, aborts staged replacement output, and abandons provisional dependency inputs while retaining the last settled graph. The diagnostic blocks reconciliation. Assets and responsive-image renditions are staged under producer claims before the page that refers to them commits.

The full chain is in [`src/compositions/render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts), with reference and image branches in [`references.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/references.ts) and [`images.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/images.ts).

## Publication is a second transaction

Per-page commits establish intentions inside Emitting. The destination changes during filesystem reconciliation, which the `/site/reconcile` endpoint admits after:

- the phase job finished;
- no error diagnostic stands;
- deployment work completed; and
- every routed owner has a current DependencyTracking result.

This gate is defined in [`src/compositions/endpoints.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/endpoints.ts), as the branch `/site/build` takes at the settlement frontier where its phase job reaches a terminal state. Separate page attempts let independent failures accumulate diagnostics while whole-tree reconciliation preserves one coherent destination.

[Operations and diagnostics](./reference/operations.md#build) describes the filesystem failure limits of the final rename sequence.

## Host work belongs to concepts

Every interaction with the operating system is owned by the concept whose purpose it serves. [Locating](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/locating/spec.md) observes requested host locations and their resolution-time containment. [Filing](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/filing/spec.md) reads a complete candidate tree before replacing its logical root. [Emitting](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/emitting/spec.md) writes and serializes destination reconciliation. [Watching](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/watching/spec.md) owns settled change observation, [Serving](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/serving/spec.md) owns safe preview responses and reload publication, generic [Commanding](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/commanding/spec.md) owns invocation words, operator streams, and exit status, and [Holding](https://github.com/mit-sdg/syncpress/blob/main/src/concepts/holding/spec.md) owns process stop holds.

[`src/syncpress.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/syncpress.ts) is therefore only the two-line public export surface, while [`src/cli.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/cli.ts) only starts an executable session. Package normalization and cross-runtime sessions live under `src/compositions/`, where they assemble applications and invoke endpoints typed by generated [`wire.ts`](https://github.com/mit-sdg/syncpress/blob/main/generated/wire.ts) without reaching the host directly. [`commanding.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/commanding.ts) maps Syncpress grammar onto the generic command selection through registered computations. A repository test enforces these boundaries. Deferred phase reactions keep a complete build in one causal flow and make its terminal application decision inside composition.

## Selected composition paths

[Selected reactions](./internals/reactions.md) traces routing, rendering, image handling, deployment, and diagnostic paths. The page names only reactions that expose an important design decision; the generated [assembly read-back](https://github.com/mit-sdg/syncpress/blob/main/generated/syncpress.md) remains the complete expansion.

## Verification follows the boundaries

Concept tests establish each principle in isolation. [`tests/compositions/full-site.test.ts`](https://github.com/mit-sdg/syncpress/blob/main/tests/compositions/full-site.test.ts) tests assembled behavior, including output preservation after diagnosed failures. [`tests/golden/example-site.json`](https://github.com/mit-sdg/syncpress/blob/main/tests/golden/example-site.json) records the exact output of this documentation project.

`bun run check` compares declared contracts with implementations, verifies generated artifacts, runs application diagnostics, and typechecks the repository. `bun test` runs both concept-level and assembled tests.
