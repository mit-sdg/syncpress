import { describe, expect, test } from "bun:test";
import { CommandingConcept, InvalidArguments, InvalidReport, InvalidUsage } from "./commanding.ts";
import { commanding as registration } from "./registry.ts";

function recorded() {
  const written: [string, string][] = [];
  return { written, commanding: new CommandingConcept((stream, text) => written.push([stream, text])) };
}

describe("Commanding", () => {
  test("its principle: every supported command line reads as one checked request", () => {
    const { commanding } = recorded();

    expect(commanding.interpret({ arguments: [] })).toMatchObject({ name: "help", directory: "." });
    expect(commanding.interpret({ arguments: ["--help"] })).toMatchObject({ name: "help" });
    expect(commanding.interpret({ arguments: ["build", "./site", "out"] })).toMatchObject({
      name: "build",
      directory: "./site",
      destination: "out",
      port: null,
      target: null,
    });
    expect(commanding.interpret({ arguments: ["build", "--watch"] })).toMatchObject({
      name: "watch",
      directory: ".",
      destination: null,
    });
    expect(commanding.interpret({ arguments: ["dev", "--port", "8080"] })).toMatchObject({
      name: "develop",
      directory: ".",
      port: 8080,
    });
    expect(commanding.interpret({ arguments: ["dev"] })).toMatchObject({ name: "develop", port: 3000 });
    expect(commanding.interpret({ arguments: ["inspect", "/posts/first/"] })).toMatchObject({
      name: "inspect",
      target: "/posts/first/",
      directory: ".",
    });
    expect(commanding.interpret({ arguments: ["inspect", "/posts/first/", "./site"] })).toMatchObject({
      directory: "./site",
    });
  });

  test("a request is answerable again from its identity", () => {
    const { commanding } = recorded();
    const request = commanding.interpret({ arguments: ["build", "./site"] });
    expect(commanding._request({ request: request.request })).toEqual([
      { name: "build", directory: "./site", destination: null, target: null, port: null },
    ]);
    expect(commanding._request({ request: "request:absent" })).toEqual([]);
  });

  test("anything outside the grammar is refused with the usage text", () => {
    const { commanding } = recorded();
    for (
      const args of [
        ["build", "a", "b", "c"],
        ["publish"],
        ["inspect"],
        ["inspect", "a", "b", "c"],
        ["dev", "--port", "0"],
        ["dev", "--port", "70000"],
        ["dev", "--port", "eight"],
        ["dev", "a", "b", "c"],
        ["--help", "extra"],
      ]
    ) {
      expect(() => commanding.interpret({ arguments: args })).toThrow(InvalidUsage);
    }
    expect(() => commanding.interpret({ arguments: ["build", 1] as unknown as string[] })).toThrow(InvalidArguments);
    expect(commanding._misuse().misuse).toStartWith("Invalid usage.\n\n");
    expect(commanding._misuse().misuse).toContain(commanding._usage().usage);
  });

  test("reports reach the operator's streams in the order they were said", () => {
    const { commanding, written } = recorded();

    commanding.say({ text: "first" });
    commanding.warn({ text: "second" });
    const summarized = commanding.summarize({ pages: 1, files: 1, written: 0, replaced: 0, kept: 1, removed: 0 });

    expect(summarized.text).toBe("Built 1 page from 1 input file (0 written, 0 replaced, 1 kept, 0 removed).");
    expect(commanding.summarize({ pages: 2, files: 3, written: 3, replaced: 0, kept: 0, removed: 1 }).text).toBe(
      "Built 2 pages from 3 input files (3 written, 0 replaced, 0 kept, 1 removed).",
    );
    expect(written).toEqual([
      ["output", "first"],
      ["error", "second"],
      ["output", summarized.text],
      ["output", "Built 2 pages from 3 input files (3 written, 0 replaced, 0 kept, 1 removed)."],
    ]);
    expect(commanding._reports().map(({ stream }) => stream)).toEqual(["output", "error", "output", "output"]);

    expect(() => commanding.say({ text: 1 as unknown as string })).toThrow(InvalidReport);
    expect(() => commanding.summarize({ pages: -1, files: 0, written: 0, replaced: 0, kept: 0, removed: 0 }))
      .toThrow(InvalidReport);
  });

  test("registry exposes every refusal and query promise", () => {
    expect(Object.keys(registration.refusals ?? {}).sort()).toEqual([
      "INVALID_ARGUMENTS",
      "INVALID_REPORT",
      "INVALID_USAGE",
    ]);
    expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
      ["_request", "optional"],
      ["_reports", "many"],
      ["_usage", "one"],
      ["_misuse", "one"],
    ]);
  });
});
