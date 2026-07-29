import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { AddressTaken, InvalidAddress, InvalidBase, NotClaimed, RoutingConcept } from "./routing.ts";
import spec from "./spec.md" with { type: "text" };

export const routing = registerConcept({
  class: RoutingConcept,
  spec,
  refusals: { ADDRESS_TAKEN: AddressTaken, INVALID_ADDRESS: InvalidAddress, INVALID_BASE: InvalidBase, NOT_CLAIMED: NotClaimed },
});
