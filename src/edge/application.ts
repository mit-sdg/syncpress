import { createGateway } from "@mit-sdg/sync-engine/boundary";
import type { SyncpressWire } from "../../generated/wire.ts";
import { assembleSyncpress } from "@syncpress/assembly";

/** Add the internal endpoint gateway to a fresh assembled application. */
export function createSyncpressRuntime() {
  const application = assembleSyncpress();
  const gateway = createGateway<SyncpressWire>({ application });
  return { application, gateway };
}

export type Gateway = ReturnType<typeof createSyncpressRuntime>["gateway"];

/**
 * A build answers only once its work is done, so batch requests wait for the
 * work rather than for a clock, using the largest wait the boundary accepts.
 */
export const BATCH_TIMEOUT_MS = 2_147_483_647;

export type Answer<T> = { ok: true; value: T } | { ok: false; error: GatewayError };
export type GatewayError =
  | { kind: "domain"; value: unknown }
  | { kind: "framework"; code: string; detail?: string };

/** What went wrong, in the words the application used. */
export function reason(error: GatewayError): string {
  if (error.kind !== "domain") return error.detail ?? error.code;
  return typeof error.value === "string" ? error.value : JSON.stringify(error.value);
}

/** The value an endpoint answered, or a failure naming the endpoint that refused. */
export function answer<T>(result: Answer<T>, context: string): T {
  if (!result.ok) throw new Error(`${context}: ${reason(result.error)}`);
  return result.value;
}
