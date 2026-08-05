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
reviewing the resulting diff.

This includes work against the host. The filesystem, the network, the process,
and the clock are reached only from the concept that owns that interaction, and
`tests/architecture.test.ts` enforces it: nothing in `src/edge/` may import a
`node:` module, and neither may composition. A host adapter assembles an
application and invokes its endpoints; anything else it would have done belongs
to a concept.

The repository-only `bun run site ...` command runs `src/cli.ts` directly. For
example, `bun run site build ./example` builds the documentation fixture.

The example site is an output fixture. Changes to its authored content normally
change `tests/golden/example-site.json`; update that file only after reviewing
the built output.
