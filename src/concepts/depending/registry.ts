import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { AttemptExhausted, DependingConcept, InvalidText, NotBuilding, StaleAttempt } from "./depending.ts";
import spec from "./spec.md" with { type: "text" };

export const depending = registerConcept({
  class: DependingConcept,
  spec,
  refusals: {
    ATTEMPT_EXHAUSTED: AttemptExhausted,
    INVALID_TEXT: InvalidText,
    NOT_BUILDING: NotBuilding,
    STALE_ATTEMPT: StaleAttempt,
  },
});
