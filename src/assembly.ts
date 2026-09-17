import { assemble } from "@mit-sdg/sync-engine/assembly";
import * as fullSite from "./compositions/full-site.ts";
import { applicationConceptSet } from "./concepts.ts";

/** Create a fresh concept application and install the full-site composition. */
export function assembleSyncpress() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: applicationConceptSet.implementations(),
    composition: { fullSite },
    // Payload bytes belong to concept state, not occurrence evidence. Redacting
    // before traversal avoids expanding each Uint8Array into millions of fields.
    // The engine keeps original values privately for execution and matching.
    redaction: { fields: ["content"] },
  });
}
