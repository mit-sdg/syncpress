import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildSite, inspectSite, serveSite, watchSite } from "../../src/edge.ts";

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
      pages: 18,
      inputFiles: 36,
      written: 32,
      replaced: 0,
      kept: 0,
      removed: 1,
      diagnostics: [],
    });
    await expectGoldenTree(destination);

    const index = await readFile(join(destination, "index.html"), "utf8");
    expect(index).toContain('href="/field-notes/guides/getting-started/?from=home#prerequisites"');
    expect(index).toContain('href="/field-notes/posts/second/">Assets follow references, not conventions</a>');
    expect(index).toContain('<source type="image/webp"');
    expect(index).toContain('src="/field-notes/blue.png?variant=field-note#pixel"');
    expect(index).toContain('class="field-image" data-fixture="responsive" sizes="(min-width: 48rem) 42rem, 100vw"');
    expect(index).toContain('<div class="excerpt-code"><p>The newest note appears first');
    expect(index).toContain('<link rel="canonical" href="https://syncpress.example/field-notes/">');
    expect(await readFile(join(destination, "legal", "index.html"), "utf8")).toContain(
      "This authored HTML passes through the verbatim profile for Syncpress Documentation.",
    );
    expect(await readFile(join(destination, ".nojekyll"), "utf8")).toBe("");
    expect(await readFile(join(destination, "start", "index.html"), "utf8")).toContain('href="/field-notes/guides/getting-started/"');
    expect(await readFile(join(destination, "sitemap.xml"), "utf8")).toContain("https://syncpress.example/field-notes/journal/1/");
    expect(await readFile(join(destination, "feed.xml"), "utf8")).toContain("Assets follow references, not conventions");
    expect(await readFile(join(destination, "journal", "1", "index.html"), "utf8")).toContain("Field note archive");
    expect(await readFile(join(destination, "guides", "getting-started", "guide.txt"), "utf8")).toContain("Syncpress Field Guide Checklist");
    expect(await readFile(join(destination, "legal", "guide.txt"), "utf8")).toContain("Syncpress Field Guide Checklist");

    const second = await buildSite(exampleDirectory, destination);
    expect(second).toMatchObject({ written: 0, replaced: 0, kept: 32, removed: 0, diagnostics: [] });
    await expectGoldenTree(destination);
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});

