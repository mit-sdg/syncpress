import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DirectoryMissing,
  DirectoryUnsupported,
  EntryNotFound,
  EntryUnsupported,
  FileMissing,
  InvalidSurvey,
  ScanningConcept,
} from "./scanning.ts";

const bytes = (text: string) => new TextEncoder().encode(text);
const run = promisify(execFile);

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "scanning-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("Scanning", () => {
  test("its principle: a survey lists plain files in one order and reads their exact bytes", async () => {
    const scanning = new ScanningConcept();
    const content = join(root, "content");
    await mkdir(join(content, "posts"), { recursive: true });
    await writeFile(join(content, "about.md"), bytes("# About\n"));
    await writeFile(join(content, "posts", "first.md"), bytes("# First\n"));

    const surveyed = await scanning.survey({ label: "content", directory: content });
    expect(surveyed).toEqual({ survey: surveyed.survey, count: 2 });
    expect(scanning._entry({ survey: surveyed.survey })).toEqual([
      { path: "about.md", source: join(content, "about.md") },
      { path: "posts/first.md", source: join(content, "posts", "first.md") },
    ]);
    expect(scanning._survey({ survey: surveyed.survey })).toEqual([
      { label: "content", directory: content, count: 2 },
    ]);
    expect(scanning._labelled({ label: "content" })).toEqual([{ survey: surveyed.survey }]);

    expect(await scanning.read({ survey: surveyed.survey, path: "posts/first.md" })).toEqual({
      content: bytes("# First\n"),
    });
    await expect(scanning.read({ survey: surveyed.survey, path: "absent.md" })).rejects.toBeInstanceOf(EntryNotFound);

    await rm(join(content, "about.md"));
    const resurveyed = await scanning.survey({ label: "content", directory: content });
    expect(resurveyed).toEqual({ survey: surveyed.survey, count: 1 });
    expect(scanning._entry({ survey: resurveyed.survey })).toEqual([
      { path: "posts/first.md", source: join(content, "posts", "first.md") },
    ]);
  });

  test("a symbolic link anywhere below the directory refuses the whole survey", async () => {
    const scanning = new ScanningConcept();
    const content = join(root, "content");
    await mkdir(join(content, "nested"), { recursive: true });
    await writeFile(join(content, "kept.md"), bytes("kept\n"));
    await symlink(join(root, "elsewhere"), join(content, "nested", "link.md"));

    await expect(scanning.survey({ label: "content", directory: content })).rejects.toBeInstanceOf(EntryUnsupported);
    expect(scanning._labelled({ label: "content" })).toEqual([]);
  });

  test("only present directories that are not symbolic links can be surveyed", async () => {
    const scanning = new ScanningConcept();
    await writeFile(join(root, "file.txt"), bytes("text\n"));
    await mkdir(join(root, "real"));
    await symlink(join(root, "real"), join(root, "linked"));

    await expect(scanning.survey({ label: "a", directory: join(root, "absent") })).rejects.toBeInstanceOf(DirectoryMissing);
    await expect(scanning.survey({ label: "b", directory: join(root, "file.txt") })).rejects.toBeInstanceOf(DirectoryUnsupported);
    await expect(scanning.survey({ label: "c", directory: join(root, "linked") })).rejects.toBeInstanceOf(DirectoryUnsupported);
    await expect(scanning.survey({ label: "", directory: join(root, "real") })).rejects.toBeInstanceOf(InvalidSurvey);
  });

  test("a non-regular entry refuses the survey", async () => {
    const scanning = new ScanningConcept();
    const content = join(root, "content");
    await mkdir(content);
    await run("mkfifo", [join(content, "pipe")]);

    await expect(scanning.survey({ label: "content", directory: content })).rejects.toBeInstanceOf(EntryUnsupported);
  });

  test("absorbing reads one named file that no survey lists", async () => {
    const scanning = new ScanningConcept();
    await writeFile(join(root, "site.yaml"), bytes("paths:\n"));
    await mkdir(join(root, "directory"));
    await symlink(join(root, "site.yaml"), join(root, "linked.yaml"));

    expect(await scanning.absorb({ path: join(root, "site.yaml") })).toEqual({ content: bytes("paths:\n") });
    await expect(scanning.absorb({ path: join(root, "absent.yaml") })).rejects.toBeInstanceOf(FileMissing);
    await expect(scanning.absorb({ path: join(root, "directory") })).rejects.toBeInstanceOf(EntryUnsupported);
    await expect(scanning.absorb({ path: join(root, "linked.yaml") })).rejects.toBeInstanceOf(EntryUnsupported);
    await expect(scanning.absorb({ path: "" })).rejects.toBeInstanceOf(InvalidSurvey);
  });

  test("unknown surveys answer nothing rather than guessing", async () => {
    const scanning = new ScanningConcept();
    expect(scanning._survey({ survey: "survey:\"absent\"" })).toEqual([]);
    expect(scanning._entry({ survey: "survey:\"absent\"" })).toEqual([]);
    expect(scanning._labelled({ label: "absent" })).toEqual([]);
    await expect(scanning.read({ survey: "survey:\"absent\"", path: "a.md" })).rejects.toBeInstanceOf(EntryNotFound);
  });
});
