import { describe, expect, test } from "bun:test";
import { AttendingConcept } from "./attending.ts";
import { attending as registration } from "./registry.ts";

describe("Attending", () => {
  test("its principle: each hold ends on its own operator stop request", async () => {
    let ask: ((reason: "interrupt" | "terminate") => void) | undefined;
    let listening = 0;
    const attending = new AttendingConcept((ended) => {
      ask = ended;
      listening += 1;
      return () => {
        listening -= 1;
      };
    });

    const first = attending.hold();
    await Promise.resolve();
    expect(attending._holding()).toEqual({ holding: 1 });
    ask!("interrupt");
    const interrupted = await first;
    expect(attending._hold({ hold: interrupted.hold })).toEqual([{ state: "released", reason: "interrupt" }]);
    expect(listening).toBe(0);

    const second = attending.hold();
    await Promise.resolve();
    ask!("terminate");
    expect((await second).reason).toBe("terminate");
    expect(attending._holding()).toEqual({ holding: 0 });
  });

  test("an unknown hold is absent", () => {
    expect(new AttendingConcept()._hold({ hold: "hold:missing" })).toEqual([]);
  });

  test("registry declares both state observations", () => {
    expect(registration.specification.queries.map(({ name, promise }) => [name, promise])).toEqual([
      ["_hold", "optional"],
      ["_holding", "one"],
    ]);
  });
});
