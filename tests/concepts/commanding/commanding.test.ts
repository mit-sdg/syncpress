import { describe, expect, test } from "bun:test";
import {
  CommandingConcept,
  ExitSelected,
  InvalidArguments,
  InvalidExitCode,
  InvalidStream,
  InvalidText,
  InvocationCaptured,
} from "@concepts/commanding/commanding.ts";
import { commanding as registration } from "@concepts/commanding/registry.ts";

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

    expect(commanding.captureArguments({ arguments: null })).toEqual({ words: ["publish", "notes"] });
    expect(commanding.captureArguments({ arguments: null })).toEqual({ words: ["publish", "notes"] });
    expect(() => commanding.captureArguments({ arguments: ["inspect", "entry"] })).toThrow(InvocationCaptured);
    commanding.writeLine({ stream: "output", text: "Published notes." });
    commanding.writeLine({ stream: "error", text: "One entry was skipped." });
    expect(commanding.setExitStatus({ code: 2 })).toEqual({ code: 2, changed: true });
    expect(commanding.setExitStatus({ code: 2 })).toEqual({ code: 2, changed: false });
    expect(() => commanding.setExitStatus({ code: 1 })).toThrow(ExitSelected);

    expect(written).toEqual([
      ["output", "Published notes."],
      ["error", "One entry was skipped."],
    ]);
    expect(exits).toEqual([2]);
    expect(commanding._invocation()).toEqual([{ words: ["publish", "notes"] }]);
    expect(commanding._outcome()).toEqual([{ code: 2 }]);
  });

  test("captures only ordinary dense text lists and returns a copy", () => {
    const { commanding } = recorded();
    const words = ["build"];
    const captured = commanding.captureArguments({ arguments: words });
    words.push("later");
    expect(captured).toEqual({ words: ["build"] });

    const sparse = new Array<string>(1);
    const extra = ["build"] as string[] & { option?: string };
    extra.option = "watch";
    for (const value of [sparse, extra, ["build", 1]]) {
      expect(() => commanding.captureArguments({ arguments: value as string[] })).toThrow(InvalidArguments);
    }
  });

  test("validates stream names and text before writing", () => {
    const { commanding, written } = recorded();
    expect(() => commanding.writeLine({ stream: "log", text: "hello" })).toThrow(InvalidStream);
    expect(() => commanding.writeLine({ stream: "output", text: "\ud800" })).toThrow(InvalidText);
    expect(written).toEqual([]);
  });

  test("validates exit status before changing the environment", () => {
    const { commanding, exits } = recorded();
    for (const code of [-1, 1.5, 256]) expect(() => commanding.setExitStatus({ code })).toThrow(InvalidExitCode);
    expect(exits).toEqual([]);
  });

  test("registry exposes invocation refusals and lifecycle queries", () => {
    expect(Object.keys(registration.refusals ?? {}).sort()).toEqual([
      "EXIT_SELECTED",
      "INVALID_ARGUMENTS",
      "INVALID_EXIT_CODE",
      "INVALID_STREAM",
      "INVALID_TEXT",
      "INVOCATION_CAPTURED",
    ]);
    expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
      ["_invocation", "optional"],
      ["_outcome", "optional"],
    ]);
  });
});
