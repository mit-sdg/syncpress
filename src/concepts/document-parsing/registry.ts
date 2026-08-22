import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DocumentParsingConcept, DocumentNotFound, MalformedAttributes } from "./document-parsing.ts";
import spec from "../../../design/concepts/DocumentParsing.md" with { type: "text" };

export const documentParsing = registerConcept({
  class: DocumentParsingConcept,
  spec,
  refusals: { DOCUMENT_NOT_FOUND: DocumentNotFound, MALFORMED_ATTRIBUTES: MalformedAttributes },
});
