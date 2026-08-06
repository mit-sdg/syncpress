import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  CommandingConcept,
  InvalidArguments,
  InvalidCommand,
  InvalidExitCode,
  InvalidStream,
  InvalidText,
} from "./commanding.ts";
import spec from "./spec.md" with { type: "text" };

export const commanding = registerConcept({
  class: CommandingConcept,
  spec,
  refusals: {
    INVALID_ARGUMENTS: InvalidArguments,
    INVALID_COMMAND: InvalidCommand,
    INVALID_EXIT_CODE: InvalidExitCode,
    INVALID_STREAM: InvalidStream,
    INVALID_TEXT: InvalidText,
  },
});
