import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DirectoryMissing,
  DirectoryUnsupported,
  InvalidWatch,
  WatchingConcept,
  WatchNotFound,
} from "@concepts/watching/watching.ts";

const SETTLING_MS = 40;
const WITHIN_MS = 2_000;

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "watching-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Watching", () => {
  test("its principle: a burst is reported once and initial exclusions are exact", async () => {
    const watching = new WatchingConcept();
    await mkdir(join(root, "dist"));
    const { watch } = await watching.open({
      directory: root,
      settling: SETTLING_MS,
      excluded: join(root, "dist"),
      prefix: join(root, ".dist.emitting-"),
    });

    expect(watching._watch({ watch })).toEqual([{ directory: root, settling: SETTLING_MS, state: "open" }]);
    expect(watching._excluded({ watch })).toEqual([{ path: join(root, "dist") }]);
    expect(watching._open()).toEqual([{ watch }]);

    const attending = watching.waitForChange({ watch, within: WITHIN_MS });
    await writeFile(join(root, "one.md"), "one\n");
    await writeFile(join(root, "two.md"), "two\n");
    await writeFile(join(root, "three.md"), "three\n");
    expect(await attending).toEqual({ changed: true, watching: true });

    expect(await watching.waitForChange({ watch, within: 100 })).toEqual({ changed: false, watching: true });

    await writeFile(join(root, "dist", "index.html"), "<html></html>\n");
    expect(await watching.waitForChange({ watch, within: 200 })).toEqual({ changed: false, watching: true });

    await mkdir(join(root, "dist-notes"));
    const sibling = watching.waitForChange({ watch, within: WITHIN_MS });
    await writeFile(join(root, "dist-notes", "note.txt"), "still counted\n");
    expect(await sibling).toEqual({ changed: true, watching: true });

    await watching.close({ watch });
    expect(watching._watch({ watch })).toEqual([{ directory: root, settling: SETTLING_MS, state: "closed" }]);
    expect(watching._open()).toEqual([]);
    expect(await watching.waitForChange({ watch, within: WITHIN_MS })).toEqual({ changed: false, watching: false });
  });

  test("a burst that settles while nobody attends is still reported once", async () => {
    const watching = new WatchingConcept();
    const { watch } = await watching.open({ directory: root, settling: SETTLING_MS, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") });
    try {
      await writeFile(join(root, "one.md"), "one\n");
      await Bun.sleep(SETTLING_MS * 4);
      expect(await watching.waitForChange({ watch, within: 100 })).toEqual({ changed: true, watching: true });
      expect(await watching.waitForChange({ watch, within: 100 })).toEqual({ changed: false, watching: true });
    } finally {
      await watching.close({ watch });
    }
  });

  test("closing an open watch releases whoever is attending it", async () => {
    const watching = new WatchingConcept();
    const { watch } = await watching.open({ directory: root, settling: SETTLING_MS, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") });
    const attending = watching.waitForChange({ watch, within: 60_000 });
    await Bun.sleep(20);
    await watching.close({ watch });
    expect(await attending).toEqual({ changed: false, watching: false });
    expect(await watching.close({ watch })).toEqual({ watch });
  });

  test("only present directories that are not symbolic links can be observed", async () => {
    const watching = new WatchingConcept();
    await writeFile(join(root, "file.txt"), "text\n");
    await mkdir(join(root, "real"));
    await symlink(join(root, "real"), join(root, "linked"));

    await expect(watching.open({ directory: join(root, "absent"), settling: SETTLING_MS, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") }))
      .rejects.toBeInstanceOf(DirectoryMissing);
    await expect(watching.open({ directory: join(root, "file.txt"), settling: SETTLING_MS, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") }))
      .rejects.toBeInstanceOf(DirectoryUnsupported);
    await expect(watching.open({ directory: join(root, "linked"), settling: SETTLING_MS, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") }))
      .rejects.toBeInstanceOf(DirectoryUnsupported);
    await expect(watching.open({ directory: root, settling: 0, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") })).rejects.toBeInstanceOf(InvalidWatch);
  });

  test("unknown and closed watches are refused rather than guessed", async () => {
    const watching = new WatchingConcept();
    await expect(watching.close({ watch: "watch:absent" })).rejects.toBeInstanceOf(WatchNotFound);
    await expect(watching.waitForChange({ watch: "watch:absent", within: 10 })).rejects.toBeInstanceOf(WatchNotFound);

    const { watch } = await watching.open({ directory: root, settling: SETTLING_MS, excluded: join(root, "dist"), prefix: join(root, ".dist.emitting-") });
    await expect(watching.waitForChange({ watch, within: 0 })).rejects.toBeInstanceOf(InvalidWatch);
    await watching.close({ watch });
    expect(watching._excluded({ watch: "watch:absent" })).toEqual([]);
  });
});
