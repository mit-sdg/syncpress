import { describe, expect, test } from "bun:test";
import {
  CommandingConcept,
  InvalidArguments,
  InvalidCommand,
  InvalidExitCode,
  InvalidStream,
  InvalidText,
} from "./commanding.ts";
import { commanding as registration } from "./registry.ts";

function recorded(arguments_: readonly string[] = []) {
  const written: [string, string][] = [];
  const exits: number[] = [];
  const commanding = new CommandingConcept({
    arguments: () => arguments_,
    write: (stream, text) => written.push([stream, text]),
    exit: (code) => exits.push(code),
  });
  return { commanding, exits, written };
}

describe("Commanding", () => {
  test("its principle: an invocation can be read, answered, and assigned an outcome", () => {
    const { commanding, exits, written } = recorded(["publish", "notes"]);

    expect(commanding.capture({ arguments: null })).toEqual({ words: ["publish", "notes"] });
    expect(commanding.capture({ arguments: ["inspect", "entry"] })).toEqual({ words: ["inspect", "entry"] });
    expect(commanding.recognize({ name: "publish", operands: ["notes"] })).toEqual({
      name: "publish",
      operands: ["notes"],
    });
    commanding.write({ stream: "output", text: "Published notes." });
    commanding.write({ stream: "error", text: "One entry was skipped." });
    expect(commanding.exit({ code: 2 })).toEqual({ code: 2 });

    expect(written).toEqual([
      ["output", "Published notes."],
      ["error", "One entry was skipped."],
    ]);
    expect(exits).toEqual([2]);
  });

  test("captures only ordinary dense text lists and returns a copy", () => {
    const { commanding } = recorded();
    const words = ["build"];
    const captured = commanding.capture({ arguments: words });
    words.push("later");
    expect(captured).toEqual({ words: ["build"] });

    const sparse = new Array<string>(1);
    const extra = ["build"] as string[] & { option?: string };
    extra.option = "watch";
    for (const value of [sparse, extra, ["build", 1]]) {
      expect(() => commanding.capture({ arguments: value as string[] })).toThrow(InvalidArguments);
    }
  });

  test("validates stream names and text before writing", () => {
    const { commanding, written } = recorded();
    expect(() => commanding.write({ stream: "log", text: "hello" })).toThrow(InvalidStream);
    expect(() => commanding.write({ stream: "output", text: "\ud800" })).toThrow(InvalidText);
    expect(written).toEqual([]);
  });

  test("recognizes only named commands with ordinary text operands", () => {
    const { commanding } = recorded();
    expect(() => commanding.recognize({ name: "", operands: [] })).toThrow(InvalidCommand);
    expect(() => commanding.recognize({ name: "build", operands: [1] as unknown as string[] })).toThrow(InvalidCommand);
  });

  test("validates exit status before changing the environment", () => {
    const { commanding, exits } = recorded();
    for (const code of [-1, 1.5, 256]) expect(() => commanding.exit({ code })).toThrow(InvalidExitCode);
    expect(exits).toEqual([]);
  });

  test("registry exposes the generic refusals and no state queries", () => {
    expect(Object.keys(registration.refusals ?? {}).sort()).toEqual([
      "INVALID_ARGUMENTS",
      "INVALID_COMMAND",
      "INVALID_EXIT_CODE",
      "INVALID_STREAM",
      "INVALID_TEXT",
    ]);
    expect(registration.specification.queries).toEqual([]);
  });
});
