import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  InvalidLocation,
  LocatingConcept,
  LocationMissing,
  LocationNotDirectory,
  NotGrounded,
} from "./locating.ts";

let base: string;
let outside: string;

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "locating-base-"));
  outside = await mkdtemp(join(tmpdir(), "locating-outside-"));
});

afterEach(async () => {
  await rm(base, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

describe("Locating", () => {
  test("its principle: recorded locations become grounded, admitted, and settled", async () => {
    const locating = new LocatingConcept();
    await mkdir(join(base, "content"));
    await mkdir(join(outside, "content"));
    await symlink(outside, join(base, "linked"));

    expect(locating.request({ name: "site", path: base })).toEqual({ name: "site", path: base });
    expect(locating.request({ name: "output", path: "build" })).toEqual({ name: "output", path: "build" });
    expect(locating._requested({ name: "site" })).toEqual([{ path: base }]);
    expect(locating._base()).toEqual([]);

    expect(await locating.ground({ path: base })).toEqual({ path: base, real: base });
    expect(locating._base()).toEqual([{ path: base, real: base }]);

    const content = await locating.admit({ name: "content", path: "content" });
    expect(content).toMatchObject({ path: join(base, "content"), contained: true, resolved: true });

    const elsewhere = await locating.admit({ name: "elsewhere", path: "../elsewhere" });
    expect(elsewhere).toMatchObject({ contained: false, resolved: false });

    const linked = await locating.admit({ name: "linked", path: "linked/content" });
    expect(linked).toMatchObject({ contained: true, resolved: false, real: join(outside, "content") });

    const build = await locating.admit({ name: "output", path: "build" });
    expect(build).toMatchObject({ path: join(base, "build"), real: join(base, "build"), contained: true, resolved: true });
    expect(await locating.admit({ name: "output", path: "build" })).toEqual(build);

    expect(locating._overlapping({ place: build.place, other: content.place })).toEqual({ overlapping: false });

    const other = await mkdtemp(join(tmpdir(), "locating-other-"));
    try {
      await locating.ground({ path: other });
      expect(locating._named({ name: "content" })).toEqual([]);
      expect(locating._requested({ name: "site" })).toEqual([{ path: base }]);
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  test("a base must be a present directory that is not a symbolic link", async () => {
    const locating = new LocatingConcept();
    await symlink(outside, join(base, "linked"));
    await writeFile(join(base, "file.txt"), "text\n");

    await expect(locating.ground({ path: join(base, "absent") })).rejects.toBeInstanceOf(LocationMissing);
    await expect(locating.ground({ path: join(base, "file.txt") })).rejects.toBeInstanceOf(LocationNotDirectory);
    await expect(locating.ground({ path: join(base, "linked") })).rejects.toBeInstanceOf(LocationNotDirectory);
    await expect(locating.ground({ path: "" })).rejects.toBeInstanceOf(InvalidLocation);
    expect(locating._base()).toEqual([]);
  });

  test("admitting requires a base and well-formed text", async () => {
    const locating = new LocatingConcept();
    await expect(locating.admit({ name: "content", path: "content" })).rejects.toBeInstanceOf(NotGrounded);

    await locating.ground({ path: base });
    await expect(locating.admit({ name: "", path: "content" })).rejects.toBeInstanceOf(InvalidLocation);
    await expect(locating.admit({ name: "content", path: "" })).rejects.toBeInstanceOf(InvalidLocation);
    expect(() => locating.request({ name: "content", path: "" })).toThrow(InvalidLocation);
    expect(locating._named({ name: "content" })).toEqual([]);
  });

  test("a relative base is made absolute and grounding the same base keeps its places", async () => {
    const locating = new LocatingConcept();
    const grounded = await locating.ground({ path: "." });
    expect(grounded.path).toBe(resolve("."));

    const here = await locating.admit({ name: "here", path: "." });
    expect(await locating.ground({ path: "." })).toEqual(grounded);
    expect(locating._named({ name: "here" })).toEqual([{ place: here.place }]);
  });

  test("admitting a name again relocates it, and overlap follows resolved paths", async () => {
    const locating = new LocatingConcept();
    await mkdir(join(base, "public"));
    await locating.ground({ path: base });

    const first = await locating.admit({ name: "output", path: "public" });
    const second = await locating.admit({ name: "output", path: "public/nested" });
    expect(second.place).toBe(first.place);
    expect(locating._place({ place: second.place })).toEqual([
      { name: "output", path: join(base, "public", "nested"), real: join(base, "public", "nested"), contained: true, resolved: true },
    ]);

    const parent = await locating.admit({ name: "public", path: "public" });
    expect(locating._overlapping({ place: second.place, other: parent.place })).toEqual({ overlapping: true });
    expect(locating._overlapping({ place: parent.place, other: second.place })).toEqual({ overlapping: true });
    expect(locating._overlapping({ place: parent.place, other: "place:\"absent\"" })).toEqual({ overlapping: false });
  });
});
