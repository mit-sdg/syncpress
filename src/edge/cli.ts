import type { SyncpressWire } from "../../generated/wire.ts";
import { answer, BATCH_TIMEOUT_MS, createSyncpressRuntime, type Gateway } from "./application.ts";
import { serveSite } from "./server.ts";
import { buildSite, inspectSite, type BuildResult } from "./site.ts";
import { watchSite } from "./watch.ts";

const CONTEXT = "Could not answer the command line";

/** One session with the operator: their grammar, their streams, and their stop request. */
function operatorSession(gateway: Gateway) {
  return {
    /** Misuse is the operator's own problem, so it is reported in the words Commanding owns. */
    async interpret(args: string[]): Promise<SyncpressWire["/cli/interpret"]["output"]> {
      const interpreted = await gateway.invoke("/cli/interpret", { arguments: args });
      if (interpreted.ok) return interpreted.value;
      if (interpreted.error.kind === "domain" && interpreted.error.value === "INVALID_USAGE") {
        throw new Error(answer(await gateway.invoke("/cli/misuse", {}), CONTEXT).misuse);
      }
      return answer(interpreted, CONTEXT);
    },
    usage: async () => answer(await gateway.invoke("/cli/usage", {}), CONTEXT),
    say: async (text: string) => answer(await gateway.invoke("/cli/say", { text }), CONTEXT),
    summarize: async ({ pages, inputFiles, written, replaced, kept, removed }: BuildResult) =>
      answer(
        await gateway.invoke("/cli/announce", { pages, files: inputFiles, written, replaced, kept, removed }),
        CONTEXT,
      ),
    announce: async (directory: string, host: string, port: number) =>
      answer(await gateway.invoke("/cli/serving", { directory, host, port }), CONTEXT),
    warn: async (error: unknown) =>
      answer(
        await gateway.invoke("/cli/warn", { text: error instanceof Error ? error.message : String(error) }),
        CONTEXT,
      ),
    stopped: async () => answer(await gateway.invoke("/cli/hold", {}, { timeoutMs: BATCH_TIMEOUT_MS }), CONTEXT),
  };
}

/** Interpret one command line and carry out what it asks for, until it is done or stopped. */
export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const operator = operatorSession(createSyncpressRuntime().gateway);
  try {
    await carryOut(operator, await operator.interpret(args));
  } catch (error) {
    await operator.warn(error);
    throw error;
  }
}

async function carryOut(
  operator: ReturnType<typeof operatorSession>,
  request: SyncpressWire["/cli/interpret"]["output"],
): Promise<void> {
  const destination = request.destination ?? undefined;
  if (request.name === "help") {
    await operator.usage();
    return;
  }

  if (request.name === "inspect") {
    await operator.say(JSON.stringify(await inspectSite(request.directory, request.target!), null, 2));
    return;
  }

  if (request.name === "build") {
    await operator.summarize(await buildSite(request.directory, destination));
    return;
  }

  const warn = (error: unknown): void => void operator.warn(error);
  if (request.name === "develop") {
    const server = await serveSite(request.directory, destination, { port: request.port ?? undefined, onError: warn });
    await operator.announce(request.directory, server.host, server.port);
    await operator.stopped();
    await server.close();
    return;
  }

  const watcher = await watchSite(request.directory, destination, {
    onBuild: (result) => void operator.summarize(result),
    onError: warn,
  });
  await operator.stopped();
  await watcher.close();
}
