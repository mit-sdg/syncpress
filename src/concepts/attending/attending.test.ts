import { describe, expect, test } from "bun:test";
import { AttendingConcept } from "./attending.ts";

describe("Attending", () => {
  test("its principle: a hold ends only when the operator asks it to", async () => {
    let ask: ((reason: "interrupt" | "terminate") => void) | undefined;
    let listening = 0;
    const attending = new AttendingConcept((ended) => {
      ask = ended;
      listening += 1;
      return () => {
        listening -= 1;
      };
    });

    expect(attending._holding()).toEqual({ holding: 0 });
    const holding = attending.hold();
    await Promise.resolve();
    expect(attending._holding()).toEqual({ holding: 1 });
    expect(listening).toBe(1);

    ask!("interrupt");
    const held = await holding;
    expect(held.reason).toBe("interrupt");
    expect(attending._hold({ hold: held.hold })).toEqual([{ state: "released", reason: "interrupt" }]);
    expect(attending._holding()).toEqual({ holding: 0 });
    expect(listening).toBe(0);
  });

  test("a later hold waits again and reports its own reason", async () => {
    let ask: ((reason: "interrupt" | "terminate") => void) | undefined;
    const attending = new AttendingConcept((ended) => {
      ask = ended;
      return () => {};
    });

    const first = attending.hold();
    await Promise.resolve();
    ask!("interrupt");
    await first;

    const second = attending.hold();
    await Promise.resolve();
    ask!("terminate");
    expect((await second).reason).toBe("terminate");
    expect(attending._hold({ hold: "hold:absent" })).toEqual([]);
  });
});
