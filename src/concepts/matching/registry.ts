import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { MalformedPattern, MatchingConcept } from "./matching.ts";
import spec from "./spec.md" with { type: "text" };

export const matching = registerConcept({
  class: MatchingConcept,
  spec,
  refusals: { MALFORMED_PATTERN: MalformedPattern },
});
