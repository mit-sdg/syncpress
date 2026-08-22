import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  CommandingConcept,
  ExitSelected,
  InvalidArguments,
  InvalidExitCode,
  InvalidStream,
  InvalidText,
  InvocationCaptured,
} from "./commanding.ts";
import spec from "../../../design/concepts/Commanding.md" with { type: "text" };

export const commanding = registerConcept({
  class: CommandingConcept,
  spec,
  refusals: {
    INVALID_ARGUMENTS: InvalidArguments,
    INVALID_EXIT_CODE: InvalidExitCode,
    INVALID_STREAM: InvalidStream,
    INVALID_TEXT: InvalidText,
    INVOCATION_CAPTURED: InvocationCaptured,
    EXIT_SELECTED: ExitSelected,
  },
});
