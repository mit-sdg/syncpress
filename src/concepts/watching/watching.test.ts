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
  WatchNotOpen,
} from "./watching.ts";

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
  test("its principle: a burst of change is reported once, and disregarded paths never are", async () => {
    const watching = new WatchingConcept();
    await mkdir(join(root, "dist"));
    const { watch } = await watching.observe({ directory: root, settling: SETTLING_MS });
    watching.disregard({ watch, prefix: join(root, "dist") });

    expect(watching._watch({ watch })).toEqual([{ directory: root, settling: SETTLING_MS, state: "open" }]);
    expect(watching._disregarded({ watch })).toEqual([{ prefix: join(root, "dist") }]);
    expect(watching._open()).toEqual([{ watch }]);

    const attending = watching.attend({ watch, within: WITHIN_MS });
    await writeFile(join(root, "one.md"), "one\n");
    await writeFile(join(root, "two.md"), "two\n");
    await writeFile(join(root, "three.md"), "three\n");
    expect(await attending).toEqual({ changed: true, watching: true });

    expect(await watching.attend({ watch, within: 100 })).toEqual({ changed: false, watching: true });

    await writeFile(join(root, "dist", "index.html"), "<html></html>\n");
    expect(await watching.attend({ watch, within: 200 })).toEqual({ changed: false, watching: true });

    watching.close({ watch });
    expect(watching._watch({ watch })).toEqual([{ directory: root, settling: SETTLING_MS, state: "closed" }]);
    expect(watching._open()).toEqual([]);
    expect(await watching.attend({ watch, within: WITHIN_MS })).toEqual({ changed: false, watching: false });
  });

  test("a burst that settles while nobody attends is still reported once", async () => {
    const watching = new WatchingConcept();
    const { watch } = await watching.observe({ directory: root, settling: SETTLING_MS });
    try {
      await writeFile(join(root, "one.md"), "one\n");
      await Bun.sleep(SETTLING_MS * 4);
      expect(await watching.attend({ watch, within: 100 })).toEqual({ changed: true, watching: true });
      expect(await watching.attend({ watch, within: 100 })).toEqual({ changed: false, watching: true });
    } finally {
      watching.close({ watch });
    }
  });

  test("closing an open watch releases whoever is attending it", async () => {
    const watching = new WatchingConcept();
    const { watch } = await watching.observe({ directory: root, settling: SETTLING_MS });
    const attending = watching.attend({ watch, within: 60_000 });
    await Bun.sleep(20);
    watching.close({ watch });
    expect(await attending).toEqual({ changed: false, watching: false });
    expect(watching.close({ watch })).toEqual({ watch });
  });

  test("only present directories that are not symbolic links can be observed", async () => {
    const watching = new WatchingConcept();
    await writeFile(join(root, "file.txt"), "text\n");
    await mkdir(join(root, "real"));
    await symlink(join(root, "real"), join(root, "linked"));

    await expect(watching.observe({ directory: join(root, "absent"), settling: SETTLING_MS }))
      .rejects.toBeInstanceOf(DirectoryMissing);
    await expect(watching.observe({ directory: join(root, "file.txt"), settling: SETTLING_MS }))
      .rejects.toBeInstanceOf(DirectoryUnsupported);
    await expect(watching.observe({ directory: join(root, "linked"), settling: SETTLING_MS }))
      .rejects.toBeInstanceOf(DirectoryUnsupported);
    await expect(watching.observe({ directory: root, settling: 0 })).rejects.toBeInstanceOf(InvalidWatch);
  });

  test("unknown and closed watches are refused rather than guessed", async () => {
    const watching = new WatchingConcept();
    expect(() => watching.disregard({ watch: "watch:absent", prefix: root })).toThrow(WatchNotOpen);
    expect(() => watching.close({ watch: "watch:absent" })).toThrow(WatchNotFound);
    await expect(watching.attend({ watch: "watch:absent", within: 10 })).rejects.toBeInstanceOf(WatchNotFound);

    const { watch } = await watching.observe({ directory: root, settling: SETTLING_MS });
    await expect(watching.attend({ watch, within: 0 })).rejects.toBeInstanceOf(InvalidWatch);
    expect(() => watching.disregard({ watch, prefix: "" })).toThrow(InvalidWatch);
    watching.close({ watch });
    expect(() => watching.disregard({ watch, prefix: root })).toThrow(WatchNotOpen);
    expect(watching._disregarded({ watch: "watch:absent" })).toEqual([]);
  });
});
