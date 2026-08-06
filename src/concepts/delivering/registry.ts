import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DeliveringConcept, DeliveryNotActive, InvalidTask } from "./delivering.ts";
import spec from "./spec.md" with { type: "text" };

export const delivering = registerConcept({
  class: DeliveringConcept,
  spec,
  refusals: {
    DELIVERY_NOT_ACTIVE: DeliveryNotActive,
    INVALID_TASK: InvalidTask,
  },
});
