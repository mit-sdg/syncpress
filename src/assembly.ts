import { assemble } from "@mit-sdg/sync-engine/assembly";
import * as fullSite from "./compositions/full-site.ts";
import { syncpressConcepts, vocabulary } from "./concept-set.ts";

/** Create a fresh concept application and install the full-site composition. */
export function assembleSyncpress() {
  return assemble({
    vocabulary,
    instances: syncpressConcepts.implementations(),
    composition: { fullSite },
  });
}
