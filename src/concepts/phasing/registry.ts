import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidPhases,
  InvalidText,
  JobNotRunning,
  NoPhases,
  PhaseRepeated,
  PhasingConcept,
  SequenceNotFound,
  UnknownMode,
} from "./phasing.ts";
import spec from "./spec.md" with { type: "text" };

export const phasing = registerConcept({
  class: PhasingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_PHASES: InvalidPhases,
    NO_PHASES: NoPhases,
    PHASE_REPEATED: PhaseRepeated,
    SEQUENCE_NOT_FOUND: SequenceNotFound,
    UNKNOWN_MODE: UnknownMode,
    JOB_NOT_RUNNING: JobNotRunning,
  },
});
