---
title: Programmatic API
description: Package-root functions for building, inspecting, watching, and serving a Syncpress site.
topics: [reference, commands, site-building]
---

The public package root exposes the same filesystem edge used by the
`syncpress` executable. Import these functions from `@mit-sdg/syncpress`. The
internal `buildSyncpress` application constructor and concept assembly are not
public exports.

The package is ESM-only. Import it from an ES module; CommonJS `require()` is
not supported.

```ts
import { buildSite } from "@mit-sdg/syncpress";

const result = await buildSite("./site");
console.log(`${result.written} files written`);
```

All functions are asynchronous. A rejected promise reports invalid project
boundaries, invalid configuration, build failures, filesystem failures, or
invalid CLI arguments as applicable. The package does not define public error
subclasses or stable machine-readable error codes for these rejections.

## `buildSite`

```ts
function buildSite(
  projectDirectory?: string,
  destination?: string,
): Promise<BuildResult>;
```

`projectDirectory` defaults to the current directory. An omitted `destination`
uses `paths.output` from `site.yaml`, or `dist` when that setting is absent. A
relative destination is resolved from the project directory.

`buildSite` validates and stages the complete project, runs a strict build, and
reconciles the output only after the build reaches a clean terminal state. The
result contains route-claim and input counts; written, replaced, retained, and
removed file counts; the assessed site policy; and diagnostics. The `pages`
field counts route claims, including redirects and generated pagination routes,
not only authored pages.

## `inspectSite`

```ts
function inspectSite(
  projectDirectory: string,
  target: string,
): Promise<InspectionResult>;
```

`target` is a canonical route beginning with `/` or a content-root-relative
page path. Inspection builds an isolated application model and returns source,
route, template, data provenance, collection membership, dependency, output,
claim, and diagnostic data for the selected page. It does not reconcile the
configured destination. The promise rejects when no routed page or content
source matches `target`.

## `watchSite`

```ts
function watchSite(
  projectDirectory?: string,
  destination?: string,
  options?: {
    onBuild?: (result: BuildResult) => void;
    onError?: (error: unknown) => void;
  },
): Promise<SiteWatcher>;
```

`watchSite` performs the initial strict build before resolving. It then watches
the project recursively and invokes `onBuild` after each successful build.
Later build and watcher failures are passed to `onError` when that callback is
provided. A failed rebuild leaves the last reconciled output in place.

Call `await watcher.close()` to stop watching and release the watcher. Repeated
`close()` calls have no further effect.

## `serveSite`

```ts
function serveSite(
  projectDirectory?: string,
  destination?: string,
  options?: {
    host?: string;
    port?: number;
    onError?: (error: unknown) => void;
  },
): Promise<DevelopmentServer>;
```

`serveSite` starts watch mode and an HTTP development server for the reconciled
output. The default host is `127.0.0.1` and the default port is `3000`. The
resolved object reports the actual `host` and `port` and provides `close()`.
Call `await server.close()` to stop the watcher, close live-reload clients, and
close the HTTP server.

The server is not a production server and does not mount `site.basePath`. See
[development mode](./operations.md#dev) for request mapping and live-reload
behavior.

## `runCli`

```ts
function runCli(args?: string[]): Promise<void>;
```

`runCli` parses the supplied argument array. When `args` is omitted, it uses
the process arguments after the executable and script names. The function
writes command output to the process standard streams and rejects on invalid
usage or command failure. The installed executable catches that rejection and
sets a nonzero process exit status; a program that calls `runCli` directly is
responsible for handling the rejection.

## Public types

The package root exports `BuildResult`, `InspectionResult`, `Diagnostic`,
`SitePolicy`, `SiteWatcher`, `DevelopmentServer`, and `FeedPolicy`. These types
describe the values and handles returned by the public functions. No internal
concept, gateway, wire, or application type is part of the package-root API.
