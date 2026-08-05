# Changelog

This file records user-visible changes to Syncpress. Entries for internal
refactoring appear when documented behavior changes.

## [Unreleased]

### Changed

- Upgraded to sync engine beta 5 and moved phase progression from the host loop
  into deferred reactions at causal-flow settlement frontiers.
- Moved every remaining host interaction into the concept that owns it. Reading a
  project, resolving and containing host locations, observing change, serving
  published output, reading the command line, and holding a process open until
  it is stopped are now the Scanning, Locating, Watching, Serving, Commanding,
  and Attending concepts. A build or inspection is one request that stages,
  runs, and publishes inside the application, so `buildSite` and `inspectSite`
  no longer sequence that work from outside.
- Report project problems as build diagnostics. A missing site directory, an
  unreadable configuration, a source directory that escapes the site through a
  symbolic link, and an output directory that overlaps a source are now reported
  with every other diagnostic instead of ending the run early, and they still
  leave the previous output destination unchanged.

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

[Unreleased]: https://github.com/mit-sdg/syncpress/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mit-sdg/syncpress/tree/v0.1.0
