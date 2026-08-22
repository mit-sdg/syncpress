# Contributing to Syncpress

This page covers changes to the Syncpress repository. The
[documentation site](https://mit-sdg.github.io/syncpress/) covers installation,
site authoring, and operation.

## Prerequisites

Repository scripts require Bun 1.3.14. The built package supports Node.js 24.

## Verify a change

Install dependencies, regenerate derived artifacts when a concept or composition
changes, then run the repository checks:

```sh
bun install
bun run generate
bun run check
bun run principle
bun test
```

`generate` writes `generated/syncpress.md` and `generated/wire.ts` from
`generated.config.ts`. Do not edit either generated file directly. `check`
compares declared contracts with implementations, verifies generated artifacts,
runs application diagnostics, and typechecks the repository. `principle` runs
concept-level Principle tests; `test` runs the complete Bun test suite.

## Change boundaries

Add behavior at the concept that owns its invariant. Update that concept's
specification and implementation, register the concept when necessary, and
connect the behavior from `src/compositions/`. Regenerate artifacts before
reviewing the resulting diff. Concept specifications follow the
[Syncpress concept specification format](src/concepts/specification.md).

This includes work against the host. The filesystem, the network, the process,
and the clock are reached only from the concept that owns that interaction, and
`tests/architecture.test.ts` enforces it. `src/syncpress.ts` only exports the public
facade, `src/cli.ts` only starts the executable session, and composition may use
pure host projections such as `node:path` but no filesystem, network, process,
stream, signal, console, or timer effect. Those effects belong to concepts.

Host APIs alone do not determine concept boundaries. Keep effects together when
one purpose, principle, invariant, or lifecycle requires them; use registered
pure computations for application naming policy; and do not split one operation
into concepts that only forward paths or bytes through reactions.

Package-facing normalization is in `src/compositions/api.ts`; watch, serving,
and command sessions are in `src/compositions/sessions.ts`. They invoke typed
endpoints and coordinate fresh application instances, but never reach the host
directly.

## Trace an application flow

Start with the reaction export in `src/compositions/`. Assembly retains its module in the registered name: `AdmittedConfigurationIsLoaded` from `staging.ts`, for example, appears as `fullSite.staging.AdmittedConfigurationIsLoaded`. Read that entry in `generated/syncpress.md` for the expanded stages, then read each participating specification in `design/concepts/` for its action and query contract.

`generated/syncpress.md` is a static design read-back, not an execution log, and it may be stale while source changes are in progress. Run `bunx sync-engine artifacts spec --config generated.config.ts` to render the current design to standard output without writing artifacts. Run `bun run generate` before reviewing the generated diff and `bun run check` to verify source and artifacts agree.

The installed engine documentation describes the construction and semantics used here:

- `node_modules/@mit-sdg/sync-engine/docs/user/overview.md`
- `node_modules/@mit-sdg/sync-engine/docs/user/reference/semantics.md`
- `node_modules/@mit-sdg/sync-engine/docs/user/guide/read-construction.md`

Remember the application boundary while tracing. Build and inspection applications are fresh, strict, and single-use. Watching, Serving, and command applications are retained controllers; each build they coordinate still gets a fresh batch application.

The repository-only `bun run site ...` command runs `src/cli.ts` directly. For
example, `bun run site build ./example` builds the documentation fixture.

The example site is an output fixture. Changes to its authored content normally
change `tests/golden/example-site.json`; update that file only after reviewing
the built output.
