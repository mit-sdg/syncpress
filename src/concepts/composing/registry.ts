import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { ComposingConcept, KeyConflicts } from "./composing.ts";
import spec from "./spec.md" with { type: "text" };

export const composing = registerConcept({
  class: ComposingConcept,
  spec,
  refusals: { KEY_CONFLICTS: KeyConflicts },
});
