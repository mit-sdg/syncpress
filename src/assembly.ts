import { assemble } from "@mit-sdg/sync-engine/assembly";
import * as fullSite from "./compositions/full-site.ts";
import { applicationConceptSet } from "./concepts.ts";

/** Create a fresh concept application and install the full-site composition. */
export function assembleSyncpress() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: applicationConceptSet.implementations(),
    composition: { fullSite },
  });
}
