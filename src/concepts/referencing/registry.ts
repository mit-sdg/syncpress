import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidForm,
  InvalidText,
  OverlappingMarkup,
  ReferenceNotFound,
  ReferencingConcept,
  UnrepresentableAddress,
} from "./referencing.ts";
import spec from "./spec.md" with { type: "text" };

export const referencing = registerConcept({
  class: ReferencingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_FORM: InvalidForm,
    REFERENCE_NOT_FOUND: ReferenceNotFound,
    UNREPRESENTABLE_ADDRESS: UnrepresentableAddress,
    OVERLAPPING_MARKUP: OverlappingMarkup,
  },
});
