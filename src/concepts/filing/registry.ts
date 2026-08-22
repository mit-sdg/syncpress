import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  FileNotFound,
  FilingConcept,
  InvalidEncoding,
  InvalidPath,
  InvalidSource,
  PathLeavesRoot,
  RootNotFound,
} from "./filing.ts";
import spec from "../../../design/concepts/Filing.md" with { type: "text" };

export const filing = registerConcept({
  class: FilingConcept,
  spec,
  refusals: {
    FILE_NOT_FOUND: FileNotFound,
    INVALID_ENCODING: InvalidEncoding,
    INVALID_PATH: InvalidPath,
    INVALID_SOURCE: InvalidSource,
    PATH_LEAVES_ROOT: PathLeavesRoot,
    ROOT_NOT_FOUND: RootNotFound,
  },
});
