import { watch } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { buildSite, containsPath, type BuildResult } from "./site.ts";

export type SiteWatcher = { close(): Promise<void> };

function isOutputTransactionPath(output: string, candidate: string): boolean {
  const parent = dirname(output);
  if (!containsPath(parent, candidate)) return false;
  const [first] = relative(parent, candidate).split(sep);
  return first?.startsWith(`.${basename(output)}.emitting-`) ?? false;
}

/** Rebuild a project after filesystem changes while retaining the last reconciled output on failures. */
export async function watchSite(
  projectDirectory = ".",
  destination?: string,
  options: { onBuild?: (result: BuildResult, outputDirectory: string) => void; onError?: (error: unknown) => void } = {},
): Promise<SiteWatcher> {
  const siteDirectory = resolve(projectDirectory);
  const initial = await buildSite(siteDirectory, destination);
  let output = initial.outputDirectory;
  options.onBuild?.(initial, output);
  let rebuildingOutput: string | undefined;
  const controller = new AbortController();
  let closed = false;
  let activeBuild: Promise<void> | undefined;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rebuild = async (): Promise<void> => {
    if (closed) return;
    try {
      rebuildingOutput = output;
      const built = await buildSite(siteDirectory, destination);
      output = built.outputDirectory;
      options.onBuild?.(built, output);
    } catch (error) {
      options.onError?.(error);
    } finally {
      rebuildingOutput = undefined;
    }
  };
  const startRebuild = (): void => {
    if (closed) return;
    if (activeBuild !== undefined) {
      queued = true;
      return;
    }
    const running = rebuild();
    activeBuild = running;
    void running.finally(() => {
      if (activeBuild === running) activeBuild = undefined;
      if (!closed && queued) {
        queued = false;
        startRebuild();
      }
    });
  };
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      startRebuild();
    }, 75);
  };
  const watcher = watch(siteDirectory, { recursive: true, signal: controller.signal });
  const task = (async (): Promise<void> => {
    try {
      for await (const event of watcher) {
        if (closed) break;
        const filename = event.filename === null ? undefined : resolve(siteDirectory, event.filename.toString());
        if (
          filename !== undefined &&
          (containsPath(output, filename) ||
            (rebuildingOutput !== undefined && isOutputTransactionPath(rebuildingOutput, filename)))
        ) {
          continue;
        }
        schedule();
      }
    } catch (error) {
      if (!closed && (error as { name?: string }).name !== "AbortError") options.onError?.(error);
    }
  })();

  return {
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
      await task;
      await activeBuild;
    },
  };
}
