import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { ConversionFailed, ConvertingConcept, DialectNotFound } from "./converting.ts";
import spec from "./spec.md" with { type: "text" };

export const converting = registerConcept({
  class: ConvertingConcept,
  spec,
  refusals: { CONVERSION_FAILED: ConversionFailed, DIALECT_NOT_FOUND: DialectNotFound },
});
