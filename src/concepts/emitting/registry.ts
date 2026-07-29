import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { EmittingConcept, NotBegun, PathContested, PathLeavesDestination } from "./emitting.ts";
import spec from "./spec.md" with { type: "text" };

export const emitting = registerConcept({
  class: EmittingConcept,
  spec,
  refusals: {
    NOT_BEGUN: NotBegun,
    PATH_CONTESTED: PathContested,
    PATH_LEAVES_DESTINATION: PathLeavesDestination,
  },
});
