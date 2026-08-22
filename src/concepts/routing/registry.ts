import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  AddressTaken,
  InvalidAddress,
  InvalidOwner,
  NotClaimed,
  RoutingConcept,
} from "./routing.ts";
import spec from "../../../design/concepts/Routing.md" with { type: "text" };

export const routing = registerConcept({
  class: RoutingConcept,
  spec,
  refusals: {
    INVALID_OWNER: InvalidOwner,
    INVALID_ADDRESS: InvalidAddress,
    ADDRESS_TAKEN: AddressTaken,
    NOT_CLAIMED: NotClaimed,
  },
});