test("renders without an origin and does not invent a canonical URL", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-no-origin-site-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    const configuration = await readFile(configurationPath, "utf8");
    await writeFile(
      configurationPath,
      configuration
        .replace("  origin: https://syncpress.example\n", "")
        .replace("  sitemap: true\n", "  sitemap: false\n")
        .replace(
          "  feed:\n    collection: posts\n    path: feed.xml\n    title: Syncpress Field Notes\n    description: Design notes from the Syncpress executable documentation.\n",
          "",
        ),
    );

    const result = await buildSite(project);
    expect(result).toMatchObject({ pages: 18, diagnostics: [] });
    const index = await readFile(join(project, "dist", "index.html"), "utf8");
    expect(index).toContain("Source file: <code>index.md</code>");
    expect(index).not.toContain('<link rel="canonical"');
    expect(index).not.toContain("https://syncpress.example");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("collection cards preserve conditions, optional excerpts, and missing sort keys", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-collection-cards-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    await writeFile(
      configurationPath,
      (await readFile(configurationPath, "utf8")).replace(
        "markdown:\n",
        "  mixedDates:\n    match: \"**/*.md\"\n    sort:\n      by: data.date\n      order: desc\nmarkdown:\n",
      ),
    );
    const indexPath = join(project, "content", "index.md");
    await writeFile(
      indexPath,
      `${await readFile(indexPath, "utf8")}\n<div id="equals">{% for card in collections.featured %}{{ card.source.path }}|{% endfor %}</div>\n<div id="contains">{% for card in collections.siteBuilding %}{{ card.source.path }}|{% endfor %}</div>\n<div id="exists">{% for card in collections.documented %}{{ card.source.path }}|{% endfor %}</div>\n<div id="mixed-dates">{% for card in collections.mixedDates %}{{ card.source.path }}|{% endfor %}</div>\n{% for card in collections.featured %}<div data-card="{{ card.source.path }}" data-excerpt="{% if card.excerpt == nil %}null{% else %}present{% endif %}">{{ card.excerpt }}</div>{% endfor %}\n`,
    );

    await buildSite(project);
    const index = await readFile(join(project, "dist", "index.html"), "utf8");
    expect(index).toContain(
      '<div id="equals">posts/second.md|guides/getting-started.md|about.md|posts/first.md|</div>',
    );
    expect(index).toContain(
      '<div id="contains">guides/getting-started.md|reference/collections.md|reference/operations.md|reference/configuration.md|reference/content-routing.md|about.md|reference/templates.md|reference/assets.md|posts/first.md|index.md|reference/index.md|</div>',
    );
    expect(index).toContain(
      '<div id="exists">posts/second.md|guides/getting-started.md|reference/collections.md|reference/operations.md|reference/configuration.md|reference/content-routing.md|about.md|reference/templates.md|reference/assets.md|posts/first.md|internals/reactions.md|index.md|reference/index.md|</div>',
    );
    expect(index).toContain(
      '<div id="mixed-dates">posts/second.md|posts/first.md|about.md|guides/getting-started.md|index.md|internals/reactions.md|reference/assets.md|reference/collections.md|reference/configuration.md|reference/content-routing.md|reference/index.md|reference/operations.md|reference/templates.md|</div>',
    );
    expect(index).toContain('<div data-card="about.md" data-excerpt="null"></div>');
    expect(index).toContain(
      '<div data-card="posts/second.md" data-excerpt="present"><p>The newest note appears first',
    );
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("uses paths.output when no explicit destination is supplied", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-default-output-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const result = await buildSite(project);
    expect(result).toMatchObject({ pages: 18, written: 32, diagnostics: [] });
    expect(await readFile(join(project, "dist", "index.html"), "utf8")).toContain("Syncpress Documentation");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("rejects a configured output symlink that escapes the project", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-output-link-site-"));
  const outside = await mkdtemp(join(tmpdir(), "syncpress-output-link-target-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await symlink(outside, join(project, "dist"));

    await expect(buildSite(project)).rejects.toThrow("Configured paths.output must stay inside the site directory");
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("generates a feed for a portable output path that is not a route", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-nested-feed-site-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    await writeFile(configurationPath, (await readFile(configurationPath, "utf8")).replace("path: feed.xml", "path: feeds/index.html"));

    await buildSite(project, "dist");
    expect(await readFile(join(destination, "feeds", "index.html"), "utf8")).toContain(
      "https://syncpress.example/field-notes/feeds/index.html",
    );
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("normalizes XML-invalid feed metadata to well-formed XML text", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-xml-feed-site-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    await writeFile(
      configurationPath,
      (await readFile(configurationPath, "utf8")).replaceAll("title: Syncpress Field Notes", 'title: "\\x01"'),
    );

    await buildSite(project, "dist");
    const feed = await readFile(join(project, "dist", "feed.xml"), "utf8");
    expect(feed).not.toContain("\x01");
    expect(feed).toContain("<title>\uFFFD</title>");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("generates an empty sitemap for an otherwise empty site", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-empty-sitemap-site-"));

  try {
    await Promise.all([
      mkdir(join(project, "content")),
      mkdir(join(project, "templates")),
      mkdir(join(project, "public")),
    ]);
    await writeFile(join(project, "site.yaml"), "site:\n  origin: https://empty.example\ndeploy:\n  sitemap: true\n");

    await buildSite(project);
    expect(await readFile(join(project, "dist", "sitemap.xml"), "utf8")).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
    );
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("rejects feed dates that would be invalid or host-timezone dependent", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-invalid-feed-date-site-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const post = join(project, "content", "posts", "first.md");
    await writeFile(post, (await readFile(post, "utf8")).replace("date: 2026-07-28", "date: 2026-02-31T12:00:00"));

    await expect(buildSite(project, "dist")).rejects.toThrow("INVALID_FEED_ENTRY");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("generated route collisions retain route diagnostics and finish deployment work", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-deployment-route-collision-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    await writeFile(
      configurationPath,
      (await readFile(configurationPath, "utf8")).replace(
        "/start/: /guides/getting-started/",
        "/posts/first/: /guides/getting-started/",
      ),
    );

    await expect(buildSite(project, "dist")).rejects.toThrow("ROUTE_COLLISION");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("invalid pagination work diagnoses and terminates without an incomplete queue", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-pagination-template-"));

  try {
    await cp(exampleDirectory, project, { recursive: true });
    const configurationPath = join(project, "site.yaml");
    await writeFile(
      configurationPath,
      (await readFile(configurationPath, "utf8")).replace("template: page.html", "template: missing.html"),
    );

    await expect(buildSite(project, "dist")).rejects.toThrow("TEMPLATE_NOT_FOUND");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("reports multiple location-aware configuration errors before staging sources", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-invalid-policy-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await writeFile(
      join(project, "site.yaml"),
      [
        "site:",
        "  basePath: not-a-route",
        "paths:",
        "  output: ../outside",
        "deploy:",
        "  nojekyll: yes",
        "  sitemap: true",
      ].join("\n"),
    );
    await mkdir(destination);
    await writeFile(join(destination, "previous.txt"), "keep this file\n");

    await expect(buildSite(project)).rejects.toThrow("INVALID_CONFIGURATION site.yaml:4");
    await expect(buildSite(project)).rejects.toThrow("site.origin is required");
    expect(await readFile(join(destination, "previous.txt"), "utf8")).toBe("keep this file\n");
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("inspect reports route ownership, template provenance, collection membership, and dependencies", async () => {
  const report = await inspectSite(exampleDirectory, "/posts/first/");

  expect(report).toMatchObject({
    route: "/posts/first/",
    source: { path: "posts/first.md" },
    template: { name: "post.html" },
    rendering: {
      path: "posts/first.md",
      profile: "markdown",
      template: "post.html",
      stage: "completed",
    },
  });
  expect(report.memberships).toContainEqual(expect.objectContaining({ name: "posts", index: 1 }));
  expect(report.dependencies.inputs).toContainEqual(expect.objectContaining({ input: expect.stringContaining("posts/first.md") }));
  expect(report.outputs).toContainEqual(expect.objectContaining({ path: "posts/first/index.html" }));

  const redirect = await inspectSite(exampleDirectory, "/start/");
  expect(redirect.template).toBeUndefined();
  expect(redirect.rendering).toBeUndefined();
});

test("the development server serves reconciled output with a live-reload client", async () => {
  const destination = await mkdtemp(join(tmpdir(), "syncpress-dev-server-"));
  const server = await serveSite(exampleDirectory, destination, { port: 0 });

  try {
    const response = await fetch(`http://${server.host}:${server.port}/`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("/__syncpress/live-reload");
    expect(html).toContain("https://syncpress.example/field-notes/");
    expect((await fetch(`http://${server.host}:${server.port}/missing`)).status).toBe(404);
  } finally {
    await server.close();
    await rm(destination, { recursive: true, force: true });
  }
});

test("watch ignores its own reconciliation transactions", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-watch-site-"));
  let builds = 0;
  let nextBuild: (() => void) | undefined;
  const rebuilt = new Promise<void>((resolveRebuilt) => {
    nextBuild = resolveRebuilt;
  });

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await mkdir(join(project, "build-output"));
    await symlink("build-output", join(project, "dist"));
    const watcher = await watchSite(project, "dist", {
      onBuild() {
        builds += 1;
        if (builds === 2) nextBuild?.();
      },
    });
    try {
      const about = join(project, "content", "about.md");
      await writeFile(about, `${await readFile(about, "utf8")}\n`);
      await Promise.race([
        rebuilt,
        Bun.sleep(5_000).then(() => Promise.reject(new Error("Watch rebuild did not complete."))),
      ]);
      await Bun.sleep(250);
      expect(builds).toBe(2);
    } finally {
      await watcher.close();
    }
  } finally {
    await rm(project, { recursive: true, force: true });
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

test("body Liquid failures report their original source coordinate after front matter", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-located-liquid-site-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await writeFile(join(project, "content", "index.md"), "---\ntitle: Broken\n---\n{{ missing.value }}\n");
    await mkdir(destination);
    await writeFile(join(destination, "previous.txt"), "keep this file\n");

    await expect(buildSite(project, "dist")).rejects.toThrow("UNDEFINED_VARIABLE index.md:4:");
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

test("two different local assets cannot silently claim one beside-page output path", async () => {
  const project = await mkdtemp(join(tmpdir(), "syncpress-asset-collision-"));
  const destination = join(project, "dist");

  try {
    await cp(exampleDirectory, project, { recursive: true });
    await mkdir(join(project, "content", "one"));
    await mkdir(join(project, "content", "two"));
    await writeFile(join(project, "content", "one", "shared.txt"), "first\n");
    await writeFile(join(project, "content", "two", "shared.txt"), "second\n");
    const indexPath = join(project, "content", "index.md");
    await writeFile(indexPath, `${await readFile(indexPath, "utf8")}\n[First](./one/shared.txt) [Second](./two/shared.txt)\n`);
    await mkdir(destination);
    await writeFile(join(destination, "previous.txt"), "keep this file\n");

    await expect(buildSite(project, "dist")).rejects.toThrow("PATH_CONTESTED");
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
