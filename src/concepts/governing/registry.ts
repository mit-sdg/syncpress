import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { GoverningConcept } from "./governing.ts";
import spec from "./spec.md" with { type: "text" };

export const governing = registerConcept({
  class: GoverningConcept,
  spec,
});
