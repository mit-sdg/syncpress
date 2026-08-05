import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

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

test("composition depends only on vocabulary references and value contracts", async () => {
  for (const file of await typescriptFiles(join(root, "src", "compositions"))) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toContain("@syncpress/concepts/");
    expect(source, file).not.toContain("application.concepts");
  }
});

test("host adapters never read concept state or import implementations", async () => {
  for (const file of await typescriptFiles(join(root, "src", "edge"))) {
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
  for (const file of await typescriptFiles(join(root, "src", "edge"))) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toMatch(/from\s+["']node:/);
    expect(source, file).not.toMatch(/\bprocess\.(?!argv\b)/);
    expect(source, file).not.toMatch(/\bsetTimeout\b|\bsetInterval\b/);
  }
});

test("composition asks concepts for host work instead of doing it", async () => {
  for (const file of await typescriptFiles(join(root, "src", "compositions"))) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toMatch(/from\s+["']node:/);
  }
});

/** Pure calculations stay pure, so composition can reach them through `compute`. */
test("computations import nothing from the host", async () => {
  const source = await readFile(join(root, "src", "computations.ts"), "utf8");
  expect(source).not.toMatch(/from\s+["']node:/);
});
