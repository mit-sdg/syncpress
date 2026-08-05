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
    commanding.announce({ directory: "./site", host: "127.0.0.1", port: 3000 });
    expect(written.at(-1)).toEqual(["output", "Serving ./site at http://127.0.0.1:3000/"]);
    expect(() => commanding.announce({ directory: "./site", host: "127.0.0.1", port: 0 })).toThrow(InvalidReport);

    expect(() => commanding.say({ text: 1 as unknown as string })).toThrow(InvalidReport);
    expect(() => commanding.summarize({ pages: -1, files: 0, written: 0, replaced: 0, kept: 0, removed: 0 }))
      .toThrow(InvalidReport);
  });

  test("a process hold releases its listeners on the operator's stop request", async () => {
    let stop: ((reason: "interrupt" | "terminate") => void) | undefined;
    let listening = 0;
    const commanding = new CommandingConcept(
      () => {},
      (ended) => {
        stop = ended;
        listening += 1;
        return () => {
          listening -= 1;
        };
      },
    );

    const holding = commanding.hold();
    await Promise.resolve();
    expect(commanding._holding()).toEqual({ holding: 1 });
    expect(listening).toBe(1);
    stop!("interrupt");
    const held = await holding;
    expect(commanding._hold({ hold: held.hold })).toEqual([{ state: "released", reason: "interrupt" }]);
    expect(commanding._holding()).toEqual({ holding: 0 });
    expect(listening).toBe(0);
  });

  test("sets a validated process exit status", () => {
    const { commanding } = recorded();
    const previous = process.exitCode;
    try {
      expect(commanding.exit({ code: 1 })).toEqual({ code: 1 });
      expect(process.exitCode).toBe(1);
      expect(() => commanding.exit({ code: 256 })).toThrow(InvalidReport);
    } finally {
      process.exitCode = previous;
    }
  });

  test("registry exposes every refusal and query promise", () => {
    expect(Object.keys(registration.refusals ?? {}).sort()).toEqual([
      "INVALID_ARGUMENTS",
      "INVALID_REPORT",
      "INVALID_USAGE",
    ]);
    expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
      ["_hold", "optional"],
      ["_holding", "one"],
      ["_usage", "one"],
      ["_misuse", "one"],
    ]);
  });
});
