const INVALID_ARGUMENTS = "Arguments must be an ordinary dense list of text values.";
const INVALID_COMMAND = "A recognized command needs a non-empty text name and ordinary dense text operands.";
const INVALID_STREAM = "A command stream must be output or error.";
const INVALID_TEXT = "A command line must be well-formed text.";
const INVALID_EXIT_CODE = "A command exit code must be a safe integer from 0 through 255.";

type Stream = "output" | "error";
type Environment = {
  arguments(): readonly string[];
  write(stream: Stream, text: string): void;
  exit(code: number): void;
};

const host: Environment = {
  arguments: () => process.argv.slice(2),
  write(stream, text) {
    if (stream === "output") console.log(text);
    else console.error(text);
  },
  exit: (code) => {
    process.exitCode = code;
  },
};

export class InvalidArguments extends Error {
  constructor() {
    super(INVALID_ARGUMENTS);
    this.name = "InvalidArguments";
  }
}

export class InvalidCommand extends Error {
  constructor() {
    super(INVALID_COMMAND);
    this.name = "InvalidCommand";
  }
}

export class InvalidStream extends Error {
  constructor() {
    super(INVALID_STREAM);
    this.name = "InvalidStream";
  }
}

export class InvalidText extends Error {
  constructor() {
    super(INVALID_TEXT);
    this.name = "InvalidText";
  }
}

export class InvalidExitCode extends Error {
  constructor() {
    super(INVALID_EXIT_CODE);
    this.name = "InvalidExitCode";
  }
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.isWellFormed();
}

function isArguments(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === value.length && keys.every((key, index) => key === String(index)) && value.every(isText);
}

/** Expose one command-line invocation without leaking ambient process access. */
export class CommandingConcept {
  constructor(private readonly environment: Environment = host) {}

  capture({ arguments: supplied }: { arguments: readonly string[] | null }) {
    const words = supplied ?? this.environment.arguments();
    if (!isArguments(words)) throw new InvalidArguments();
    return { words: [...words] };
  }

  recognize({ name, operands }: { name: string; operands: readonly string[] }) {
    if (!isText(name) || name === "" || !isArguments(operands)) throw new InvalidCommand();
    return { name, operands: [...operands] };
  }

  write({ stream, text }: { stream: string; text: string }) {
    if (stream !== "output" && stream !== "error") throw new InvalidStream();
    if (!isText(text)) throw new InvalidText();
    this.environment.write(stream, text);
    return { stream, text };
  }

  exit({ code }: { code: number }) {
    if (!Number.isSafeInteger(code) || code < 0 || code > 255) throw new InvalidExitCode();
    this.environment.exit(code);
    return { code };
  }
}
