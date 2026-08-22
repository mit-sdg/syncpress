import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { GoverningConcept, InvalidConfiguration } from "./governing.ts";
import spec from "@design/concepts/Governing.md" with { type: "text" };

export const governing = registerConcept({
  class: GoverningConcept,
  spec,
  refusals: { INVALID_CONFIGURATION: InvalidConfiguration },
});
