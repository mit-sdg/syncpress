import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncpressRuntime } from "../../src/edge/application.ts";

const BATCH_TIMEOUT_MS = 60_000;

type Summary = {
  pages: number;
  files: number;
  policy: unknown;
  destination: string | null;
  diagnostics: { code: string; message: string; source: string | null }[];
};

async function project(configuration = "{}\n"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "syncpress-endpoints-"));
  await Promise.all([
    mkdir(join(directory, "content")),
    mkdir(join(directory, "templates")),
    mkdir(join(directory, "public")),
  ]);
  await writeFile(join(directory, "site.yaml"), configuration);
  await writeFile(join(directory, "templates", "page.html"), "<!doctype html><title>x</title>{{ page.content }}\n");
  return directory;
}

function runtime() {
  const { application, gateway } = createSyncpressRuntime();
  return {
    application,
    build: (input: { directory: string; destination?: string }) =>
      gateway.invoke("/site/build", input, { timeoutMs: BATCH_TIMEOUT_MS }),
    inspect: (input: { directory: string; target: string }) =>
      gateway.invoke("/site/inspect", input, { timeoutMs: BATCH_TIMEOUT_MS }),
    async summary(): Promise<Summary> {
      const answer = await gateway.invoke("/site/summary", {});
      if (!answer.ok) throw new Error(JSON.stringify(answer.error));
      return answer.value.summary as unknown as Summary;
    },
  };
}

test("an empty project builds into its configured output and reports what it staged", async () => {
  const directory = await project();
  try {
    const { build, summary } = runtime();
    expect(await build({ directory })).toMatchObject({
      ok: true,
      value: { written: 0, replaced: 0, kept: 0, removed: 0 },
    });

    const staged = await summary();
    expect(staged).toMatchObject({ pages: 0, files: 2, diagnostics: [] });
    expect(staged.destination).toBe(join(directory, "dist"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an explicit destination replaces the configured output without requiring containment", async () => {
  const directory = await project();
  const destination = await mkdtemp(join(tmpdir(), "syncpress-endpoints-output-"));
  try {
    const { build, summary } = runtime();
    expect((await build({ directory, destination })).ok).toBe(true);
    expect((await summary()).destination).toBe(destination);
    await expect(readdir(join(directory, "dist"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(destination, { recursive: true, force: true });
  }
});

test("a missing site directory is diagnosed rather than left to time out", async () => {
  const { build, summary } = runtime();
  const directory = join(tmpdir(), "syncpress-endpoints-absent", "nowhere");

  expect(await build({ directory })).toMatchObject({
    ok: false,
    error: { kind: "domain", value: "LOCATION_MISSING" },
  });
  expect((await summary()).diagnostics).toContainEqual(
    expect.objectContaining({ code: "LOCATION_MISSING", source: "site.yaml" }),
  );
});

test("a missing configuration file is diagnosed against the project", async () => {
  const directory = await mkdtemp(join(tmpdir(), "syncpress-endpoints-bare-"));
  try {
    const { build, summary } = runtime();
    expect(await build({ directory })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "FILE_MISSING" },
    });
    expect((await summary()).diagnostics).toContainEqual(
      expect.objectContaining({ code: "FILE_MISSING", source: "site.yaml" }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a configuration that is not UTF-8 text is diagnosed without an assessment", async () => {
  const directory = await project();
  try {
    await writeFile(join(directory, "site.yaml"), new Uint8Array([0xff]));
    const { application, build, summary } = runtime();
    expect(await build({ directory })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "BUILD_HAS_ERRORS" },
    });
    expect((await summary()).diagnostics).toContainEqual(expect.objectContaining({ code: "INVALID_TEXT" }));
    expect(await application.concepts.Governing._policy()).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a source root that escapes the site through a symbolic link is diagnosed", async () => {
  const directory = await project("paths:\n  content: linked/content\n");
  const outside = await mkdtemp(join(tmpdir(), "syncpress-endpoints-outside-"));
  try {
    await mkdir(join(outside, "content"));
    await symlink(outside, join(directory, "linked"));
    const { build, summary } = runtime();
    expect((await build({ directory })).ok).toBe(false);
    expect((await summary()).diagnostics).toContainEqual(
      expect.objectContaining({
        code: "SOURCE_OUTSIDE_SITE",
        message: "Configured paths.content must stay inside the site directory after resolving symbolic links.",
      }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("an output directory that overlaps a source directory is diagnosed", async () => {
  const directory = await project("paths:\n  output: content\n");
  try {
    const { build, summary } = runtime();
    expect((await build({ directory })).ok).toBe(false);
    expect((await summary()).diagnostics).toContainEqual(
      expect.objectContaining({ code: "OUTPUT_OVERLAPS_SOURCE", source: "content" }),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("inspection answers a missing target without publishing anything", async () => {
  const directory = await project();
  try {
    const { inspect } = runtime();
    expect(await inspect({ directory, target: "/nowhere/" })).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "INSPECTION_TARGET_NOT_FOUND" },
    });
    await expect(readdir(join(directory, "dist"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the summary of an application that has built nothing is empty", async () => {
  expect(await runtime().summary()).toMatchObject({ pages: 0, files: 0, diagnostics: [] });
});
