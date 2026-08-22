import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  InvalidLocation,
  LocatingConcept,
  NotGrounded,
} from "../../../src/concepts/locating/locating.ts";

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

    expect(locating.recordRequest({ name: "site", path: base })).toEqual({ name: "site", path: base });
    expect(locating.recordRequest({ name: "output", path: "build" })).toEqual({ name: "output", path: "build" });
    expect(locating._requested({ name: "site" })).toEqual([{ path: base }]);
    expect(locating._base()).toEqual([]);

    expect(await locating.establishBase({ path: base })).toEqual({ status: "grounded", path: base, real: base });
    expect(locating._base()).toEqual([{ path: base, real: base }]);

    const content = await locating.inspectLocation({ name: "content", path: "content" });
    if (content.status !== "admitted") throw new Error(content.detail);
    expect(content).toMatchObject({ path: join(base, "content"), contained: true, resolved: true });

    const elsewhere = await locating.inspectLocation({ name: "elsewhere", path: "../elsewhere" });
    if (elsewhere.status !== "admitted") throw new Error(elsewhere.detail);
    expect(elsewhere).toMatchObject({ contained: false, resolved: false });

    const linked = await locating.inspectLocation({ name: "linked", path: "linked/content" });
    if (linked.status !== "admitted") throw new Error(linked.detail);
    expect(linked).toMatchObject({ contained: true, resolved: false, real: join(outside, "content") });

    const build = await locating.inspectLocation({ name: "output", path: "build" });
    if (build.status !== "admitted") throw new Error(build.detail);
    expect(build).toMatchObject({ path: join(base, "build"), real: join(base, "build"), contained: true, resolved: true });
    expect(await locating.inspectLocation({ name: "output", path: "build" })).toEqual(build);

    expect(locating._overlapping({ place: build.place!, other: content.place! })).toEqual({ overlapping: false });

    const other = await mkdtemp(join(tmpdir(), "locating-other-"));
    try {
      await locating.establishBase({ path: other });
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

    expect(await locating.establishBase({ path: join(base, "absent") })).toEqual({
      status: "problem",
      code: "LOCATION_MISSING",
      detail: "This required directory is missing.",
    });
    for (const path of [join(base, "file.txt"), join(base, "linked")]) {
      expect(await locating.establishBase({ path })).toEqual({
        status: "problem",
        code: "LOCATION_NOT_DIRECTORY",
        detail: "This required location must be a directory that is not a symbolic link.",
      });
    }
    await expect(locating.establishBase({ path: "" })).rejects.toBeInstanceOf(InvalidLocation);
    expect(locating._base()).toEqual([]);
  });

  test("admitting requires a base and well-formed text", async () => {
    const locating = new LocatingConcept();
    await expect(locating.inspectLocation({ name: "content", path: "content" })).rejects.toBeInstanceOf(NotGrounded);

    await locating.establishBase({ path: base });
    await expect(locating.inspectLocation({ name: "", path: "content" })).rejects.toBeInstanceOf(InvalidLocation);
    await expect(locating.inspectLocation({ name: "content", path: "" })).rejects.toBeInstanceOf(InvalidLocation);
    expect(() => locating.recordRequest({ name: "content", path: "" })).toThrow(InvalidLocation);
    expect(locating._named({ name: "content" })).toEqual([]);
  });

  test("a relative base is made absolute and grounding the same base keeps its places", async () => {
    const locating = new LocatingConcept();
    const grounded = await locating.establishBase({ path: "." });
    if (grounded.status !== "grounded") throw new Error(grounded.detail);
    expect(grounded.path).toBe(resolve("."));

    const here = await locating.inspectLocation({ name: "here", path: "." });
    if (here.status !== "admitted") throw new Error(here.detail);
    expect(await locating.establishBase({ path: "." })).toEqual(grounded);
    expect(locating._named({ name: "here" })).toEqual([{ place: here.place! }]);
  });

  test("admitting a name again relocates it, and overlap follows resolved paths", async () => {
    const locating = new LocatingConcept();
    await mkdir(join(base, "public"));
    await locating.establishBase({ path: base });

    const first = await locating.inspectLocation({ name: "output", path: "public" });
    const second = await locating.inspectLocation({ name: "output", path: "public/nested" });
    if (first.status !== "admitted") throw new Error(first.detail);
    if (second.status !== "admitted") throw new Error(second.detail);
    expect(second.place).toBe(first.place);
    expect(locating._place({ place: second.place! })).toEqual([
      { name: "output", path: join(base, "public", "nested"), real: join(base, "public", "nested"), contained: true, resolved: true },
    ]);

    const parent = await locating.inspectLocation({ name: "public", path: "public" });
    if (parent.status !== "admitted") throw new Error(parent.detail);
    expect(locating._overlapping({ place: second.place!, other: parent.place! })).toEqual({ overlapping: true });
    expect(locating._overlapping({ place: parent.place!, other: second.place! })).toEqual({ overlapping: true });
    expect(locating._overlapping({ place: parent.place!, other: "place:\"absent\"" })).toEqual({ overlapping: false });
  });
});
