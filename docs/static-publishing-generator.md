# Syncpress Progress Tracker

## Scope

**Target.** Compose the registered Syncpress concepts into a deterministic static
publisher that transforms a local project into one reconciled output tree.

**Non-goals.** SSR or API routes, databases and authentication, remote content
synchronization, and a plugin platform. This is a delivery tracker, not the
product specification or a configuration-schema reference.

## Contract Authority

`src/concepts/*/spec.md` and `generated/syncpress.md` define the contracts. This
tracker records the current composition only; those sources win on disagreement.

## Current Build

```sh
bun run site build <site-directory> <output-directory>
```

The site directory contains `site.yaml`, `content/`, `templates/`, and `public/`
by default. `templates/includes/` holds Liquid partials addressed by their path
below `includes/`. `example/` is the executable source project; its exact output
tree is pinned by `tests/golden/example-site.json`.

The batch host stages source roots deterministically, rejects symlinks and
non-regular entries, keeps configured roots inside the project, rejects output
overlap, and drives a fresh phase sequence for each build. A clean successful
build is reconciled atomically. An error leaves the previous destination intact.

## Composition Status

| Status | Milestone | Current reactions and behavior | Evidence |
| --- | --- | --- | --- |
| [x] | Project settings and pages | `settings.ts`, `sources.ts`, and `routes.ts` load YAML, compile selectors, layer defaults/front matter, select publication, and claim derived or explicit routes. | Golden build; malformed front matter and invalid settings/route diagnostics. |
| [x] | Templates and profiles | `sources.ts` defines layouts and includes; `render.ts` fills authored Liquid, converts Markdown or verbatim HTML, and renders a selected layout with only `page.content` trusted. | Example Markdown/HTML pages and Liquid partials. |
| [x] | Collections | `collections.ts` builds stable cards, filters configured rules, sorts through `Collecting`, and supplies the catalog before page rendering. | Example post navigation orders newest first. |
| [x] | References and assets | `references.ts` retargets local routed pages, copies referenced local assets, preserves query/fragment suffixes, applies the base path in the layout pass, and blocks unresolved or unpublished-document references. | Golden links/downloads plus strict failure tests. |
| [x] | Raster images | `images.ts` validates and renders local primary raster images, stages fallback/derived files, and replaces the element only after `Embedding` is complete. | Golden `<picture>` output and byte hashes. |
| [x] | Strict batch lifecycle | `Phasing`, `Depending`, `Diagnosing`, and `Emitting` gate one-shot publication. Every routed page must settle before reconciliation. | Rebuild, stale-output removal, and prior-tree preservation tests. |
| [ ] | Incremental watch and dev server | Reuse dependency state across file changes, retain individual last-known-good pages, and serve output locally. | Requires a long-lived host and file watcher. |
| [ ] | Inspect interface | Report routes, layers, collection memberships, dependency reasons, and standing diagnostics. | Requires formers/endpoints for the assembled model. |

## Deliberate Limits

- Configuration is read through `Configuring`, but product-level schema validation
  remains intentionally narrow. Invalid values reached by a concept become a
  diagnostic; richer field-specific validation is future work.
- The supported HTML-reference inventory is exactly `Referencing`'s inventory.
  CSS URLs, SVG-internal URLs, form actions, and other unsupported attributes are
  not resolved.
- `Referencing` exposes image alt text but not authored safe image attributes, so
  responsive-image replacement currently preserves alt, dimensions, lazy loading,
  decoding, and a safe URL suffix, not arbitrary `class`, `sizes`, or `data-*`.
- Collection excerpts are authored-body conversions. They stay escaped when
  rendered through a collection card because dynamic trusted paths are not a
  current `Templating` contract.

## Completion Gate

Mark work complete only when its reactions are composed, generated artifacts are
current, a composition-level test covers it, and `bun run check` passes.
