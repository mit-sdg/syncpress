import { expect, test } from "bun:test";
import { MalformedPattern, MatchingConcept } from "./matching.ts";

test("its principle: compiled patterns select only their matching paths", () => {
  const matching = new MatchingConcept();
  expect(matching.compile({ text: "posts/**/*.md" })).toEqual({ pattern: "posts/**/*.md" });
  expect(matching._matches({ pattern: "posts/**/*.md", path: "posts/compiler-design/index.md" })).toEqual({ matched: true });
  expect(matching._matches({ pattern: "posts/**/*.md", path: "about/index.md" })).toEqual({ matched: false });
  expect(matching._matches({ pattern: "posts/**/*.md", path: "posts/notes.txt" })).toEqual({ matched: false });
  expect(matching._matches({ pattern: "missing", path: "posts/index.md" })).toEqual({ matched: false });
  expect(() => matching.compile({ text: "posts/**{" })).toThrow(MalformedPattern);
});
