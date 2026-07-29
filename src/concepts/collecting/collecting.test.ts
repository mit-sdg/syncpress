import { expect, test } from "bun:test";
import { CollectingConcept, NotIncluded } from "./collecting.ts";

test("its principle: collection entries have a total stable order", () => {
  const collecting = new CollectingConcept();
  const posts = collecting.declare({ name: "posts", direction: "desc" });
  collecting.include({ collection: posts.collection, item: "older", key: "2025-01-01", tiebreak: "posts/older.md", card: { title: "Older" } });
  collecting.include({ collection: posts.collection, item: "newer-b", key: "2026-01-01", tiebreak: "posts/b.md", card: { title: "Newer B" } });
  collecting.include({ collection: posts.collection, item: "newer-a", key: "2026-01-01", tiebreak: "posts/a.md", card: { title: "Newer A" } });
  collecting.include({ collection: posts.collection, item: "undated", key: undefined, tiebreak: "posts/undated.md", card: { title: "Undated" } });
  expect(collecting._items({ collection: posts.collection }).map(({ item }) => item)).toEqual(["newer-a", "newer-b", "older", "undated"]);
  expect(collecting.include({ collection: posts.collection, item: "older", key: "2025-01-01", tiebreak: "posts/older.md", card: { title: "Older" } }).changed).toBe(false);
  expect(collecting.include({ collection: posts.collection, item: "older", key: "2025-01-01", tiebreak: "posts/older.md", card: { title: "Revised" } }).changed).toBe(true);
  collecting.exclude({ collection: posts.collection, item: "older" });
  expect(() => collecting.exclude({ collection: posts.collection, item: "older" })).toThrow(NotIncluded);
});
