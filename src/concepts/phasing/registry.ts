import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidPhases,
  InvalidText,
  JobNotRunning,
  NoPhases,
  PhaseRepeated,
  PhasingConcept,
  SequenceActive,
  SequenceNotFound,
  StaleAttempt,
} from "./phasing.ts";
import spec from "../../../design/concepts/Phasing.md" with { type: "text" };

export const phasing = registerConcept({
  class: PhasingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_PHASES: InvalidPhases,
    NO_PHASES: NoPhases,
    PHASE_REPEATED: PhaseRepeated,
    SEQUENCE_NOT_FOUND: SequenceNotFound,
    SEQUENCE_ACTIVE: SequenceActive,
    JOB_NOT_RUNNING: JobNotRunning,
    STALE_ATTEMPT: StaleAttempt,
  },
});
