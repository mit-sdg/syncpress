import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  DirectoryMissing,
  DirectoryUnreadable,
  DirectoryUnsupported,
  EntryNotFound,
  EntryUnnameable,
  EntryUnreadable,
  EntryUnsupported,
  FileMissing,
  InvalidSurvey,
  ScanningConcept,
} from "./scanning.ts";
import spec from "./spec.md" with { type: "text" };

export const scanning = registerConcept({
  class: ScanningConcept,
  spec,
  refusals: {
    DIRECTORY_MISSING: DirectoryMissing,
    DIRECTORY_UNREADABLE: DirectoryUnreadable,
    DIRECTORY_UNSUPPORTED: DirectoryUnsupported,
    ENTRY_NOT_FOUND: EntryNotFound,
    ENTRY_UNNAMEABLE: EntryUnnameable,
    ENTRY_UNREADABLE: EntryUnreadable,
    ENTRY_UNSUPPORTED: EntryUnsupported,
    FILE_MISSING: FileMissing,
    INVALID_SURVEY: InvalidSurvey,
  },
});
