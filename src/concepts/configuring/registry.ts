import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  ConfiguringConcept,
  ConfigurationNotFound,
  MalformedConfiguration,
  UnsupportedNotation,
} from "./configuring.ts";
import spec from "./spec.md" with { type: "text" };

export const configuring = registerConcept({
  class: ConfiguringConcept,
  spec,
  refusals: {
    CONFIGURATION_NOT_FOUND: ConfigurationNotFound,
    MALFORMED_CONFIGURATION: MalformedConfiguration,
    UNSUPPORTED_NOTATION: UnsupportedNotation,
  },
});
