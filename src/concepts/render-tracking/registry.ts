import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidAttempt,
  InvalidText,
  RenderTrackingConcept,
  RenderingNotFound,
  StaleAttempt,
  StageNotReady,
} from "./render-tracking.ts";
import spec from "../../../design/concepts/RenderTracking.md" with { type: "text" };

export const renderTracking = registerConcept({
  class: RenderTrackingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_ATTEMPT: InvalidAttempt,
    STALE_ATTEMPT: StaleAttempt,
    RENDERING_NOT_FOUND: RenderingNotFound,
    STAGE_NOT_READY: StageNotReady,
  },
});
