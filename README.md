# Syncpress

Syncpress is a deterministic static publishing generator built as independently
specified sync-engine concepts and phased composition reactions. The product and
architecture are specified in [the design document](docs/static-publishing-generator.md).

## Install and run

```sh
bun install
bun run generate
bun run check
bun run principle
```

`generate` writes `generated/syncpress.md` and `generated/wire.ts`. `check`
compares parsed action and query declarations with the class source, checks both
generated files, runs application diagnostics, and typechecks the project.
`principle` runs every concept's direct Principle test without an assembly.

## Initial CLI

The first runnable composition builds Markdown files with YAML front matter into
HTML using one fixed page layout. It is deliberately narrow while the rest of
the SSG composition is built out: no configuration file, assets, collections,
or watch mode yet.

```sh
bun run site --help
bun run site build ./content ./dist
```

`index.md` becomes `dist/index.html`; `about.md` becomes
`dist/about/index.html`. The composition is in `src/compositions/minimal-site.ts`.

A concept's State section is optional uninterpreted human notation. It is not a
schema, is not compared with class fields or storage, and does not enter
generated artifacts or endpoint validators. Establish its properties in
principle, implementation, and backend constraint tests.

Use these commands to isolate a failed check:

```sh
bun run typecheck
bunx sync-engine check --config generated.config.ts
bunx sync-engine artifacts check
```

## Add a behavior

1. Add `src/concepts/<name>/spec.md`, its class, a principle test, and a
   `registry.ts` mapping every declared refusal code to an `Error` class.
2. Add the registration to `src/concept-set.ts`.
3. Connect the concept in `src/compositions/` with reactions, views, formers,
   or endpoints.
4. Run `bun run generate`, review both generated files, and run
   `bun run check`.

Generated files are derived from `generated.config.ts`; do not edit them by
hand. Documentation matching the installed package is under
`node_modules/@mit-sdg/sync-engine/docs/`. The [online documentation
index](https://github.com/mit-sdg/sync-engine/blob/main/docs/index.md) tracks the
current development branch and may differ from this installed beta.
