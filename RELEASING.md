# Releasing Syncpress

This procedure is for package maintainers. Library users install and run the
published package; they do not need these steps.

## Prerequisite

Before the first release, configure npm trusted publishing for repository
`mit-sdg/syncpress` and workflow `release.yml`. The release workflow requests a
GitHub OIDC token and does not read an npm token from the repository.

## Publish a package version

1. Update `package.json` with the release version.
2. From a clean checkout, run:

   ```sh
   bun install --frozen-lockfile
   bun run check
   bun test
   npm pack --dry-run
   ```

3. Commit the version change.
4. Create and push a tag named `v` followed by the exact package version, such
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
