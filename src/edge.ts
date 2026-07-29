import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { InvocationResult } from "@mit-sdg/sync-engine/boundary";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SyncpressWire } from "../generated/wire.ts";
import { assembleSyncpress } from "./assembly.ts";

export function buildSyncpress() {
  const application = assembleSyncpress();
  const gateway = createGateway<SyncpressWire>({ application });
  return { application, gateway };
}

const HELP = `Usage:
  bun run site build <content-directory> <output-directory>

Build every Markdown file below <content-directory> with the initial Syncpress
composition. Markdown front matter supplies page.data, and routes derive from
the source path: index.md becomes index.html and about.md becomes about/index.html.
`;

function gatewayValue<T>(result: InvocationResult<T, unknown>): T {
  if (!result.ok) {
    throw new Error(
      String(result.error.kind === "domain" ? result.error.value : result.error.code),
    );
  }
  return result.value;
}

async function markdownPaths(directory: string, prefix = ""): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  const paths: string[] = [];
  for (const entry of entries) {
    const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      paths.push(...(await markdownPaths(join(directory, entry.name), path)));
    } else if (entry.isFile() && path.endsWith(".md")) {
      paths.push(path);
    }
  }
  return paths;
}

export async function buildSite(contentDirectory: string, destination: string) {
  const source = resolve(contentDirectory);
  if (!(await stat(source)).isDirectory()) {
    throw new Error(`Content directory is not a directory: ${contentDirectory}`);
  }

  const files = await markdownPaths(source);
  const { application, gateway } = buildSyncpress();
  gatewayValue(await gateway.invoke("/site/configure", { destination }));

  const opened = await application.concepts.Filing.open({ name: "content" });
  if ("error" in opened) throw new Error(`Could not open the content root: ${opened.error}`);

  for (const path of files) {
    const content = new Uint8Array(await readFile(join(source, ...path.split("/"))));
    const placed = await application.concepts.Filing.place({ root: opened.root, path, content });
    if ("error" in placed) throw new Error(`Could not place ${path}: ${placed.error}`);
  }

  await application.whenIdle();
  const reconciled = gatewayValue(await gateway.invoke("/site/reconcile", {}));
  return { pages: files.length, ...reconciled };
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  if (args.length === 0 || (args.length === 1 && ["--help", "-h", "help"].includes(args[0]!))) {
    console.log(HELP);
    return;
  }

  if (args[0] !== "build" || args.length !== 3) {
    throw new Error(`Unknown command.\n\n${HELP}`);
  }

  const result = await buildSite(args[1]!, args[2]!);
  console.log(
    `Built ${result.pages} ${result.pages === 1 ? "page" : "pages"} (${result.written} written, ${result.replaced} replaced, ${result.kept} kept, ${result.removed} removed).`,
  );
}

if (import.meta.main) {
  try {
    await runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
