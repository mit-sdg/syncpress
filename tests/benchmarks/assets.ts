// Opt-in real-site benchmark. Run after `bun run build`:
// bun tests/benchmarks/assets.ts /path/to/site
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const project = process.argv[2];
if (project === undefined) throw new Error("Usage: bun tests/benchmarks/assets.ts /path/to/site");
const cli = resolve(import.meta.dir, "../../dist/cli.js");
await access(cli);
const temporary = await mkdtemp(join(tmpdir(), "syncpress-asset-benchmark-"));
const output = join(temporary, "output");

async function digests(directory: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const path of (await readdir(directory, { recursive: true, withFileTypes: true }))) {
    if (!path.isFile()) continue;
    const file = join(path.parentPath, path.name);
    files[file.slice(directory.length + 1)] = createHash("sha256").update(await readFile(file)).digest("hex");
  }
  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}

try {
  let expected: Record<string, string> | undefined;
  // Each build is a fresh Node process. The first also has an empty disk cache.
  for (const label of ["cold cache", "warm cache", "warm cache, fresh output"]) {
    if (label.endsWith("fresh output")) await rm(output, { recursive: true, force: true });
    const started = performance.now();
    const built = spawnSync("node", [cli, "build", resolve(project), output], {
      encoding: "utf8",
      env: { ...process.env, XDG_CACHE_HOME: join(temporary, "cache"), LOCALAPPDATA: join(temporary, "cache") },
    });
    const seconds = (performance.now() - started) / 1000;
    if (built.error !== undefined) throw built.error;
    process.stdout.write(built.stdout);
    process.stderr.write(built.stderr);
    if (built.status !== 0) throw new Error(`Build failed: ${built.status ?? built.signal}`);
    const actual = await digests(output);
    if (expected !== undefined && JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Build output changed between runs");
    expected = actual;
    console.log(`${label}: ${seconds.toFixed(3)}s; ${Object.keys(actual).length} files; identical output`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
