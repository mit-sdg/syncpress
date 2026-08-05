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
    if (!published.ok) options.onError?.(new Error(`Could not serve the site: ${reason(published.error)}`));
  };

  let watcher: SiteWatcher;
  try {
    watcher = await watchSite(projectDirectory, destination, {
      onBuild: (_result, outputDirectory) => void publish(outputDirectory),
      onError: options.onError,
    });
  } catch (error) {
    await gateway.invoke("/serve/close", { server: opened.server });
    throw error;
  }

  return {
    host: opened.host,
    port: opened.port,
    async close(): Promise<void> {
      await watcher.close();
      await gateway.invoke("/serve/close", { server: opened.server });
    },
  };
}
