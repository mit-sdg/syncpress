import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DocumentingConcept, DocumentNotFound, MalformedAttributes } from "./documenting.ts";
import spec from "./spec.md" with { type: "text" };

export const documenting = registerConcept({
  class: DocumentingConcept,
  spec,
  refusals: { DOCUMENT_NOT_FOUND: DocumentNotFound, MALFORMED_ATTRIBUTES: MalformedAttributes },
});
