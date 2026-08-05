import { resolve } from "node:path";
import { createSyncpressRuntime, type Gateway } from "./application.ts";
import { buildSite, type BuildResult } from "./site.ts";

export type SiteWatcher = { close(): Promise<void> };

/** How long a burst of change settles before it counts as one edit. */
const SETTLING_MS = 75;

/** How long one attend waits, and so how long closing a watch can take. */
const ATTEND_MS = 500;

function answer<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, context: string): T {
  if (!result.ok) throw new Error(`${context}: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Rebuild a project after each settled change, keeping the last reconciled output on failures. */
export async function watchSite(
  projectDirectory = ".",
  destination?: string,
  options: { onBuild?: (result: BuildResult, outputDirectory: string) => void; onError?: (error: unknown) => void } = {},
): Promise<SiteWatcher> {
  const directory = resolve(projectDirectory);
  const initial = await buildSite(directory, destination);
  options.onBuild?.(initial, initial.outputDirectory);

  const { gateway }: { gateway: Gateway } = createSyncpressRuntime();
  const { watch } = answer(
    await gateway.invoke("/watch/open", { directory, settling: SETTLING_MS, output: initial.outputDirectory }),
    "Could not watch the site directory",
  );

  let closing = false;
  const attending = (async (): Promise<void> => {
    while (!closing) {
      const { changed, watching } = answer(
        await gateway.invoke("/watch/attend", { watch, within: ATTEND_MS }),
        "Could not watch the site directory",
      );
      if (!watching) return;
      if (!changed) continue;

      try {
        const built = await buildSite(directory, destination);
        options.onBuild?.(built, built.outputDirectory);
      } catch (error) {
        if (!closing) options.onError?.(error);
      }
    }
  })();

  return {
    async close(): Promise<void> {
      if (closing) return;
      closing = true;
      await gateway.invoke("/watch/close", { watch });
      await attending;
    },
  };
}
