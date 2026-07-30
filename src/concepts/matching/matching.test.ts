import { describe, expect, test } from "bun:test";
import { MalformedPattern, MatchingConcept } from "./matching.ts";

function matched(matching: MatchingConcept, pattern: string, path: string): boolean {
  return matching._matches({ pattern, path }).matched;
}

describe("Matching", () => {
  test("its principle: an admitted selector selects only paths that fit it", () => {
    const matching = new MatchingConcept();

    expect(matching._compiled({ text: "posts/**/*.md" })).toEqual([]);
    expect(matching.compile({ text: "posts/**/*.md" })).toEqual({ pattern: "posts/**/*.md" });
    expect(matching._compiled({ text: "posts/**/*.md" })).toEqual([{ pattern: "posts/**/*.md" }]);
    expect(matched(matching, "posts/**/*.md", "posts/compiler-design/index.md")).toBe(true);
    expect(matched(matching, "posts/**/*.md", "about/index.md")).toBe(false);
    expect(matched(matching, "posts/**/*.md", "posts/notes.txt")).toBe(false);
    expect(matched(matching, "missing", "posts/index.md")).toBe(false);
  });

  test("compilation is idempotent and exact text is the pattern identity", () => {
    const matching = new MatchingConcept();

    expect(matching.compile({ text: "posts/**" })).toEqual({ pattern: "posts/**" });
    expect(matching.compile({ text: "posts/**" })).toEqual({ pattern: "posts/**" });
    expect(matching._compiled({ text: "posts/**" })).toEqual([{ pattern: "posts/**" }]);
    expect(matching._compiled({ text: "./posts/**" })).toEqual([]);
    expect(matched(matching, "./posts/**", "posts/entry.md")).toBe(false);

    expect(matching.compile({ text: "./posts/**" })).toEqual({ pattern: "./posts/**" });
    expect(matching._compiled({ text: "./posts/**" })).toEqual([{ pattern: "./posts/**" }]);
    expect(matched(matching, "posts/**", "posts/entry.md")).toBe(true);
    expect(matched(matching, "./posts/**", "posts/entry.md")).toBe(true);
  });

  test("malformed patterns are refused without changing state", () => {
    const matching = new MatchingConcept();
    matching.compile({ text: "**/*.md" });

    for (const text of [
      "",
      "posts/**{",
      "[z-a]",
      "[abc",
      "abc]",
      "@(md|html",
      "broken)",
      '"unterminated',
    ]) {
      expect(() => matching.compile({ text })).toThrow(MalformedPattern);
      expect(matching._compiled({ text })).toEqual([]);
      expect(matched(matching, text, "posts/index.md")).toBe(false);
    }

    expect(matching._compiled({ text: "**/*.md" })).toEqual([{ pattern: "**/*.md" }]);
    expect(matched(matching, "**/*.md", "posts/index.md")).toBe(true);
  });

  test("the built-in publishing pattern forms match root and nested paths", () => {
    const matching = new MatchingConcept();
    const pages = "**/*.{md,html}";
    const includes = "includes/**";
    const raster = "**/*.{png,jpg,jpeg,gif,webp,avif}";
    matching.compile({ text: pages });
    matching.compile({ text: includes });
    matching.compile({ text: raster });

    expect(matched(matching, pages, "index.md")).toBe(true);
    expect(matched(matching, pages, "posts/entry/index.html")).toBe(true);
    expect(matched(matching, pages, "posts/entry/index.MD")).toBe(false);
    expect(matched(matching, includes, "includes/header.html")).toBe(true);
    expect(matched(matching, includes, "includes-other/header.html")).toBe(false);
    expect(matched(matching, raster, "hero.png")).toBe(true);
    expect(matched(matching, raster, "posts/entry/hero.avif")).toBe(true);
    expect(matched(matching, raster, "posts/entry/hero.svg")).toBe(false);
  });

  test("wildcards are anchored, slash-aware, case-sensitive, and include dotfiles", () => {
    const matching = new MatchingConcept();
    matching.compile({ text: "*.md" });
    matching.compile({ text: "posts/**/index.??" });
    matching.compile({ text: "docs/*.md" });

    expect(matched(matching, "*.md", "index.md")).toBe(true);
    expect(matched(matching, "*.md", ".draft.md")).toBe(true);
    expect(matched(matching, "*.md", "posts/index.md")).toBe(false);
    expect(matched(matching, "*.md", "INDEX.MD")).toBe(false);
    expect(matched(matching, "*.md", "index.md/")).toBe(false);
    expect(matched(matching, "posts/**/index.??", "posts/index.md")).toBe(true);
    expect(matched(matching, "posts/**/index.??", "posts/design/index.md")).toBe(true);
    expect(matched(matching, "posts/**/index.??", "posts/design/index.html")).toBe(false);
    expect(matched(matching, "docs/*.md", "docs/guide.md")).toBe(true);
    expect(matched(matching, "docs/*.md", "docs/guides/start.md")).toBe(false);
    expect(matched(matching, "docs/*.md", "docs\\guide.md")).toBe(false);
  });

  test("classes, braces, extglobs, and escaping have portable meanings", () => {
    const matching = new MatchingConcept();
    const characterClass = "files/[{(].md";
    const range = "files/[a-c].md";
    const negatedClass = "files/[!a].md";
    const posixClass = "files/[[:digit:]].md";
    const alternatives = "files/@(guide|reference).{md,html}";
    const optional = "files/?(draft).md";
    const repeated = "files/*(draft).md";
    const required = "files/+(draft).md";
    const escaped = String.raw`files/name\*.md`;
    const escapedBrackets = String.raw`files/\[draft\].md`;
    const quoted = 'files/"*.md"';
    for (const text of [
      characterClass,
      range,
      negatedClass,
      posixClass,
      alternatives,
      optional,
      repeated,
      required,
      escaped,
      escapedBrackets,
      quoted,
    ]) {
      matching.compile({ text });
    }

    expect(matched(matching, characterClass, "files/{.md")).toBe(true);
    expect(matched(matching, characterClass, "files/(.md")).toBe(true);
    expect(matched(matching, range, "files/b.md")).toBe(true);
    expect(matched(matching, range, "files/d.md")).toBe(false);
    expect(matched(matching, negatedClass, "files/b.md")).toBe(true);
    expect(matched(matching, negatedClass, "files/a.md")).toBe(false);
    expect(matched(matching, posixClass, "files/7.md")).toBe(true);
    expect(matched(matching, posixClass, "files/a.md")).toBe(false);
    expect(matched(matching, alternatives, "files/guide.md")).toBe(true);
    expect(matched(matching, alternatives, "files/reference.html")).toBe(true);
    expect(matched(matching, alternatives, "files/other.md")).toBe(false);
    expect(matched(matching, optional, "files/.md")).toBe(true);
    expect(matched(matching, optional, "files/draft.md")).toBe(true);
    expect(matched(matching, optional, "files/draftdraft.md")).toBe(false);
    expect(matched(matching, repeated, "files/.md")).toBe(true);
    expect(matched(matching, repeated, "files/draftdraft.md")).toBe(true);
    expect(matched(matching, required, "files/.md")).toBe(false);
    expect(matched(matching, required, "files/draftdraft.md")).toBe(true);
    expect(matched(matching, escaped, "files/name*.md")).toBe(true);
    expect(matched(matching, escaped, "files/name1.md")).toBe(false);
    expect(matched(matching, escapedBrackets, "files/[draft].md")).toBe(true);
    expect(matched(matching, escapedBrackets, "files/d.md")).toBe(false);
    expect(matched(matching, quoted, "files/*.md")).toBe(true);
    expect(matched(matching, quoted, "files/guide.md")).toBe(false);
  });

  test("leading exclamation is literal while a negative extglob remains available", () => {
    const matching = new MatchingConcept();
    matching.compile({ text: "!drafts/**" });
    matching.compile({ text: "!(draft).md" });

    expect(matched(matching, "!drafts/**", "!drafts/entry.md")).toBe(true);
    expect(matched(matching, "!drafts/**", "drafts/entry.md")).toBe(false);
    expect(matched(matching, "!(draft).md", "entry.md")).toBe(true);
    expect(matched(matching, "!(draft).md", "draft.md")).toBe(false);
  });

  test("the same inputs produce the same answers in separate instances", () => {
    const first = new MatchingConcept();
    const second = new MatchingConcept();
    const pattern = "**/*.{md,html}";
    const paths = ["index.md", ".hidden/index.html", "posts/index.MD", "docs\\index.md"];
    first.compile({ text: pattern });
    second.compile({ text: pattern });

    expect(paths.map((path) => matched(first, pattern, path))).toEqual(
      paths.map((path) => matched(second, pattern, path)),
    );
    expect(paths.map((path) => matched(first, pattern, path))).toEqual([true, true, false, true]);
  });
});
