import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { ReferenceNotFound, ReferencingConcept } from "./referencing.ts";
import spec from "./spec.md" with { type: "text" };

export const referencing = registerConcept({
  class: ReferencingConcept,
  spec,
  refusals: { REFERENCE_NOT_FOUND: ReferenceNotFound },
});
