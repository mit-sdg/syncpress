import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { FileNotFound, FilingConcept, InvalidEncoding, InvalidPath, PathLeavesRoot, RootNotFound } from "./filing.ts";
import spec from "./spec.md" with { type: "text" };

export const filing = registerConcept({
  class: FilingConcept,
  spec,
  refusals: {
    FILE_NOT_FOUND: FileNotFound,
    INVALID_ENCODING: InvalidEncoding,
    INVALID_PATH: InvalidPath,
    PATH_LEAVES_ROOT: PathLeavesRoot,
    ROOT_NOT_FOUND: RootNotFound,
  },
});
