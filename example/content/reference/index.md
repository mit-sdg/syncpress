---
title: User guide
description: Authoritative behavior for configuring, authoring, building, and deploying a Syncpress site.
topics: [reference, site-building]
---

The user guide defines the current observable authoring, command-line, and
programmatic contract. Begin with [Build a Syncpress site](../guides/getting-started.md)
for one guided lifecycle.

## Project and authoring

- [Configuration](./configuration.md) defines `site.yaml`, defaults, paths, Markdown policy, image policy, collections, and deployment settings.
- [Content, front matter, and routes](./content-routing.md) defines page admission, page data, publication controls, canonical addresses, and output ownership.
- [Liquid templates and page data](./templates.md) defines evaluation order, context values, includes, escaping, and unsupported constructs.
- [Collections and excerpts](./collections.md) defines selection, filtering, card shape, ordering, and excerpt conversion.
- [References, assets, and responsive images](./assets.md) defines scanned URL locations, local copying, public files, and raster processing.

## Running and deploying

[Commands, deployment, and diagnostics](./operations.md) defines strict builds, watch mode, the development server, inspection, generated artifacts, failure reporting, and reconciliation limits.

[Programmatic API](./programmatic-api.md) defines the package-root functions, result types, callbacks, and resource cleanup. The internal application assembly is not public API.

## Implementation documentation

The following pages describe repository implementation. They are not extension
API documentation and are not required to build a site.

[How Syncpress is built](../about.md) explains the design boundaries, batch
model, transactions, and publication gate. [Selected composition paths](../internals/reactions.md)
traces representative routing, rendering, diagnostic, deployment, and
reconciliation reactions.
