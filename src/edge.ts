import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { SyncpressWire } from "../generated/wire.ts";
import { assembleSyncpress } from "./assembly.ts";

export function buildSyncpress() {
  const application = assembleSyncpress();
  const gateway = createGateway<SyncpressWire>({ application });
  return { application, gateway };
}
