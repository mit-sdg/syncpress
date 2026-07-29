import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { ComposingConcept, InvalidPath, InvalidValue, KeyConflicts } from "./composing.ts";
import spec from "./spec.md" with { type: "text" };

export const composing = registerConcept({
  class: ComposingConcept,
  spec,
  refusals: {
    INVALID_PATH: InvalidPath,
    INVALID_VALUE: InvalidValue,
    KEY_CONFLICTS: KeyConflicts,
  },
});
