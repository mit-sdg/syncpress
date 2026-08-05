import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { CommandingConcept, InvalidArguments, InvalidReport, InvalidUsage } from "./commanding.ts";
import spec from "./spec.md" with { type: "text" };

export const commanding = registerConcept({
  class: CommandingConcept,
  spec,
  refusals: {
    INVALID_ARGUMENTS: InvalidArguments,
    INVALID_REPORT: InvalidReport,
    INVALID_USAGE: InvalidUsage,
  },
});
