# Contributing to Syncpress

This page is for changes to the Syncpress repository. It does not describe how
to use the published package; see the [documentation site](https://mit-sdg.github.io/syncpress/)
for site authoring and operation.

## Prerequisites

The repository uses Bun 1.3.14. The package declares Node.js 24 for the built
artifact, but repository scripts use Bun.

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
reviewing the resulting diff.

The repository-only `bun run site ...` command runs `src/cli.ts` directly. For
example, `bun run site build ./example` builds the documentation fixture. This
command is not part of the published package interface.

The example site is an output fixture. Changes to its authored content normally
change `tests/golden/example-site.json`; update that file only after reviewing
the built output.
