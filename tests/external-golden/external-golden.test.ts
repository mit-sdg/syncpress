import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
  buildExternalGolden,
  createCandidatePackage,
  externalGoldenSites,
  goldenPath,
} from "./runner.ts";

let candidatePackage: Awaited<ReturnType<typeof createCandidatePackage>>;

beforeAll(async () => {
  candidatePackage = await createCandidatePackage();
});

afterAll(async () => {
  await candidatePackage?.remove();
});

for (const site of externalGoldenSites) {
  test(`${site.name} produces its exact deterministic golden tree`, async () => {
    const expected = JSON.parse(await readFile(goldenPath(site), "utf8")) as { files: Record<string, string> };
    const actual = await buildExternalGolden(site, candidatePackage.path);
    expect(actual.files).toEqual(expected.files);
  }, 60_000);
}
