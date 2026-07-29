import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { OriginalNotFound, TranscodingConcept, UnreadableImage } from "./transcoding.ts";
import spec from "./spec.md" with { type: "text" };

export const transcoding = registerConcept({
  class: TranscodingConcept,
  spec,
  refusals: { ORIGINAL_NOT_FOUND: OriginalNotFound, UNREADABLE_IMAGE: UnreadableImage },
});
