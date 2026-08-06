type CommandName = "help" | "build" | "watch" | "develop" | "inspect";
type Command = {
  name: CommandName;
  directory: string;
  destination: string | null;
  target: string | null;
  port: number | null;
};

const HELP_WORDS = new Set(["--help", "-h", "help"]);
const DEFAULT_DIRECTORY = ".";
const DEFAULT_PORT = 3000;
const MAXIMUM_PORT = 65_535;

export const SYNCPRESS_USAGE = `Usage:
  syncpress build [site-directory] [output-directory]
  syncpress build --watch [site-directory] [output-directory]
  syncpress dev [--port PORT] [site-directory] [output-directory]
  syncpress inspect <page-or-route> [site-directory]

Build the configured site rooted at <site-directory>, defaulting to the current
directory. Without an explicit output directory, paths.output (or dist) is used.
`;

export const SYNCPRESS_MISUSE = `Invalid usage.\n\n${SYNCPRESS_USAGE}`;

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function command(name: CommandName, directory: string | undefined, extra: Partial<Command> = {}): Command {
  return {
    name,
    directory: directory ?? DEFAULT_DIRECTORY,
    destination: null,
    target: null,
    port: null,
    ...extra,
  };
}

function commandPort(value: string | undefined): number | undefined {
  const requested = Number(value);
  return Number.isSafeInteger(requested) && requested >= 1 && requested <= MAXIMUM_PORT ? requested : undefined;
}

export function parseSyncpressCommand(words: unknown): Command | undefined {
  if (!Array.isArray(words) || !words.every(isText)) return undefined;
  if (words.length === 0 || (words.length === 1 && HELP_WORDS.has(words[0]!))) return command("help", undefined);

  const [word, ...rest] = words;
  if (word === "inspect") {
    return rest.length === 1 || rest.length === 2
      ? command("inspect", rest[1], { target: rest[0]! })
      : undefined;
  }
  if (word === "dev") {
    const chosen = rest[0] === "--port" ? commandPort(rest[1]) : DEFAULT_PORT;
    if (chosen === undefined) return undefined;
    const operands = rest[0] === "--port" ? rest.slice(2) : rest;
    return operands.length <= 2
      ? command("develop", operands[0], { destination: operands[1] ?? null, port: chosen })
      : undefined;
  }
  if (word !== "build") return undefined;
  const watching = rest[0] === "--watch";
  const operands = watching ? rest.slice(1) : rest;
  return operands.length <= 2
    ? command(watching ? "watch" : "build", operands[0], { destination: operands[1] ?? null })
    : undefined;
}

export function recognizeSyncpressCommand(words: unknown): { name: CommandName; operands: string[] } | undefined {
  const interpreted = parseSyncpressCommand(words);
  if (interpreted === undefined) return undefined;
  const { name, directory, destination, target, port } = interpreted;
  if (name === "help") return { name, operands: [] };
  if (name === "inspect") return { name, operands: [target!, directory] };
  if (name === "develop") {
    return { name, operands: destination === null ? [directory, String(port)] : [directory, String(port), destination] };
  }
  return { name, operands: destination === null ? [directory] : [directory, destination] };
}

export function formatSyncpressBuildReport(input: Record<string, unknown>): string | undefined {
  const counts = [input.pages, input.files, input.written, input.replaced, input.kept, input.removed];
  if (!counts.every((count) => Number.isSafeInteger(count) && (count as number) >= 0)) return undefined;
  const [pages, files, written, replaced, kept, removed] = counts as number[];
  const plural = (count: number, noun: string): string => count === 1 ? noun : `${noun}s`;
  return `Built ${pages} ${plural(pages, "page")} from ${files} ${plural(files, "input file")} ` +
    `(${written} written, ${replaced} replaced, ${kept} kept, ${removed} removed).`;
}

export function formatSyncpressServerReport(directory: unknown, host: unknown, port: unknown): string | undefined {
  return isText(directory) && isText(host) && Number.isSafeInteger(port) && (port as number) >= 1 && (port as number) <= MAXIMUM_PORT
    ? `Serving ${directory} at http://${host}:${port}/`
    : undefined;
}

export function formatSyncpressInspectionReport(inspection: unknown): string | undefined {
  try {
    return JSON.stringify(inspection, null, 2);
  } catch {
    return undefined;
  }
}

export const syncpressCommandComputations = {
  syncpressCommandValid: ({ words }: { words: unknown }) => recognizeSyncpressCommand(words) !== undefined,
  syncpressCommandName: ({ words }: { words: unknown }) => recognizeSyncpressCommand(words)?.name ?? null,
  syncpressCommandOperands: ({ words }: { words: unknown }) => recognizeSyncpressCommand(words)?.operands ?? null,
  syncpressUsage: () => SYNCPRESS_USAGE,
  syncpressMisuse: () => SYNCPRESS_MISUSE,
};
