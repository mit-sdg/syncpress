import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EmittingConcept, NotBegun, PathContested, PathLeavesDestination } from "./emitting.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const text = (content: Uint8Array) => new TextDecoder().decode(content);

test("its principle: attempts reconcile shared artifact intents with a local destination", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    await mkdir(destination);
    await writeFile(join(destination, "old.html"), bytes("stale"));
    await writeFile(join(destination, "index.html"), bytes("old"));

    const emitting = new EmittingConcept();
    expect(await emitting.direct({ destination })).toEqual({ destination, existing: 2 });
    expect(() => emitting.commit({ producer: "missing" })).toThrow(NotBegun);
    expect(() => emitting.intend({ producer: "page", path: "../escape.html", content: bytes("no"), medium: "text/html" })).toThrow(PathLeavesDestination);

    expect(emitting.begin({ producer: "page" })).toEqual({ producer: "page", attempt: 1 });
    const index = emitting.intend({ producer: "page", path: "index.html", content: bytes("first"), medium: "text/html" });
    const stylesheet = emitting.intend({ producer: "page", path: "a.css", content: bytes("body {}"), medium: "text/css" });
    emitting.intend({ producer: "public", path: "styles.css", content: bytes("main {}"), medium: "text/css" });

    expect(emitting._intent({ path: "index.html" })).toEqual([{ digest: index.digest, medium: "text/html" }]);
    expect(emitting._byProducer({ producer: "page" })).toEqual([
      { path: "a.css", digest: stylesheet.digest, medium: "text/css" },
      { path: "index.html", digest: index.digest, medium: "text/html" },
    ]);
    expect(emitting._attempt({ producer: "page" })).toEqual([{ attempt: 1 }]);
    expect(emitting._pending().map(({ path }) => path)).toEqual(["a.css", "index.html", "styles.css"]);
    expect(emitting._orphans()).toEqual([{ path: "old.html" }]);
    expect(() => emitting.intend({ producer: "other", path: "index.html", content: bytes("different"), medium: "text/html" })).toThrow(PathContested);
    emitting.intend({ producer: "other", path: "styles.css", content: bytes("main {}"), medium: "text/css" });
    expect(emitting._producers({ path: "styles.css" })).toEqual([{ producer: "other" }, { producer: "public" }]);

    expect(await emitting.reconcile()).toEqual({ written: 2, replaced: 1, kept: 0, removed: 1 });
    expect(text(await readFile(join(destination, "index.html")))).toBe("first");
    expect(text(await readFile(join(destination, "a.css")))).toBe("body {}");
    expect(emitting._pending()).toEqual([]);
    expect(emitting._orphans()).toEqual([]);

    expect(emitting.retract({ producer: "public" })).toEqual({ producer: "public", count: 1 });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 3, removed: 0 });

    emitting.begin({ producer: "page" });
    emitting.intend({ producer: "page", path: "index.html", content: bytes("second"), medium: "text/html" });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 1, kept: 2, removed: 0 });
    expect(text(await readFile(join(destination, "index.html")))).toBe("second");
    expect(emitting.commit({ producer: "page" })).toEqual({ producer: "page", dropped: 1 });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 2, removed: 1 });

    expect(emitting.retract({ producer: "page" })).toEqual({ producer: "page", count: 1 });
    expect(await emitting.reconcile()).toEqual({ written: 0, replaced: 0, kept: 1, removed: 1 });
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});

test("reconciliation removes stale symlinks instead of following them outside the destination", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "syncpress-emitting-"));
  try {
    const destination = join(temporary, "dist");
    const outside = join(temporary, "outside");
    await mkdir(destination);
    await mkdir(outside);
    await symlink(outside, join(destination, "assets"));

    const emitting = new EmittingConcept();
    await emitting.direct({ destination });
    emitting.intend({ producer: "page", path: "assets/site.css", content: bytes("body {}"), medium: "text/css" });
    expect(await emitting.reconcile()).toEqual({ written: 1, replaced: 0, kept: 0, removed: 1 });
    expect(text(await readFile(join(destination, "assets/site.css")))).toBe("body {}");
    await expect(readFile(join(outside, "site.css"))).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});
