import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  AddressTaken,
  InvalidAddress,
  InvalidBase,
  InvalidOrigin,
  InvalidOwner,
  NotClaimed,
  RoutingConcept,
} from "./routing.ts";
import spec from "./spec.md" with { type: "text" };

export const routing = registerConcept({
  class: RoutingConcept,
  spec,
  refusals: {
    INVALID_BASE: InvalidBase,
    INVALID_ORIGIN: InvalidOrigin,
    INVALID_OWNER: InvalidOwner,
    INVALID_ADDRESS: InvalidAddress,
    ADDRESS_TAKEN: AddressTaken,
    NOT_CLAIMED: NotClaimed,
  },
});
