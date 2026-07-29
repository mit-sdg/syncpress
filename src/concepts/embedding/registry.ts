import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { EmbeddingConcept, EmbeddingNotFound } from "./embedding.ts";
import spec from "./spec.md" with { type: "text" };

export const embedding = registerConcept({
  class: EmbeddingConcept,
  spec,
  refusals: { EMBEDDING_NOT_FOUND: EmbeddingNotFound },
});
