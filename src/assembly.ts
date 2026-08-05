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

export type SyncpressApplication = ReturnType<typeof assembleSyncpress>;

/** Start the engine-native build flow and await all of its settlement frontiers. */
export async function startSyncpressBuild(application: SyncpressApplication, sequence: string): Promise<string> {
  const started = await application.concepts.Phasing.start({ sequence });
  if ("error" in started) throw new Error(`Could not run the site build: ${started.error}`);
  return started.job;
}
