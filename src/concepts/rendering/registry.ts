import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidProfile,
  InvalidData,
  InvalidTemplate,
  InvalidText,
  RenderingConcept,
  RenderingNotFound,
  StageNotReady,
  UnknownSource,
} from "./rendering.ts";
import spec from "./spec.md" with { type: "text" };

export const rendering = registerConcept({
  class: RenderingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_DATA: InvalidData,
    INVALID_PROFILE: InvalidProfile,
    INVALID_TEMPLATE: InvalidTemplate,
    UNKNOWN_SOURCE: UnknownSource,
    RENDERING_NOT_FOUND: RenderingNotFound,
    STAGE_NOT_READY: StageNotReady,
  },
});
