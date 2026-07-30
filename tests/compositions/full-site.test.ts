import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildSite } from "../../src/edge.ts";

const exampleDirectory = resolve(import.meta.dir, "../../example");
const goldenPath = resolve(import.meta.dir, "../golden/example-site.json");

type Golden = { files: Record<string, string> };

async function outputDigests(directory: string, prefix = ""): Promise<Record<string, string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const files: Record<string, string> = {};

  for (const entry of entries) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    const location = join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await outputDigests(location, path));
      continue;
    }
    if (!entry.isFile()) throw new Error(`Expected a regular output file at ${path}`);
    const content = await readFile(location);
    files[path] = createHash("sha256").update(content).digest("hex");
  }

  return files;
}

async function expectGoldenTree(directory: string): Promise<void> {
  const golden = JSON.parse(await readFile(goldenPath, "utf8")) as Golden;
  expect(await outputDigests(directory)).toEqual(golden.files);
}

test("the example site produces its exact deterministic golden tree", async () => {
  const destination = await mkdtemp(join(tmpdir(), "syncpress-example-site-"));

  try {
    await writeFile(join(destination, "obsolete.txt"), "this output must be reconciled away\n");

    const first = await buildSite(exampleDirectory, destination);
    expect(first).toMatchObject({
      pages: 6,
      inputFiles: 16,
      written: 11,
      replaced: 0,
      kept: 0,
      removed: 1,
      diagnostics: [],
    });
    await expectGoldenTree(destination);

    const index = await readFile(join(destination, "index.html"), "utf8");
    expect(index).toContain('href="/field-notes/guides/getting-started/?from=home#install"');
    expect(index).toContain('href="/field-notes/posts/second/">Second post</a>');
    expect(index).toContain('<picture><source type="image/webp"');
    expect(index).toContain('src="/field-notes/assets/blue.png?variant=example#pixel"');
    expect(await readFile(join(destination, "legal", "index.html"), "utf8")).toContain(
      "This authored HTML is rendered for Syncpress Field Notes.",
    );

    const second = await buildSite(exampleDirectory, destination);
    expect(second).toMatchObject({ written: 0, replaced: 0, kept: 11, removed: 0, diagnostics: [] });
    await expectGoldenTree(destination);
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});

test("a missing local reference reports a diagnostic and preserves the prior destination", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-invalid-site-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await writeFile(join(project, "content", "index.md"), "---\ntitle: Broken\n---\n[Missing](./assets/nope.txt)\n");
    await mkdir(destination);
    await writeFile(join(destination, "previous.txt"), "keep this file\n");

    await expect(buildSite(project, "dist")).rejects.toThrow("MISSING_LOCAL_REFERENCE");
    expect(await readFile(join(destination, "previous.txt"), "utf8")).toBe("keep this file\n");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("malformed front matter blocks publication without replacing prior output", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-malformed-site-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await writeFile(join(project, "content", "about.md"), "---\ntitle: Unclosed\n");
    await mkdir(destination);
    await writeFile(join(destination, "previous.txt"), "keep this file\n");

    await expect(buildSite(project, "dist")).rejects.toThrow("MALFORMED_ATTRIBUTES");
    expect(await readFile(join(destination, "previous.txt"), "utf8")).toBe("keep this file\n");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("a link to an unpublished document is not copied as an asset", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-unpublished-site-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const indexPath = join(project, "content", "index.md");
    await writeFile(indexPath, `${await readFile(indexPath, "utf8")}\n[Hidden draft](./drafts/hidden.md)\n`);
    await mkdir(destination);
    await writeFile(join(destination, "previous.txt"), "keep this file\n");

    await expect(buildSite(project, "dist")).rejects.toThrow("UNPUBLISHED_DOCUMENT_REFERENCE");
    expect(await readFile(join(destination, "previous.txt"), "utf8")).toBe("keep this file\n");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("an invalid asset output prefix fails before source staging", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-invalid-assets-site-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    const configuration = await readFile(configurationPath, "utf8");
    await writeFile(configurationPath, configuration.replace("assets: assets", "assets: ../outside"));

    await expect(buildSite(project, "dist")).rejects.toThrow("paths.assets");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("duplicate include and layout names are rejected before template reactions run", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-duplicate-template-site-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await writeFile(join(project, "templates", "includes", "page.html"), "<p>duplicate</p>");

    await expect(buildSite(project, "dist")).rejects.toThrow("Duplicate logical Liquid template name");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("a configured root cannot escape through an intermediate symbolic link", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-linked-root-site-"));
  const outside = await mkdtemp(join(tmpdir(), "syncpress-outside-root-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await mkdir(join(outside, "content"));
    await writeFile(join(outside, "content", "index.md"), "# Outside\n");
    await symlink(outside, join(project, "linked"));

    const configurationPath = join(project, "site.yaml");
    const configuration = await readFile(configurationPath, "utf8");
    await writeFile(configurationPath, configuration.replace("content: content", "content: linked/content"));

    await expect(buildSite(project, "dist")).rejects.toThrow("must stay inside the site directory after resolving symbolic links");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
