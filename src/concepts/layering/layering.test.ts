import { expect, test } from "bun:test";
import { LayeringConcept, NoSuchLayer, RankTaken } from "./layering.ts";

test("its principle: ranks merge records and explain their winning values", () => {
  const layering = new LayeringConcept();
  layering.contribute({ subject: "page", rank: 0, values: { build: { template: "page.html", markup: "markdown" }, topics: ["draft"] } });
  layering.contribute({ subject: "page", rank: 1, values: { build: { template: "post.html" } } });
  layering.contribute({ subject: "page", rank: 1_000_000, values: { title: "Compiler Design", topics: ["compilers"] } });
  expect(layering._resolved({ subject: "page" })).toEqual({
    values: { build: { template: "post.html", markup: "markdown" }, title: "Compiler Design", topics: ["compilers"] },
  });
  expect(layering._origin({ subject: "page", key: "build.template" })).toEqual([{ rank: 1, layer: "layer:page:1" }]);
  expect(layering._holds({ subject: "page", key: "topics", value: "compilers" })).toEqual({ present: true, equal: false, contains: true });
  expect(() => layering.contribute({ subject: "page", rank: 1, values: {} })).toThrow(RankTaken);
  layering.withdraw({ subject: "page", rank: 1 });
  expect(layering._value({ subject: "page", key: "build.template" })).toEqual([{ value: "page.html" }]);
  expect(() => layering.withdraw({ subject: "page", rank: 1 })).toThrow(NoSuchLayer);
});
