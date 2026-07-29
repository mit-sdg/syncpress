import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
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
} from "./emitting.ts";
import spec from "./spec.md" with { type: "text" };

export const emitting = registerConcept({
  class: EmittingConcept,
  spec,
  refusals: {
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
    DESTINATION_NOT_DIRECTED: DestinationNotDirected,
    RECONCILIATION_FAILED: ReconciliationFailed,
  },
});
