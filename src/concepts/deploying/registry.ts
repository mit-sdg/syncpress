import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DeployingConcept, WorkNotCurrent } from "./deploying.ts";
import spec from "./spec.md" with { type: "text" };

export const deploying = registerConcept({
  class: DeployingConcept,
  spec,
  refusals: { WORK_NOT_CURRENT: WorkNotCurrent },
});
