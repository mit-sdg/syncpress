# Changelog

This file records user-visible changes to Syncpress. Entries for internal
refactoring appear when documented behavior changes.

## [Unreleased]

## [0.3.0] — 2026-09-04

### Changed

- Upgraded sync-engine from beta 6 to beta 16 and migrated Syncpress's concept
  specifications and application design to the current version-1 format.
- Content-relative assets and raster fallbacks now retain their content-root-relative
  output paths instead of being flattened beside each page. Distinct assets may
  therefore share a filename, and multiple pages share one emitted copy.
- Template names now retain their complete templates-root-relative paths. The
  `includes/` directory is no longer special; existing render calls must include
  that path explicitly, such as `{% render "includes/header.html" %}`.

## [0.2.1] — 2026-08-13

### Fixed

- Allow `build --watch` and `dev --port` options to appear after site and
  destination operands.

## [0.2.0] — 2026-08-06

### Changed

- Upgraded to sync engine beta 5 and moved phase progression from the host loop
  into deferred reactions at causal-flow settlement frontiers.
- Moved every remaining host interaction into a semantic concept. Filing now
  replaces complete host-backed trees atomically; Locating observes a run's path
  plan; Watching owns change observation and failure; Serving owns preview
  publication and HTTP safety; generic Commanding owns command-line invocation,
  streams, and exit status; Holding owns process stop holds; and Emitting
  serializes destination reconciliation. Syncpress grammar, report wording,
  build sequencing, and package sessions remain application composition.
- `syncpress dev` now names the site directory as it was written on the command
  line rather than as an absolute path.
- Report project problems as build diagnostics. A missing site directory, an
  unreadable configuration, a source directory that escapes the site through a
  symbolic link, and an output directory that overlaps a source are now reported
  with every other diagnostic instead of ending the run early, and they still
  leave the previous output destination unchanged.
- Renamed concepts and actions to describe their responsibilities and effects
  directly. Notable concept names are now `Holding`, `DependencyTracking`,
  `DeliveryArbitration`, `DocumentParsing`, and `RenderTracking`.

### Added

- `BuildResult.outputDirectory`: the directory a build published into, with
  symbolic links resolved. `watchSite` already passed the same value to
  `onBuild`.

### Documentation

- Reorganized the README and documentation site around installation, authoring,
  commands, the programmatic API, and release maintenance.
- Redesigned and optimized the example documentation site.
- Added an implementation note explaining where the sync-engine architecture
  helps and what it costs.

## [0.1.0] — 2026-07-31

Initial npm release of `@mit-sdg/syncpress`.

### Added

- Static site generation from Markdown, HTML, Liquid templates, and local files.
- The `syncpress build`, `build --watch`, `dev`, and `inspect` commands.
- The `buildSite`, `inspectSite`, `watchSite`, `serveSite`, and `runCli`
  programmatic interfaces with TypeScript declarations.
- YAML configuration for defaults, content routes, collections, conversion,
  templates, images, and deployment output.
- Front matter, named Liquid partials through literal `render` tags, Markdown
  conversion, collection excerpts, local-reference rewriting, public-file
  copying, and responsive raster images.
- Deployment controls for `.nojekyll` and required not-found pages, plus
  generated sitemaps, Atom feeds, redirects, and collection pagination.
- Build diagnostics and output reconciliation that preserve the preceding
  destination when a build fails before reconciliation.
- ESM packaging for Node.js `>=24 <25` and Bun `>=1.3.14 <1.4`.

[Unreleased]: https://github.com/mit-sdg/syncpress/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/mit-sdg/syncpress/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/mit-sdg/syncpress/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/mit-sdg/syncpress/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mit-sdg/syncpress/tree/v0.1.0
