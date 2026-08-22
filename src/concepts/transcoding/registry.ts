import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidSubject,
  InvalidWidths,
  OriginalNotFound,
  RenditionFailed,
  TranscodingConcept,
  UnreadableImage,
  UnsupportedFormat,
  UnsupportedSourceFormat,
} from "./transcoding.ts";
import spec from "@design/concepts/Transcoding.md" with { type: "text" };

export const transcoding = registerConcept({
  class: TranscodingConcept,
  spec,
  refusals: {
    INVALID_SUBJECT: InvalidSubject,
    UNREADABLE_IMAGE: UnreadableImage,
    UNSUPPORTED_SOURCE_FORMAT: UnsupportedSourceFormat,
    ORIGINAL_NOT_FOUND: OriginalNotFound,
    INVALID_WIDTHS: InvalidWidths,
    UNSUPPORTED_FORMAT: UnsupportedFormat,
    RENDITION_FAILED: RenditionFailed,
  },
});
