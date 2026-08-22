import type { SyncpressWire } from "../../generated/wire.ts";
import {
  formatSyncpressBuildReport,
  formatSyncpressInspectionReport,
  formatSyncpressServerReport,
  recognizeSyncpressCommand,
  SYNCPRESS_MISUSE,
} from "./command-line.ts";
import {
  answer,
  BATCH_TIMEOUT_MS,
  buildSite,
  createSyncpressRuntime,
  inspectSite,
  reason,
  type BuildResult,
  type Gateway,
} from "./api.ts";

export type SiteWatcher = { close(): Promise<void> };
export type DevelopmentServer = { host: string; port: number; close(): Promise<void> };

const SETTLING_MS = 75;
const ATTEND_MS = 500;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const CLI_CONTEXT = "Could not answer the command line";

export async function watchSite(
  projectDirectory = ".",
  destination?: string,
  options: { onBuild?: (result: BuildResult, outputDirectory: string) => void; onError?: (error: unknown) => void } = {},
): Promise<SiteWatcher> {
  const initial = await buildSite(projectDirectory, destination);
  options.onBuild?.(initial, initial.outputDirectory);

  const { gateway } = createSyncpressRuntime();
  const open = async (output: string): Promise<string> => answer(
    await gateway.invoke("/watch/open", { directory: projectDirectory, settling: SETTLING_MS, output }),
    "Could not watch the site directory",
  ).watch;
  let output = initial.outputDirectory;
  let watch = await open(output);

  let closing = false;
  const watchLoop = (async (): Promise<void> => {
    try {
      while (!closing) {
        const { changed, watching } = answer(
          await gateway.invoke("/watch/attend", { watch, within: ATTEND_MS }),
          "Could not watch the site directory",
        );
        if (!watching) return;
        if (!changed) continue;
        const built = await buildSite(projectDirectory, destination);
        if (built.outputDirectory !== output) {
          answer(await gateway.invoke("/watch/close", { watch }), "Could not replace the site watch");
          watch = await open(built.outputDirectory);
          output = built.outputDirectory;
        }
        options.onBuild?.(built, built.outputDirectory);
      }
    } catch (error) {
      if (!closing) options.onError?.(error);
    }
  })();

  return {
    async close(): Promise<void> {
      if (closing) return;
      closing = true;
      try {
        answer(await gateway.invoke("/watch/close", { watch }), "Could not close the site watch");
      } finally {
        await watchLoop;
      }
    },
  };
}

