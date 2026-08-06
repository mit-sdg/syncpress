import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidAttempt,
  InvalidText,
  RenderingConcept,
  RenderingNotFound,
  StaleAttempt,
  StageNotReady,
} from "./rendering.ts";
import spec from "./spec.md" with { type: "text" };

export const rendering = registerConcept({
  class: RenderingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_ATTEMPT: InvalidAttempt,
    STALE_ATTEMPT: StaleAttempt,
    RENDERING_NOT_FOUND: RenderingNotFound,
    STAGE_NOT_READY: StageNotReady,
  },
});
