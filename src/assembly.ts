import { assemble } from "@mit-sdg/sync-engine/assembly";
import * as composition from "./compositions/index.ts";
import { syncpressConcepts, vocabulary } from "./concept-set.ts";

export function assembleSyncpress() {
  return assemble({
    vocabulary,
    instances: syncpressConcepts.implementations(),
    composition,
  });
}
