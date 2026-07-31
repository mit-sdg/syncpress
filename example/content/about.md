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

Syncpress models a site build as a finite synchronization job. The filesystem edge imports declared facts, the concept set establishes domain invariants, and composition derives publication work. No concept represents “the site generator” as a single mutable object.

This page assumes familiarity with concept design and sync-engine composition. It describes the current design rather than the engine vocabulary or a public extension API.

## Package boundary

The public npm package is `@mit-sdg/syncpress`. Its root exports the filesystem-edge operations `runCli`, `buildSite`, `inspectSite`, `watchSite`, and `serveSite` plus their public types. It does not export `buildSyncpress` or the internal application assembly. The [programmatic API reference](./reference/programmatic-api.md) defines the supported package boundary.

The package build bundles Syncpress's internal TypeScript and Markdown specifications into distribution artifacts under `dist`. Third-party runtime packages remain external package dependencies. Bundling changes distribution, not the concept boundaries or build lifecycle described below.

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

These boundaries keep filesystem policy out of content parsing and keep HTML policy out of routing. Composition can replace one cross-concept policy without giving either participating concept knowledge of the other.

[`src/concept-set.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/concept-set.ts) lists the full inventory. Individual contracts remain in [`src/concepts/*/spec.md`](https://github.com/mit-sdg/syncpress/tree/main/src/concepts); this overview does not duplicate them.

## A batch uses explicit barriers

The build sequence is declared in [`src/compositions/shared.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/shared.ts):

```text
settings → read → route → excerpt → collect → render → emit
```

The host advances a phase only after the previous announcement reaches quiescence. The barriers make completion facts explicit: every published address exists before collection cards capture URLs, and every collection is ordered before a layout reads it.

This is deliberately a batch design. It gives the composition simple global facts and deterministic ordering at the cost of rebuilding a fresh application after a source change. Watch mode schedules another strict build; it does not maintain a long-lived incremental graph.

| Phase | State established for later phases |
| --- | --- |
| `settings` | Assessed policy, conversion profiles, compiled patterns, routing base, and collection definitions. |
| `read` | Documents, templates, public-file intentions, and layered page data. |
| `route` | The complete set of authored page claims. |
| `excerpt` | Converted authored excerpts. |
| `collect` | Complete, totally ordered publication cards. |
| `render` | Settled page results and all page-owned output intentions. |
| `emit` | Redirects, pagination, sitemap, feed, and marker artifacts. |

Phasing owns progression and completion, not the work in this table. The reactions under [`src/compositions/`](https://github.com/mit-sdg/syncpress/tree/main/src/compositions) attach the work to phase outcomes.

## Complete values cross boundaries

Composition usually forms a complete value before handing it to another concept. Page contexts contain resolved site, page, and collection projections. A collection card is formed once with data, route, source path, and optional excerpt. Cataloging then owns admission and total order rather than accumulating card fields through separate actions.

This reduces partially initialized cross-concept state. It also makes the same formed values available to inspection without adding an inspection-specific store. [`src/compositions/views.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/views.ts) contains the shared views and formers for page contexts, publication cards, and operational inspection.

## Rendering is a per-page transaction

At the render barrier, each routed page begins a Depending result and an Emitting replacement attempt. The composition tracks the source and every transitive body or layout template as inputs, fills and converts the body, resolves local references, renders the layout, and performs a final reference pass.

Page output is committed only after the final scan completes. A failed transformation records a diagnostic, rejects the replacement attempt, and settles the dependency result as failed. Assets and responsive-image renditions are staged under producer claims before the page that refers to them commits.

The full chain is in [`src/compositions/render.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/render.ts), with reference and image branches in [`references.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/references.ts) and [`images.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/images.ts).

## Publication is a second transaction

Per-page commits establish intentions inside Emitting; they do not alter the destination directory. The `/site/reconcile` endpoint admits filesystem reconciliation only after:

- the phase job finished;
- no error diagnostic stands;
- deployment work completed; and
- every routed owner has a current Depending result.

This gate is defined in [`src/compositions/endpoints.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/compositions/endpoints.ts). [`src/edge/site.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/edge/site.ts) then asks Emitting to install the prepared output tree. The distinction between page attempts and whole-tree reconciliation lets independent page failures accumulate diagnostics without exposing a mixed output tree.

[Operations and diagnostics](./reference/operations.md#build) describes the filesystem failure limits of the final rename sequence.

## The host remains narrow

[`src/edge/site.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/edge/site.ts) handles work that requires the operating system: validating project boundaries, reading directory entries, staging bytes, waiting for quiescence, writing the prepared tree, and watching for changes. It does not derive routes, interpret templates, or decide whether a build is publishable.

[`src/assembly.ts`](https://github.com/mit-sdg/syncpress/blob/main/src/assembly.ts) binds the vocabulary, fresh implementations, and full-site composition. The host reaches that application through the configure and reconcile protocols in generated [`wire.ts`](https://github.com/mit-sdg/syncpress/blob/main/generated/wire.ts). This assembly is an implementation detail, not a package-root export.

## Selected composition paths

[Selected reactions](./internals/reactions.md) traces routing, rendering, image handling, deployment, and diagnostic paths. The page names only reactions that expose an important design decision; the generated [assembly read-back](https://github.com/mit-sdg/syncpress/blob/main/generated/syncpress.md) remains the complete expansion.

## Verification follows the boundaries

Concept tests establish each principle without requiring the site composition. [`tests/compositions/full-site.test.ts`](https://github.com/mit-sdg/syncpress/blob/main/tests/compositions/full-site.test.ts) tests assembled behavior, including output preservation after diagnosed failures. [`tests/golden/example-site.json`](https://github.com/mit-sdg/syncpress/blob/main/tests/golden/example-site.json) records the exact output of this documentation project.

`bun run check` compares declared contracts with implementations, verifies generated artifacts, runs application diagnostics, and typechecks the repository. `bun test` runs both concept-level and assembled tests.
