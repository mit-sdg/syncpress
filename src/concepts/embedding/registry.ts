import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  EmbeddingComplete,
  EmbeddingConcept,
  EmbeddingNotFound,
  InvalidAddress,
  InvalidAttributes,
  InvalidCount,
  InvalidDimension,
  InvalidFormat,
  InvalidOrder,
  InvalidText,
  InvalidWidth,
  OfferConflict,
} from "./embedding.ts";
import spec from "@design/concepts/Embedding.md" with { type: "text" };

export const embedding = registerConcept({
  class: EmbeddingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_DIMENSION: InvalidDimension,
    INVALID_COUNT: InvalidCount,
    INVALID_ADDRESS: InvalidAddress,
    INVALID_FORMAT: InvalidFormat,
    INVALID_ATTRIBUTES: InvalidAttributes,
    EMBEDDING_NOT_FOUND: EmbeddingNotFound,
    INVALID_WIDTH: InvalidWidth,
    INVALID_ORDER: InvalidOrder,
    EMBEDDING_COMPLETE: EmbeddingComplete,
    OFFER_CONFLICT: OfferConflict,
  },
});
