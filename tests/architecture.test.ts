import { expect, test } from "bun:test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { assembleSyncpress } from "../src/assembly.ts";
import type { BuildResult as DeclaredBuildResult, InspectionResult as DeclaredInspectionResult } from "../types/index.d.ts";
import type { BuildResult, inspectSite } from "../src/compositions/api.ts";

type InspectionResult = Awaited<ReturnType<typeof inspectSite>>;

const root = join(import.meta.dir, "..");

async function typescriptFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await typescriptFiles(path));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(path);
  }
  return files;
}

test("concept implementations do not import peer concepts", async () => {
  const concepts = join(root, "src", "concepts");
  for (const directory of await readdir(concepts, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const implementation = join(concepts, directory.name, `${directory.name}.ts`);
    const source = await readFile(implementation, "utf8").catch(() => undefined);
    if (source === undefined) continue;
    expect(source, implementation).not.toMatch(/(?:@syncpress\/concepts|from\s+["']\.\.\/(?!\.))/);
  }
});

test("composition depends only on concept references and value contracts", async () => {
  for (const file of await typescriptFiles(join(root, "src", "compositions"))) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toContain("@syncpress/concepts/");
    expect(source, file).not.toContain("application.concepts");
  }
});

test("host adapters never read concept state or import implementations", async () => {
  for (const file of [join(root, "src", "syncpress.ts"), join(root, "src", "cli.ts")]) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toContain("application.concepts.");
    expect(source, file).not.toContain("@syncpress/concepts/");
  }
});

/**
 * Every interaction with the host — its filesystem, network, process, and
 * clock — belongs to the concept that owns it. A host adapter only assembles an
 * application and invokes its endpoints.
 */
test("host adapters reach the host only through concepts", async () => {
  const adapters = [join(root, "src", "syncpress.ts"), join(root, "src", "cli.ts")];
  for (const file of adapters) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toMatch(/from\s+["']node:/);
    expect(source, file).not.toMatch(/\bprocess\.|\bconsole\./);
    expect(source, file).not.toMatch(/\bsetTimeout\b|\bsetInterval\b/);
  }
});

test("composition asks concepts for host work instead of doing it", async () => {
  for (const file of await typescriptFiles(join(root, "src", "compositions"))) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toMatch(/from\s+["']node:(?:fs|http|https|net|process|timers)/);
    expect(source, file).not.toMatch(/\bprocess\.|\bconsole\.|\bsetTimeout\b|\bsetInterval\b/);
  }
});

test("reaction names retain their composition module", () => {
  const names = inspectAssembly(assembleSyncpress()).app.reactions.map(({ name }) => name);
  expect(names).toContain("fullSite.endpoints.AdvanceSiteBuild");
  expect(names).toContain("fullSite.render.SettledLayoutsStagePageOutput");
  expect(names).toContain("fullSite.deployment.ActivatedSitemapWorkSnapshotsUrls");
  expect(names.some((name) => /^fullSite\.[A-Z]/u.test(name))).toBe(false);
});

/** Computations may use pure host path projection, but never perform host effects. */
test("computations perform no host effects", async () => {
  for (const name of ["computations.ts", "deployment-computations.ts"]) {
    const source = await readFile(join(root, "src", "compositions", name), "utf8");
    expect(source).not.toMatch(/from\s+["']node:(?:fs|http|https|net|process|timers)/);
    expect(source).not.toMatch(/\bprocess\.|\bconsole\.|\bsetTimeout\b|\bsetInterval\b/);
  }
});

test("Deploying owns preparation state but no generated document formats", async () => {
  const source = await readFile(join(root, "src", "concepts", "deploying", "deploying.ts"), "utf8");
  expect(source).not.toMatch(/<!doctype|<feed\b|<urlset\b|syncpress-pagination-items|atomTimestamp|xmlEscape|htmlEscape/);
});

/**
 * The published declarations are written by hand, so the compiler is what keeps
 * them honest: every field the package returns must be one it declares.
 */
test("published declarations name exactly the fields the package returns", () => {
  type SameKeys<Declared, Returned> = [keyof Declared, keyof Returned] extends [keyof Returned, keyof Declared] ? true
    : never;

  const build: SameKeys<DeclaredBuildResult, BuildResult> = true;
  const inspect: SameKeys<DeclaredInspectionResult, InspectionResult> = true;
  expect([build, inspect]).toEqual([true, true]);
});
