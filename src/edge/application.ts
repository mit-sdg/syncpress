import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { SyncpressWire } from "../../generated/wire.ts";
import { assembleSyncpress } from "@syncpress/assembly";

/** Add the internal endpoint gateway to a fresh assembled application. */
export function createSyncpressRuntime() {
  const application = assembleSyncpress();
  const gateway = createGateway<SyncpressWire>({ application });
  return { application, gateway };
}

export type Application = ReturnType<typeof createSyncpressRuntime>["application"];
