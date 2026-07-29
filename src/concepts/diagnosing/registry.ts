import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DiagnosingConcept, DiagnosticNotFound, UnknownSeverity } from "./diagnosing.ts";
import spec from "./spec.md" with { type: "text" };

export const diagnosing = registerConcept({
  class: DiagnosingConcept,
  spec,
  refusals: { DIAGNOSTIC_NOT_FOUND: DiagnosticNotFound, UNKNOWN_SEVERITY: UnknownSeverity },
});
