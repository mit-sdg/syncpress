import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidLocation,
  LocatingConcept,
  NotGrounded,
} from "./locating.ts";
import spec from "@design/concepts/Locating.md" with { type: "text" };

export const locating = registerConcept({
  class: LocatingConcept,
  spec,
  refusals: {
    INVALID_LOCATION: InvalidLocation,
    NOT_GROUNDED: NotGrounded,
  },
});
