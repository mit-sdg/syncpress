import { readFile, watch } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { CONFIGURATION_PATH } from "@syncpress/compositions/shared";
import { GoverningConcept } from "@syncpress/concepts/governing/governing";
import { buildSite, canonicalPath, containsPath, type BuildResult } from "./site.ts";

export type SiteWatcher = { close(): Promise<void> };

async function canonicalOutputDirectory(directory: string): Promise<string> {
  return canonicalPath(directory, "output directory");
}

function isOutputTransactionPath(output: string, candidate: string): boolean {
  const parent = dirname(output);
  if (!containsPath(parent, candidate)) return false;
  const [first] = relative(parent, candidate).split(sep);
  return first?.startsWith(`.${basename(output)}.emitting-`) ?? false;
}

async function configuredWatchOutputDirectory(siteDirectory: string, destination: string | undefined): Promise<string | undefined> {
  if (destination !== undefined) return resolve(siteDirectory, destination);
  try {
    const source = await readFile(join(siteDirectory, CONFIGURATION_PATH), "utf8");
    const assessed = new GoverningConcept().assess({ source });
    return assessed.valid ? resolve(siteDirectory, assessed.policy.outputPath) : undefined;
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
  const initial = await buildSite(siteDirectory, destination);
  options.onBuild?.(initial);
  let output = await canonicalOutputDirectory(resolve(siteDirectory, destination ?? initial.policy.outputPath));
  let rebuildingOutput: string | undefined;
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
      if (configuredOutput !== undefined) output = await canonicalOutputDirectory(configuredOutput);
      rebuildingOutput = output;
      const result = await buildSite(siteDirectory, destination);
      output = await canonicalOutputDirectory(resolve(siteDirectory, destination ?? result.policy.outputPath));
      options.onBuild?.(result);
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
    },
  };
}