export async function serveSite(
  projectDirectory = ".",
  destination?: string,
  options: { host?: string; port?: number; onError?: (error: unknown) => void } = {},
): Promise<DevelopmentServer> {
  const { gateway } = createSyncpressRuntime();
  const opened = answer(
    await gateway.invoke("/serve/open", { host: options.host ?? DEFAULT_HOST, port: options.port ?? DEFAULT_PORT }),
    "Could not serve the site",
  );
  const publish = async (directory: string): Promise<void> => {
    const published = await gateway.invoke("/serve/publish", { server: opened.server, directory });
    if (!published.ok) throw new Error(`Could not serve the site: ${reason(published.error)}`);
  };

  let watcher: SiteWatcher | undefined;
  let firstPublication: Promise<void> | undefined;
  let publishedDirectory: string | undefined;
  try {
    watcher = await watchSite(projectDirectory, destination, {
      onBuild: (result, outputDirectory) => {
        const outputChanged = result.written > 0 || result.replaced > 0 || result.removed > 0;
        if (publishedDirectory === outputDirectory && !outputChanged) return;
        publishedDirectory = outputDirectory;
        const publishing = publish(outputDirectory);
        if (firstPublication === undefined) firstPublication = publishing;
        else void publishing.catch((error) => options.onError?.(error));
      },
      onError: options.onError,
    });
    if (firstPublication === undefined) throw new Error("The initial site build was not published.");
    await firstPublication;
  } catch (error) {
    await Promise.allSettled([watcher?.close(), gateway.invoke("/serve/close", { server: opened.server })]);
    throw error;
  }

  return {
    host: opened.host,
    port: opened.port,
    async close(): Promise<void> {
      const closed = await Promise.allSettled([
        watcher.close(),
        gateway.invoke("/serve/close", { server: opened.server }),
      ]);
      const failures = closed.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
      const serverClose = closed[1];
      if (serverClose?.status === "fulfilled" && !serverClose.value.ok) {
        failures.push(new Error(`Could not close the site server: ${reason(serverClose.value.error)}`));
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new AggregateError(failures, "Could not close the development server.");
    },
  };
}

class ReportedError extends Error {}
type InterpretedCommand = NonNullable<ReturnType<typeof recognizeSyncpressCommand>>;

function operatorSession(gateway: Gateway) {
  const write = async (stream: "output" | "error", text: string) =>
    answer(await gateway.invoke("/cli/write", { stream, text }), CLI_CONTEXT);
  return {
    async interpret(args: string[] | null): Promise<InterpretedCommand> {
      const interpreted = await gateway.invoke("/cli/interpret", { arguments: args });
      if (interpreted.ok) {
        const command = recognizeSyncpressCommand(interpreted.value.words);
        if (command === undefined) throw new Error("The accepted command line could not be interpreted.");
        return command;
      }
      if (interpreted.error.kind === "domain" && interpreted.error.value === "INVALID_USAGE") {
        answer(await gateway.invoke("/cli/misuse", {}), CLI_CONTEXT);
        throw new ReportedError(SYNCPRESS_MISUSE);
      }
      return answer(interpreted, CLI_CONTEXT);
    },
    usage: async () => answer(await gateway.invoke("/cli/usage", {}), CLI_CONTEXT),
    summarize: async ({ pages, inputFiles, written, replaced, kept, removed }: BuildResult) => {
      const text = formatSyncpressBuildReport({ pages, files: inputFiles, written, replaced, kept, removed });
      if (text === undefined) throw new Error("Could not format the build report.");
      return write("output", text);
    },
    inspect: async (inspection: unknown) => {
      const text = formatSyncpressInspectionReport(inspection);
      if (text === undefined) throw new Error("Could not format the inspection report.");
      return write("output", text);
    },
    announce: async (directory: string, host: string, port: number) => {
      const text = formatSyncpressServerReport(directory, host, port);
      if (text === undefined) throw new Error("Could not format the server report.");
      return write("output", text);
    },
    warn: async (error: unknown) => write("error", error instanceof Error ? error.message : String(error)),
    stopped: async () => answer(await gateway.invoke("/cli/hold", {}, { timeoutMs: BATCH_TIMEOUT_MS }), CLI_CONTEXT),
    exit: async (code: number) => answer(await gateway.invoke("/cli/exit", { code }), CLI_CONTEXT),
  };
}

export async function runCli(args?: string[]): Promise<void> {
  const operator = operatorSession(createSyncpressRuntime().gateway);
  try {
    await carryOut(operator, await operator.interpret(args ?? null));
  } catch (error) {
    if (!(error instanceof ReportedError)) await operator.warn(error);
    throw error;
  }
}

export async function runExecutable(): Promise<void> {
  try {
    await runCli();
  } catch {
    await operatorSession(createSyncpressRuntime().gateway).exit(1);
  }
}

async function carryOut(
  operator: ReturnType<typeof operatorSession>,
  request: InterpretedCommand,
): Promise<void> {
  const { name, operands } = request;
  if (name === "help" && operands.length === 0) return void await operator.usage();
  if (name === "inspect" && operands.length === 2) {
    return void await operator.inspect(await inspectSite(operands[1]!, operands[0]!));
  }
  if ((name === "build" || name === "watch") && (operands.length === 1 || operands.length === 2)) {
    const [directory, destination] = operands as [string, string?];
    if (name === "build") return void await operator.summarize(await buildSite(directory, destination));
    const watcher = await watchSite(directory, destination, {
      onBuild: (result) => void operator.summarize(result),
      onError: (error) => void operator.warn(error),
    });
    try {
      await operator.stopped();
    } finally {
      await watcher.close();
    }
    return;
  }
  if (name === "develop" && (operands.length === 2 || operands.length === 3)) {
    const [directory, portText, destination] = operands as [string, string, string?];
    const port = Number(portText);
    const server = await serveSite(directory, destination, { port, onError: (error) => void operator.warn(error) });
    try {
      await operator.announce(directory, server.host, server.port);
      await operator.stopped();
    } finally {
      await server.close();
    }
    return;
  }
  throw new Error(`Unsupported interpreted command: ${JSON.stringify(request)}`);
}
