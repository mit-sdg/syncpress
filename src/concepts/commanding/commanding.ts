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
type RequestRecord = {
  request: string;
  name: Name;
  directory: string;
  destination: string | null;
  target: string | null;
  port: number | null;
};
type ReportRecord = { report: string; stream: Stream; text: string };

type Interpreted = Omit<RequestRecord, "request">;

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
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
  readonly #requests = new Map<string, RequestRecord>();
  readonly #reports: ReportRecord[] = [];

  constructor(
    private readonly write: (stream: Stream, text: string) => void = (stream, text) => {
      if (stream === "output") console.log(text);
      else console.error(text);
    },
  ) {}

  interpret({ arguments: args }: { arguments: readonly string[] }) {
    if (!isArguments(args)) throw new InvalidArguments();
    const interpreted = interpretArguments(args);
    if (interpreted === undefined) throw new InvalidUsage();

    const record = { request: `request:${this.#requests.size + 1}`, ...interpreted };
    this.#requests.set(record.request, record);
    return { ...record };
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

  say({ text }: { text: string }) {
    return this.#report("output", text);
  }

  warn({ text }: { text: string }) {
    return this.#report("error", text);
  }

  #report(stream: Stream, text: string) {
    if (!isText(text)) throw new InvalidReport();
    const record = { report: `report:${this.#reports.length + 1}`, stream, text };
    this.#reports.push(record);
    this.write(stream, text);
    return { report: record.report };
  }

  _request({ request: identity }: { request: string }): Interpreted[] {
    const record = this.#requests.get(identity);
    if (record === undefined) return [];
    const { request: _identity, ...fields } = record;
    return [fields];
  }

  _reports(): ReportRecord[] {
    return this.#reports.map((record) => ({ ...record }));
  }

  _usage(): { usage: string } {
    return { usage: USAGE };
  }

  _misuse(): { misuse: string } {
    return { misuse: MISUSE };
  }
}
