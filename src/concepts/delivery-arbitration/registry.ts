import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DeliveryArbitrationConcept, DeliveryNotActive, InvalidTask } from "./delivery-arbitration.ts";
import spec from "../../../design/concepts/DeliveryArbitration.md" with { type: "text" };

export const deliveryArbitration = registerConcept({
  class: DeliveryArbitrationConcept,
  spec,
  refusals: {
    DELIVERY_NOT_ACTIVE: DeliveryNotActive,
    INVALID_TASK: InvalidTask,
  },
});
