import { describe, expect, test } from "bun:test";
import { HoldingConcept } from "../../../src/concepts/holding/holding.ts";
import { holding as registration } from "../../../src/concepts/holding/registry.ts";

describe("Holding", () => {
  test("its principle: each hold ends on its own operator stop request", async () => {
    let ask: ((reason: "interrupt" | "terminate") => void) | undefined;
    let listening = 0;
    const holding = new HoldingConcept((ended) => {
      ask = ended;
      listening += 1;
      return () => {
        listening -= 1;
      };
    });

    const first = holding.awaitStop();
    await Promise.resolve();
    expect(holding._holding()).toEqual({ holding: 1 });
    ask!("interrupt");
    const interrupted = await first;
    expect(holding._hold({ hold: interrupted.hold })).toEqual([{ state: "released", reason: "interrupt" }]);
    expect(listening).toBe(0);

    const second = holding.awaitStop();
    await Promise.resolve();
    ask!("terminate");
    expect((await second).reason).toBe("terminate");
    expect(holding._holding()).toEqual({ holding: 0 });
  });

  test("an unknown hold is absent", () => {
    expect(new HoldingConcept()._hold({ hold: "hold:missing" })).toEqual([]);
  });

  test("registry declares both state observations", () => {
    expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
      ["_hold", "optional"],
      ["_holding", "one"],
    ]);
  });
});
