import type { SyncpressWire } from "../../generated/wire.ts";
import { createSyncpressRuntime, type Gateway } from "./application.ts";
import { serveSite } from "./server.ts";
import { buildSite, inspectSite, type BuildResult } from "./site.ts";
import { watchSite } from "./watch.ts";

function answer<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (result.ok) return result.value;
  const error = result.error as { kind: string; value?: unknown; detail?: string; code?: string };
  throw new Error(error.kind === "domain" ? String(error.value) : error.detail ?? String(error.code));
}

/** One console session: the operator's grammar, streams, and stop request. */
function session() {
  const { gateway }: { gateway: Gateway } = createSyncpressRuntime();
  return {
    /** Misuse is the operator's problem, so it is reported in the words Commanding owns. */
    async interpret(args: string[]): Promise<SyncpressWire["/cli/interpret"]["output"]> {
      const interpreted = await gateway.invoke("/cli/interpret", { arguments: args });
      if (interpreted.ok) return interpreted.value;
      if (interpreted.error.kind === "domain" && interpreted.error.value === "INVALID_USAGE") {
        throw new Error(answer(await gateway.invoke("/cli/misuse", {})).misuse);
      }
      return answer(interpreted);
    },
    usage: async () => answer(await gateway.invoke("/cli/usage", {})),
    announce: async ({ pages, inputFiles, written, replaced, kept, removed }: BuildResult) =>
      answer(await gateway.invoke("/cli/announce", { pages, files: inputFiles, written, replaced, kept, removed })),
    warn: async (error: unknown) =>
      answer(await gateway.invoke("/cli/warn", { text: error instanceof Error ? error.message : String(error) })),
    say: async (text: string) => answer(await gateway.invoke("/cli/say", { text })),
    held: async () => answer(await gateway.invoke("/cli/hold", {}, { timeoutMs: 2_147_483_647 })),
  };
}

/** Interpret one command line and run what it asks for until it is done or stopped. */
export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const console_ = session();
  const request = await console_.interpret(args);

  if (request.name === "help") {
    await console_.usage();
    return;
  }

  if (request.name === "inspect") {
    await console_.say(JSON.stringify(await inspectSite(request.directory, request.target!), null, 2));
    return;
  }

  if (request.name === "build") {
    await console_.announce(await buildSite(request.directory, request.destination ?? undefined));
    return;
  }

  if (request.name === "develop") {
    const server = await serveSite(request.directory, request.destination ?? undefined, {
      port: request.port ?? undefined,
      onError: (error) => void console_.warn(error),
    });
    await console_.say(`Serving ${request.directory} at http://${server.host}:${server.port}/`);
    await console_.held();
    await server.close();
    return;
  }

  const watcher = await watchSite(request.directory, request.destination ?? undefined, {
    onBuild: (result) => void console_.announce(result),
    onError: (error) => void console_.warn(error),
  });
  await console_.held();
  await watcher.close();
}
