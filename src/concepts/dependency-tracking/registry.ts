import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { AttemptExhausted, DependencyTrackingConcept, InvalidText, NotBuilding, StaleAttempt } from "./dependency-tracking.ts";
import spec from "../../../design/concepts/DependencyTracking.md" with { type: "text" };

export const dependencyTracking = registerConcept({
  class: DependencyTrackingConcept,
  spec,
  refusals: {
    ATTEMPT_EXHAUSTED: AttemptExhausted,
    INVALID_TEXT: InvalidText,
    NOT_BUILDING: NotBuilding,
    STALE_ATTEMPT: StaleAttempt,
  },
});
