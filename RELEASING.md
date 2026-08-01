# Releasing Syncpress

This procedure is for package maintainers publishing a Syncpress release.

## Prerequisite

npm trusted publishing must authorize repository `mit-sdg/syncpress` and
workflow `release.yml`. The release workflow authenticates through GitHub OIDC.

## Publish a package version

1. Update `CHANGELOG.md`: move the applicable entries from `Unreleased` into a
   section named for the release version and date, then update the `Unreleased`
   comparison link to start at the new tag and add a link definition for the
   released version.
2. Update `package.json` with the release version.
3. From a clean checkout, run:

   ```sh
   bun install --frozen-lockfile
   bun run check
   bun test
   npm pack --dry-run
   ```

4. Commit the changelog and version changes.
5. Create and push a tag named `v` followed by the exact package version, such
   as `v0.2.0`.

A pushed `v*` tag starts `.github/workflows/release.yml`. The workflow checks
the tag against `package.json`, runs `bun run check` and `bun test`, then
publishes with npm provenance. If the package version already exists in npm,
the workflow does not publish it.

After a successful run, verify the registry record:

```sh
version=$(node -p "require('./package.json').version")
npm view "@mit-sdg/syncpress@$version" name version
```

## Update the documentation example

`example/package.json` pins the published package exactly. After publishing a
new version, update that dependency and its lockfile. The `Deploy example site`
workflow installs the example independently with `npm ci`, builds it, and
publishes `example/dist` to GitHub Pages. The dependency must already be
available from npm when that workflow runs.

The example is deployed at `https://mit-sdg.github.io/syncpress/`. Its
`site.yaml` sets `site.origin` and `site.basePath` for that location. Update
both settings and `example/public/site.webmanifest` when the deployment prefix
changes.
