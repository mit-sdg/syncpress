import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DependingConcept, InvalidText, NotBuilding } from "./depending.ts";
import spec from "./spec.md" with { type: "text" };

export const depending = registerConcept({
  class: DependingConcept,
  spec,
  refusals: { INVALID_TEXT: InvalidText, NOT_BUILDING: NotBuilding },
});
