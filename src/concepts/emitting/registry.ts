import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  InvalidClaim,
  AttemptExhausted,
  DestinationNotDirected,
  DestinationUnavailable,
  EmittingConcept,
  InvalidContent,
  InvalidDestination,
  InvalidMedium,
  InvalidPath,
  InvalidProducer,
  NotBegun,
  PathContested,
  PathLeavesDestination,
  ReconciliationFailed,
  StaleAttempt,
} from "./emitting.ts";
import spec from "../../../design/concepts/Emitting.md" with { type: "text" };

export const emitting = registerConcept({
  class: EmittingConcept,
  spec,
  refusals: {
    INVALID_CLAIM: InvalidClaim,
    INVALID_DESTINATION: InvalidDestination,
    DESTINATION_UNAVAILABLE: DestinationUnavailable,
    INVALID_PRODUCER: InvalidProducer,
    ATTEMPT_EXHAUSTED: AttemptExhausted,
    PATH_LEAVES_DESTINATION: PathLeavesDestination,
    INVALID_PATH: InvalidPath,
    INVALID_CONTENT: InvalidContent,
    INVALID_MEDIUM: InvalidMedium,
    PATH_CONTESTED: PathContested,
    NOT_BEGUN: NotBegun,
    STALE_ATTEMPT: StaleAttempt,
    DESTINATION_NOT_DIRECTED: DestinationNotDirected,
    RECONCILIATION_FAILED: ReconciliationFailed,
  },
});
