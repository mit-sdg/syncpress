import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidLocation,
  LocatingConcept,
  LocationMissing,
  LocationNotDirectory,
  LocationUnresolvable,
  NotGrounded,
} from "./locating.ts";
import spec from "./spec.md" with { type: "text" };

export const locating = registerConcept({
  class: LocatingConcept,
  spec,
  refusals: {
    INVALID_LOCATION: InvalidLocation,
    LOCATION_MISSING: LocationMissing,
    LOCATION_NOT_DIRECTORY: LocationNotDirectory,
    LOCATION_UNRESOLVABLE: LocationUnresolvable,
    NOT_GROUNDED: NotGrounded,
  },
});
