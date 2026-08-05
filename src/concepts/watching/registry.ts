import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  DirectoryMissing,
  DirectoryUnobservable,
  DirectoryUnsupported,
  InvalidWatch,
  WatchingConcept,
  WatchNotFound,
  WatchNotOpen,
} from "./watching.ts";
import spec from "./spec.md" with { type: "text" };

export const watching = registerConcept({
  class: WatchingConcept,
  spec,
  refusals: {
    DIRECTORY_MISSING: DirectoryMissing,
    DIRECTORY_UNOBSERVABLE: DirectoryUnobservable,
    DIRECTORY_UNSUPPORTED: DirectoryUnsupported,
    INVALID_WATCH: InvalidWatch,
    WATCH_NOT_FOUND: WatchNotFound,
    WATCH_NOT_OPEN: WatchNotOpen,
  },
});
