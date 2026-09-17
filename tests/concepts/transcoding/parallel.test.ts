import { expect, test } from "bun:test";
import { deriveInParallel } from "@concepts/transcoding/parallel.ts";

test("rendition workers stay bounded, refill free slots, and return request order", async () => {
  const items = [0, 1, 2, 3, 4, 5];
  const gates = items.map(() => Promise.withResolvers<number>());
  const begun = items.map(() => Promise.withResolvers<void>());
  const started: number[] = [];
  let active = 0;
  let peak = 0;
  const result = deriveInParallel(items, 2, async (item) => {
    started.push(item);
    active += 1;
    peak = Math.max(peak, active);
    begun[item]!.resolve();
    try {
      return await gates[item]!.promise;
    } finally {
      active -= 1;
    }
  });
  expect(started).toEqual([0, 1]);

  // Keep the first request blocked while later ones finish and refill its peer.
  for (const item of items.slice(1)) {
    await begun[item]!.promise;
    gates[item]!.resolve(item + 100);
  }
  gates[0]!.resolve(100);
  expect(await result).toEqual([100, 101, 102, 103, 104, 105]);
  expect(started).toEqual(items);
  expect(peak).toBe(2);
  expect(active).toBe(0);
  expect(await deriveInParallel([], 4, async (item) => item)).toEqual([]);
});

test("a failed rendition stops queued work and waits for all started workers before refusing", async () => {
  const gates = [Promise.withResolvers<number>(), Promise.withResolvers<number>()];
  const started: number[] = [];
  const failure = new Error("encoder failed");
  const result = deriveInParallel([0, 1, 2, 3], 2, (item) => {
    started.push(item);
    return gates[item]!.promise;
  });
  let settled = false;
  const observed = result.then(
    () => { settled = true; return undefined; },
    (error: unknown) => { settled = true; return error; },
  );
  expect(started).toEqual([0, 1]);
  gates[0]!.reject(failure);
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(started).toEqual([0, 1]);

  gates[1]!.resolve(1);
  expect(await observed).toBe(failure);
  expect(settled).toBe(true);
  expect(started).toEqual([0, 1]);
});

test("synchronous encoder faults stop scheduling and invalid worker limits are rejected", async () => {
  const started: number[] = [];
  const failure = new Error("synchronous failure");
  await expect(deriveInParallel([0, 1, 2], 4, (item) => {
    started.push(item);
    throw failure;
  })).rejects.toBe(failure);
  expect(started).toEqual([0]);
  for (const concurrency of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expect(deriveInParallel([0], concurrency, async (item) => item)).rejects.toThrow(RangeError);
  }
});
