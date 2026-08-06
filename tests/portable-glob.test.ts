import { expect, test } from "bun:test";
import { compilePortableGlob, isPortableGlob, portableGlobMatches } from "../src/compositions/computations.ts";

test("portable globs match complete slash-separated paths", () => {
  const pages = compilePortableGlob("**/*.{md,html}");
  expect(pages("index.md")).toBe(true);
  expect(pages("posts/entry/index.html")).toBe(true);
  expect(pages("posts/entry/index.MD")).toBe(false);
  expect(compilePortableGlob("*.md")(".draft.md")).toBe(true);
  expect(compilePortableGlob("*.md")("posts/index.md")).toBe(false);
  expect(compilePortableGlob("docs/*.md")("docs\\guide.md")).toBe(false);
});

test("portable globs support classes, braces, extglobs, quoting, and escapes", () => {
  expect(compilePortableGlob("files/[a-c].md")("files/b.md")).toBe(true);
  expect(compilePortableGlob("files/[!a].md")("files/a.md")).toBe(false);
  expect(compilePortableGlob("files/@(guide|reference).{md,html}")("files/reference.html")).toBe(true);
  expect(compilePortableGlob(String.raw`files/name\*.md`)("files/name*.md")).toBe(true);
  expect(compilePortableGlob('files/"*.md"')("files/*.md")).toBe(true);
  expect(compilePortableGlob("!drafts/**")("!drafts/entry.md")).toBe(true);
  expect(compilePortableGlob("!(draft).md")("entry.md")).toBe(true);
});

test("portable glob validation rejects malformed syntax", () => {
  for (const pattern of ["", "posts/**{", "[z-a]", "[abc", "abc]", "@(md|html", "broken)", '"unterminated']) {
    expect(isPortableGlob(pattern)).toBe(false);
    expect(portableGlobMatches(pattern, "index.md")).toBeUndefined();
  }
  expect(isPortableGlob("posts/**/*.md")).toBe(true);
  expect(portableGlobMatches("posts/**/*.md", "posts/design/index.md")).toBe(true);
});
