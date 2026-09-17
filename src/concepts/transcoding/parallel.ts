/** Run bounded work, preserve request order, and drain started work on failure. */
export async function deriveInParallel<Item, Result>(
  items: readonly Item[],
  concurrency: number,
  derive: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new RangeError("Concurrency must be a positive integer.");
  const results = new Array<Result>(items.length);
  let next = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await derive(items[index]!);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  });
  // Do not release the concept's action queue while a started encoder is still
  // running. Rejection stops new work, but is reported only after all workers exit.
  const settled = await Promise.allSettled(workers);
  for (const worker of settled) if (worker.status === "rejected") throw worker.reason;
  return results;
}
