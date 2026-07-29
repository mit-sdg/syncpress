import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSyncpress } from "../../src/edge.ts";

test("the minimal site composition renders Markdown into a routed HTML file", async () => {
  const destination = await mkdtemp(join(tmpdir(), "syncpress-minimal-site-"));

  try {
    const { application, gateway } = buildSyncpress();
    const configured = await gateway.invoke("/site/configure", { destination });
    if (!configured.ok) throw new Error(String(configured.error));

    const opened = await application.concepts.Filing.open({ name: "content" });
    if ("error" in opened) throw new Error(String(opened.error));

    const placed = await application.concepts.Filing.place({
      root: opened.root,
      path: "index.md",
      content: new TextEncoder().encode("---\ntitle: Hello & Syncpress\n---\n# Welcome\n\nThis is **generated**.\n"),
    });
    if ("error" in placed) throw new Error(String(placed.error));

    await application.whenIdle();
    const reconciled = await gateway.invoke("/site/reconcile", {});
    if (!reconciled.ok) throw new Error(String(reconciled.error));

    expect(reconciled.value).toMatchObject({ written: 1, replaced: 0, kept: 0, removed: 0 });
    const output = await readFile(join(destination, "index.html"), "utf8");
    expect(output).toContain("<title>Hello &amp; Syncpress</title>");
    expect(output).toContain("<main><h1>Welcome</h1>");
    expect(output).toContain("<p>This is <strong>generated</strong>.</p>");
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});
