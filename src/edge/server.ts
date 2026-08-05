import { answer, createSyncpressRuntime, reason, type Gateway } from "./application.ts";
import { watchSite, type SiteWatcher } from "./watch.ts";

export type DevelopmentServer = { host: string; port: number; close(): Promise<void> };

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;

/** Serve only reconciled output, and tell connected browsers after each successful rebuild. */
export async function serveSite(
  projectDirectory = ".",
  destination?: string,
  options: { host?: string; port?: number; onError?: (error: unknown) => void } = {},
): Promise<DevelopmentServer> {
  const { gateway }: { gateway: Gateway } = createSyncpressRuntime();
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
  try {
    watcher = await watchSite(projectDirectory, destination, {
      onBuild: (_result, outputDirectory) => {
        const publishing = publish(outputDirectory);
        if (firstPublication === undefined) firstPublication = publishing;
        else void publishing.catch((error) => options.onError?.(error));
      },
      onError: options.onError,
    });
    if (firstPublication === undefined) throw new Error("The initial site build was not published.");
    await firstPublication;
  } catch (error) {
    await Promise.allSettled([
      watcher?.close(),
      gateway.invoke("/serve/close", { server: opened.server }),
    ]);
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
      const serving = closed[1];
      if (serving?.status === "fulfilled" && !serving.value.ok) {
        failures.push(new Error(`Could not close the site server: ${reason(serving.value.error)}`));
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1) throw new AggregateError(failures, "Could not close the development server.");
    },
  };
}
