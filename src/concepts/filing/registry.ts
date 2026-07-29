import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { FileNotFound, FilingConcept, PathLeavesRoot } from "./filing.ts";
import spec from "./spec.md" with { type: "text" };

export const filing = registerConcept({
  class: FilingConcept,
  spec,
  refusals: { FILE_NOT_FOUND: FileNotFound, PATH_LEAVES_ROOT: PathLeavesRoot },
});
