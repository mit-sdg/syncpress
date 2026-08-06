type Reason = "interrupt" | "terminate";
type Hold = { released: boolean; reason: Reason | null };

const REQUESTS: readonly (readonly [NodeJS.Signals, Reason])[] = [
  ["SIGINT", "interrupt"],
  ["SIGTERM", "terminate"],
];

/** Hold work open until the operator asks the process to stop. */
export class AttendingConcept {
  readonly #holds = new Map<string, Hold>();
  #nextHold = 1;

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
    const hold = `hold:${this.#nextHold++}`;
    const record: Hold = { released: false, reason: null };
    this.#holds.set(hold, record);
    let stop: (() => void) | undefined;

    try {
      const reason = await new Promise<Reason>((ended) => {
        stop = this.listen(ended);
      });
      record.released = true;
      record.reason = reason;
      return { hold, reason };
    } catch (error) {
      this.#holds.delete(hold);
      throw error;
    } finally {
      stop?.();
    }
  }

  _hold({ hold }: { hold: string }): { state: "holding" | "released"; reason: Reason | null }[] {
    const record = this.#holds.get(hold);
    return record === undefined ? [] : [{ state: record.released ? "released" : "holding", reason: record.reason }];
  }

  _holding(): { holding: number } {
    return { holding: [...this.#holds.values()].filter(({ released }) => !released).length };
  }
}
