import { expect, test } from "bun:test";
import { ComposingConcept, KeyConflicts } from "./composing.ts";

test("its principle: independent dotted entries form one context", () => {
  const composing = new ComposingConcept();
  composing.set({ subject: "page", part: "context", key: "site", value: { title: "Ada's Notes" }, raw: false });
  composing.set({ subject: "page", part: "context", key: "page.data", value: { title: "Compiler Design" }, raw: false });
  composing.set({ subject: "page", part: "context", key: "page.url", value: "/posts/compiler-design/", raw: false });
  composing.set({ subject: "page", part: "context", key: "page.content", value: "<p>Notes</p>", raw: true });
  expect(composing._record({ subject: "page", part: "context" })).toEqual({
    values: {
      site: { title: "Ada's Notes" },
      page: { data: { title: "Compiler Design" }, url: "/posts/compiler-design/", content: "<p>Notes</p>" },
    },
    raw: ["page.content"],
  });
  expect(() => composing.set({ subject: "page", part: "context", key: "page.url.value", value: "bad", raw: false })).toThrow(KeyConflicts);
  expect(composing._record({ subject: "page", part: "card" })).toEqual({ values: {}, raw: [] });
});
