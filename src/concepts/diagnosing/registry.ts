import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DiagnosingConcept, DiagnosticNotFound, InvalidLocation, InvalidText, UnknownSeverity } from "./diagnosing.ts";
import spec from "./spec.md" with { type: "text" };

export const diagnosing = registerConcept({
  class: DiagnosingConcept,
  spec,
  refusals: {
    UNKNOWN_SEVERITY: UnknownSeverity,
    INVALID_TEXT: InvalidText,
    INVALID_LOCATION: InvalidLocation,
    DIAGNOSTIC_NOT_FOUND: DiagnosticNotFound,
  },
});
