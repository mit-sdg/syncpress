import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { CollectingConcept, CollectionNotFound, NotIncluded } from "./collecting.ts";
import spec from "./spec.md" with { type: "text" };

export const collecting = registerConcept({
  class: CollectingConcept,
  spec,
  refusals: { COLLECTION_NOT_FOUND: CollectionNotFound, NOT_INCLUDED: NotIncluded },
});
