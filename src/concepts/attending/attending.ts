type Reason = "interrupt" | "terminate";
type HoldRecord = { hold: string; released: boolean; reason: Reason | null };

const REQUESTS: readonly (readonly [NodeJS.Signals, Reason])[] = [
  ["SIGINT", "interrupt"],
  ["SIGTERM", "terminate"],
];

/** Hold a process open until the operator running it asks for it to stop. */
export class AttendingConcept {
  readonly #holds = new Map<string, HoldRecord>();

  constructor(
    private readonly listen: (ended: (reason: Reason) => void) => () => void = (ended) => {
      const handlers = REQUESTS.map(([signal, reason]) => {
        const handler = (): void => ended(reason);
        process.once(signal, handler);
        return () => process.off(signal, handler);
      });
      return () => {
        for (const stop of handlers) stop();
      };
    },
  ) {}

  async hold(): Promise<{ hold: string; reason: Reason }> {
    const record: HoldRecord = { hold: `hold:${this.#holds.size + 1}`, released: false, reason: null };
    this.#holds.set(record.hold, record);

    const reason = await new Promise<Reason>((ended) => {
      const stop = this.listen((requested) => {
        stop();
        ended(requested);
      });
    });

    record.released = true;
    record.reason = reason;
    return { hold: record.hold, reason };
  }

  _hold({ hold }: { hold: string }): { state: "holding" | "released"; reason: Reason | null }[] {
    const record = this.#holds.get(hold);
    return record === undefined ? [] : [{ state: record.released ? "released" : "holding", reason: record.reason }];
  }

  _holding(): { holding: number } {
    return { holding: [...this.#holds.values()].filter(({ released }) => !released).length };
  }
}
