const INVALID_ARGUMENTS = "Arguments must be an ordinary dense list of text values.";
const INVALID_REPORT = "A report must be well-formed text.";

const USAGE = `Usage:
  syncpress build [site-directory] [output-directory]
  syncpress build --watch [site-directory] [output-directory]
  syncpress dev [--port PORT] [site-directory] [output-directory]
  syncpress inspect <page-or-route> [site-directory]

Build the configured site rooted at <site-directory>, defaulting to the current
directory. Without an explicit output directory, paths.output (or dist) is used.
`;

const HELP_WORDS = new Set(["--help", "-h", "help"]);
const DEFAULT_DIRECTORY = ".";
const DEFAULT_PORT = 3000;
const MAXIMUM_PORT = 65_535;

export class InvalidArguments extends Error {
  constructor() {
    super(INVALID_ARGUMENTS);
    this.name = "InvalidArguments";
  }
}

const MISUSE = `Invalid usage.\n\n${USAGE}`;

export class InvalidUsage extends Error {
  constructor() {
    super(MISUSE);
    this.name = "InvalidUsage";
  }
}

export class InvalidReport extends Error {
  constructor() {
    super(INVALID_REPORT);
    this.name = "InvalidReport";
  }
}

type Name = "help" | "build" | "watch" | "develop" | "inspect";
type Stream = "output" | "error";
type Reason = "interrupt" | "terminate";
type Interpreted = {
  name: Name;
  directory: string;
  destination: string | null;
  target: string | null;
  port: number | null;
};
type HoldRecord = { hold: string; released: boolean; reason: Reason | null };

const STOP_REQUESTS: readonly (readonly [NodeJS.Signals, Reason])[] = [
  ["SIGINT", "interrupt"],
  ["SIGTERM", "terminate"],
];

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

function isPort(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= MAXIMUM_PORT;
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isArguments(value: unknown): value is string[] {
  return Array.isArray(value) && value.length === Object.keys(value).length && value.every(isText);
}

function request(name: Name, directory: string | undefined, extra: Partial<Interpreted> = {}): Interpreted {
  return {
    name,
    directory: directory ?? DEFAULT_DIRECTORY,
    destination: null,
    target: null,
    port: null,
    ...extra,
  };
}

function port(value: string | undefined): number | undefined {
  const requested = Number(value);
  return Number.isSafeInteger(requested) && requested >= 1 && requested <= MAXIMUM_PORT ? requested : undefined;
}

/** The one grammar an operator's command line is read against. */
function interpretArguments(args: readonly string[]): Interpreted | undefined {
  if (args.length === 0 || (args.length === 1 && HELP_WORDS.has(args[0]!))) return request("help", undefined);

  const [word, ...rest] = args;
  if (word === "inspect") {
    if (rest.length !== 1 && rest.length !== 2) return undefined;
    return request("inspect", rest[1], { target: rest[0]! });
  }

  if (word === "dev") {
    const chosen = rest[0] === "--port" ? port(rest[1]) : DEFAULT_PORT;
    if (chosen === undefined) return undefined;
    const operands = rest[0] === "--port" ? rest.slice(2) : rest;
    if (operands.length > 2) return undefined;
    return request("develop", operands[0], { destination: operands[1] ?? null, port: chosen });
  }

  if (word !== "build") return undefined;
  const watching = rest[0] === "--watch";
  const operands = watching ? rest.slice(1) : rest;
  if (operands.length > 2) return undefined;
  return request(watching ? "watch" : "build", operands[0], { destination: operands[1] ?? null });
}

/** Read one operator's command line, and answer that operator on their own streams. */
export class CommandingConcept {
  readonly #holds = new Map<string, HoldRecord>();

  constructor(
    private readonly write: (stream: Stream, text: string) => void = (stream, text) => {
      if (stream === "output") console.log(text);
      else console.error(text);
    },
    private readonly listen: (ended: (reason: Reason) => void) => () => void = (ended) => {
      const handlers = STOP_REQUESTS.map(([signal, reason]) => {
        const handler = (): void => ended(reason);
        process.once(signal, handler);
        return () => process.off(signal, handler);
      });
      return () => {
        for (const stop of handlers) stop();
      };
    },
  ) {}

  interpret({ arguments: supplied }: { arguments: readonly string[] | null }) {
    const args = supplied ?? process.argv.slice(2);
    if (!isArguments(args)) throw new InvalidArguments();
    const interpreted = interpretArguments(args);
    if (interpreted === undefined) throw new InvalidUsage();

    return { ...interpreted };
  }

  summarize(
    { pages, files, written, replaced, kept, removed }: {
      pages: number;
      files: number;
      written: number;
      replaced: number;
      kept: number;
      removed: number;
    },
  ) {
    for (const count of [pages, files, written, replaced, kept, removed]) {
      if (!Number.isSafeInteger(count) || count < 0) throw new InvalidReport();
    }
    const text = `Built ${pages} ${plural(pages, "page")} from ${files} ${plural(files, "input file")} ` +
      `(${written} written, ${replaced} replaced, ${kept} kept, ${removed} removed).`;
    return { ...this.#report("output", text), text };
  }

  announce({ directory, host, port }: { directory: string; host: string; port: number }) {
    if (!isText(directory) || !isText(host) || !isPort(port)) throw new InvalidReport();
    return this.#report("output", `Serving ${directory} at http://${host}:${port}/`);
  }

  say({ text }: { text: string }) {
    return this.#report("output", text);
  }

  warn({ text }: { text: string }) {
    return this.#report("error", text);
  }

  async hold(): Promise<{ hold: string; reason: Reason }> {
    const record: HoldRecord = { hold: `hold:${this.#holds.size + 1}`, released: false, reason: null };
    this.#holds.set(record.hold, record);
    let stop: (() => void) | undefined;
    try {
      const reason = await new Promise<Reason>((ended) => {
        stop = this.listen(ended);
      });
      record.released = true;
      record.reason = reason;
      return { hold: record.hold, reason };
    } catch (error) {
      this.#holds.delete(record.hold);
      throw error;
    } finally {
      stop?.();
    }
  }

  exit({ code }: { code: number }) {
    if (!Number.isSafeInteger(code) || code < 0 || code > 255) throw new InvalidReport();
    process.exitCode = code;
    return { code };
  }

  #report(stream: Stream, text: string) {
    if (!isText(text)) throw new InvalidReport();
    this.write(stream, text);
    return {};
  }

  _hold({ hold }: { hold: string }): { state: "holding" | "released"; reason: Reason | null }[] {
    const record = this.#holds.get(hold);
    return record === undefined ? [] : [{ state: record.released ? "released" : "holding", reason: record.reason }];
  }

  _holding(): { holding: number } {
    return { holding: [...this.#holds.values()].filter(({ released }) => !released).length };
  }

  _usage(): { usage: string } {
    return { usage: USAGE };
  }

  _misuse(): { misuse: string } {
    return { misuse: MISUSE };
  }
}
