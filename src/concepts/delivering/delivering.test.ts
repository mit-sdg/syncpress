import { expect, test } from "bun:test";
import { DeliveringConcept, DeliveryNotActive, InvalidTask } from "./delivering.ts";

test("its principle: task deliveries settle independently after interruption", () => {
  const delivering = new DeliveringConcept();
  expect(delivering.begin({ task: "build:1" })).toEqual({ task: "build:1", changed: true });
  expect(delivering.begin({ task: "build:2" })).toEqual({ task: "build:2", changed: true });
  expect(delivering.interrupt({ task: "build:1" })).toEqual({ task: "build:1", changed: true });
  expect(delivering.interrupt({ task: "build:1" })).toEqual({ task: "build:1", changed: false });
  expect(delivering.settle({ task: "build:1" })).toEqual({ task: "build:1", interrupted: true });
  expect(delivering.settle({ task: "build:2" })).toEqual({ task: "build:2", interrupted: false });
});

test("an interruption that arrives before begin is retained", () => {
  const delivering = new DeliveringConcept();
  expect(delivering.interrupt({ task: "build" })).toEqual({ task: "build", changed: true });
  expect(delivering._delivery({ task: "build" })).toEqual([{ active: false, interrupted: true }]);
  expect(delivering.begin({ task: "build" })).toEqual({ task: "build", changed: true });
  expect(delivering.begin({ task: "build" })).toEqual({ task: "build", changed: false });
  expect(delivering.settle({ task: "build" })).toEqual({ task: "build", interrupted: true });
  expect(delivering._delivery({ task: "build" })).toEqual([]);
});

test("invalid and inactive task transitions refuse without changing another task", () => {
  const delivering = new DeliveringConcept();
  delivering.begin({ task: "kept" });
  expect(() => delivering.begin({ task: "\ud800" })).toThrow(InvalidTask);
  expect(() => delivering.interrupt({ task: 1 })).toThrow(InvalidTask);
  expect(() => delivering.settle({ task: "missing" })).toThrow(DeliveryNotActive);
  expect(delivering._delivery({ task: "kept" })).toEqual([{ active: true, interrupted: false }]);
  expect(delivering._delivery({ task: 1 })).toEqual([]);
});
