import { expect, test } from "bun:test";
import { DocumentingConcept, MalformedAttributes } from "./documenting.ts";

test("its principle: front matter is separate from the authored body", () => {
  const documenting = new DocumentingConcept();
  const parsed = documenting.parse({ subject: "post", text: "---\ntitle: Compiler Design\n---\n# Notes\n" });
  expect(parsed.attributes).toEqual({ title: "Compiler Design" });
  expect(parsed.body).toBe("# Notes\n");
  expect(documenting._document({ subject: "post" })[0]?.bodyLine).toBe(4);
  expect(documenting.parse({ subject: "plain", text: "No heading" }).attributes).toEqual({});
  expect(() => documenting.parse({ subject: "broken", text: "---\ntitle: [\n---" })).toThrow(MalformedAttributes);
  expect(documenting._document({ subject: "broken" })).toEqual([]);
});
