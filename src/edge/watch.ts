import { readFile, watch } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { CONFIGURATION_PATH } from "../compositions/shared.ts";
import { parseSitePolicy } from "../site-policy.ts";
import { buildSite, canonicalPath, containsPath, type BuildResult } from "./site.ts";

type WatchedOutput = { directory: string; target: string };

export type SiteWatcher = { close(): Promise<void> };

async function watchedOutput(directory: string): Promise<WatchedOutput> {
  return { directory, target: await canonicalPath(directory, "output directory") };
}

function isOutputTransactionPath(output: WatchedOutput, candidate: string): boolean {
  const parent = dirname(output.target);
  if (!containsPath(parent, candidate)) return false;
  const [first] = relative(parent, candidate).split(sep);
  return first?.startsWith(`.${basename(output.target)}.emitting-`) ?? false;
}

async function configuredWatchOutputDirectory(siteDirectory: string, destination: string | undefined): Promise<string | undefined> {
  if (destination !== undefined) return resolve(siteDirectory, destination);
  try {
    const source = await readFile(join(siteDirectory, CONFIGURATION_PATH), "utf8");
    const { policy, problems } = parseSitePolicy(source);
    return problems.length === 0 ? resolve(siteDirectory, policy.outputPath) : undefined;
  } catch {
    return undefined;
  }
}

/** Rebuild a project after filesystem changes while retaining the last reconciled output on failures. */
export async function watchSite(
  projectDirectory = ".",
  destination?: string,
  options: { onBuild?: (result: BuildResult) => void; onError?: (error: unknown) => void } = {},
): Promise<SiteWatcher> {
  const siteDirectory = resolve(projectDirectory);
  let current = await buildSite(siteDirectory, destination);
  options.onBuild?.(current);
  let output = await watchedOutput(resolve(siteDirectory, destination ?? current.policy.outputPath));
  let rebuildingOutput: WatchedOutput | undefined;
  const controller = new AbortController();
  let closed = false;
  let rebuilding = false;
  let queued = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rebuild = async (): Promise<void> => {
    if (closed) return;
    if (rebuilding) {
      queued = true;
      return;
    }
    rebuilding = true;
    try {
      const configuredOutput = await configuredWatchOutputDirectory(siteDirectory, destination);
      if (configuredOutput !== undefined) output = await watchedOutput(configuredOutput);
      rebuildingOutput = output;
      current = await buildSite(siteDirectory, destination);
      output = await watchedOutput(resolve(siteDirectory, destination ?? current.policy.outputPath));
      options.onBuild?.(current);
    } catch (error) {
      options.onError?.(error);
    } finally {
      rebuildingOutput = undefined;
      rebuilding = false;
      if (queued) {
        queued = false;
        void rebuild();
      }
    }
  };
  const schedule = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void rebuild();
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
          (containsPath(output.target, filename) ||
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
    },
  };
}
