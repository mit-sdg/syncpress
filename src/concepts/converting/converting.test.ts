import { expect, test } from "bun:test";
import { ConvertingConcept, DialectNotFound } from "./converting.ts";

test("its principle: declared dialects convert independent subject parts", () => {
  const converting = new ConvertingConcept();
  const markdown = converting.declare({ name: "markdown", extensions: ["tables", "strikethrough"], raw: true, separator: "<!--more-->" });
  const body = converting.convert({ subject: "page", part: "body", dialect: markdown.dialect, source: "# Notes\n\nBefore<!--more-->After" });
  expect(body.output).toContain("<h1>Notes</h1>");
  expect(body.excerpt).toContain("Before");
  expect(body.excerpt).not.toContain("After");
  expect(converting.convert({ subject: "page", part: "body", dialect: markdown.dialect, source: "# Notes\n\nBefore<!--more-->After" }).conversion).toBe(body.conversion);
  const verbatim = converting.declare({ name: "verbatim", extensions: [], raw: true, separator: "<!--more-->" });
  expect(converting.convert({ subject: "page", part: "html", dialect: verbatim.dialect, source: "<p>Already HTML</p>" }).output).toBe("<p>Already HTML</p>");
  expect(() => converting.convert({ subject: "page", part: "bad", dialect: "missing", source: "" })).toThrow(DialectNotFound);
});
