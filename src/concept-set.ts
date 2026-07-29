import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { noting } from "./concepts/noting/registry.ts";

export const syncpressConcepts = conceptSet({ Noting: noting });
export const { concepts, vocabulary } = syncpressConcepts;
