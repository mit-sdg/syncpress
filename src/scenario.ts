import { createLocalClient } from "@mit-sdg/sync-engine/client";
import type { SyncpressWire } from "../generated/wire.ts";
import { buildSyncpress } from "./edge.ts";

const { gateway } = buildSyncpress();
const notes = createLocalClient<SyncpressWire>({ invoker: gateway });

const written = await notes.notes.write({ text: "buy milk" });
if ("error" in written) throw new Error(String(written.error));
const read = await notes.notes.get({ note: written.note });
if ("error" in read) throw new Error(String(read.error));
const missing = await notes.notes.get({ note: "missing-note" });
if (!("error" in missing) || missing.error !== "NOTE_NOT_FOUND") {
  throw new Error("A missing note did not return NOTE_NOT_FOUND.");
}
console.log(JSON.stringify({ page: read.page, missing: missing.error }));
