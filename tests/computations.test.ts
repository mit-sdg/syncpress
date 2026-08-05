import { expect, test } from "bun:test";
import { computations } from "../src/concept-set.ts";
import { syncpressComputations } from "../src/computations.ts";

test("the concept set registers every named pure computation", () => {
  expect(Object.keys(computations)).toEqual(Object.keys(syncpressComputations));
  for (const [name, fn] of Object.entries(syncpressComputations)) {
    expect(computations[name as keyof typeof computations]).toMatchObject({ computationName: name, fn });
  }
});
