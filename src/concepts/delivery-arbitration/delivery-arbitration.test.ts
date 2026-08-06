import { expect, test } from "bun:test";
import { DeliveryArbitrationConcept, DeliveryNotActive, InvalidTask } from "./delivery-arbitration.ts";

test("its principle: task deliveries settle independently after interruption", () => {
  const delivering = new DeliveryArbitrationConcept();
  expect(delivering.beginDelivery({ task: "build:1" })).toEqual({ task: "build:1", changed: true });
  expect(delivering.beginDelivery({ task: "build:2" })).toEqual({ task: "build:2", changed: true });
  expect(delivering.recordInterruption({ task: "build:1" })).toEqual({ task: "build:1", changed: true });
  expect(delivering.recordInterruption({ task: "build:1" })).toEqual({ task: "build:1", changed: false });
  expect(delivering.settle({ task: "build:1" })).toEqual({ task: "build:1", interrupted: true });
  expect(delivering.settle({ task: "build:2" })).toEqual({ task: "build:2", interrupted: false });
});

test("an interruption that arrives before begin is retained", () => {
  const delivering = new DeliveryArbitrationConcept();
  expect(delivering.recordInterruption({ task: "build" })).toEqual({ task: "build", changed: true });
  expect(delivering._delivery({ task: "build" })).toEqual([{ active: false, interrupted: true }]);
  expect(delivering.beginDelivery({ task: "build" })).toEqual({ task: "build", changed: true });
  expect(delivering.beginDelivery({ task: "build" })).toEqual({ task: "build", changed: false });
  expect(delivering.settle({ task: "build" })).toEqual({ task: "build", interrupted: true });
  expect(delivering._delivery({ task: "build" })).toEqual([]);
});

test("invalid and inactive task transitions refuse without changing another task", () => {
  const delivering = new DeliveryArbitrationConcept();
  delivering.beginDelivery({ task: "kept" });
  expect(() => delivering.beginDelivery({ task: "\ud800" })).toThrow(InvalidTask);
  expect(() => delivering.recordInterruption({ task: 1 })).toThrow(InvalidTask);
  expect(() => delivering.settle({ task: "missing" })).toThrow(DeliveryNotActive);
  expect(delivering._delivery({ task: "kept" })).toEqual([{ active: true, interrupted: false }]);
  expect(delivering._delivery({ task: 1 })).toEqual([]);
});
