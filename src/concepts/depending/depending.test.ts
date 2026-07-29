import { expect, test } from "bun:test";
import { DependingConcept, NotBuilding } from "./depending.ts";

test("its principle: inputs stale direct and transitive dependents", () => {
  const depending = new DependingConcept();
  depending.begin({ subject: "page" });
  depending.use({ subject: "page", input: "layout" });
  depending.settle({ subject: "page" });
  depending.begin({ subject: "feed" });
  depending.use({ subject: "feed", input: "page" });
  depending.settle({ subject: "feed" });
  expect(depending.touch({ input: "layout" })).toEqual({ input: "layout", count: 2 });
  expect(depending._reason({ subject: "page" })).toEqual([{ reason: "layout" }]);
  expect(depending._reason({ subject: "feed" })).toEqual([{ reason: "page" }]);
  depending.begin({ subject: "page" });
  expect(depending._uses({ subject: "page" })).toEqual([]);
  expect(() => depending.settle({ subject: "missing" })).toThrow(NotBuilding);
});
