import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { SyncpressWire } from "../../generated/wire.ts";
import { assembleSyncpress, startSyncpressBuild } from "@syncpress/assembly";

/** Add the internal endpoint gateway to a fresh assembled application. */
export function createSyncpressRuntime() {
  const application = assembleSyncpress();
  const gateway = createGateway<SyncpressWire>({ application });
  const startBuild = (sequence: string) => startSyncpressBuild(application, sequence);
  return { application, gateway, startBuild };
}

export type Gateway = ReturnType<typeof createSyncpressRuntime>["gateway"];
