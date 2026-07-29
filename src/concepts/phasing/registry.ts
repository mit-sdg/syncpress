import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { JobNotRunning, NoPhases, PhasingConcept, SequenceNotFound } from "./phasing.ts";
import spec from "./spec.md" with { type: "text" };

export const phasing = registerConcept({
  class: PhasingConcept,
  spec,
  refusals: { JOB_NOT_RUNNING: JobNotRunning, NO_PHASES: NoPhases, SEQUENCE_NOT_FOUND: SequenceNotFound },
});
