import { expect, test } from "bun:test";
import { computations } from "../src/concept-set.ts";
import {
  formatSyncpressBuildReport,
  formatSyncpressInspectionReport,
  formatSyncpressServerReport,
  parseSyncpressCommand,
  recognizeSyncpressCommand,
  SYNCPRESS_MISUSE,
  SYNCPRESS_USAGE,
} from "../src/compositions/command-line.ts";
import { syncpressComputations } from "../src/compositions/computations.ts";

test("the concept set registers every named pure computation", () => {
  expect(Object.keys(computations)).toEqual(Object.keys(syncpressComputations));
  for (const [name, fn] of Object.entries(syncpressComputations)) {
    expect(computations[name as keyof typeof computations]).toMatchObject({ computationName: name, fn });
  }
});

test("Syncpress command policy is an application computation", () => {
  expect(parseSyncpressCommand([])).toMatchObject({ name: "help", directory: "." });
  expect(parseSyncpressCommand(["-h"])).toMatchObject({ name: "help" });
  expect(parseSyncpressCommand(["help"])).toMatchObject({ name: "help" });
  expect(parseSyncpressCommand(["build", "./site", "out"])).toEqual({
    name: "build",
    directory: "./site",
    destination: "out",
    target: null,
    port: null,
  });
  expect(parseSyncpressCommand(["build", "--watch"])).toMatchObject({ name: "watch", directory: "." });
  expect(parseSyncpressCommand(["dev", "--port", "8080"])).toMatchObject({ name: "develop", port: 8080 });
  expect(parseSyncpressCommand(["dev"])).toMatchObject({ name: "develop", port: 3000 });
  expect(parseSyncpressCommand(["inspect", "/posts/first/", "./site"])).toMatchObject({
    name: "inspect",
    target: "/posts/first/",
    directory: "./site",
  });

  for (const words of [
    ["build", "a", "b", "c"],
    ["publish"],
    ["inspect"],
    ["dev", "--port", "0"],
    ["dev", "--port", "70000"],
    ["dev", "--port", "eight"],
    ["--help", "extra"],
  ]) expect(parseSyncpressCommand(words)).toBeUndefined();

  expect(SYNCPRESS_MISUSE).toBe(`Invalid usage.\n\n${SYNCPRESS_USAGE}`);
  expect(recognizeSyncpressCommand(["build", "./site", "out"])).toEqual({
    name: "build",
    operands: ["./site", "out"],
  });
  expect(recognizeSyncpressCommand(["dev", "--port", "8080", "./site"])).toEqual({
    name: "develop",
    operands: ["./site", "8080"],
  });
});

test("Syncpress reports are pure application wording", () => {
  expect(formatSyncpressBuildReport({ pages: 1, files: 1, written: 0, replaced: 0, kept: 1, removed: 0 }))
    .toBe("Built 1 page from 1 input file (0 written, 0 replaced, 1 kept, 0 removed).");
  expect(formatSyncpressBuildReport({ pages: -1, files: 1, written: 0, replaced: 0, kept: 0, removed: 0 }))
    .toBeUndefined();
  expect(formatSyncpressServerReport("./site", "127.0.0.1", 3000))
    .toBe("Serving ./site at http://127.0.0.1:3000/");
  expect(formatSyncpressServerReport("./site", "127.0.0.1", 0)).toBeUndefined();
  expect(formatSyncpressInspectionReport({ route: "/" })).toBe('{\n  "route": "/"\n}');
});
