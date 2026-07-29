import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  CollectingConcept,
  CollectionNotFound,
  InvalidCard,
  InvalidDirection,
  InvalidSortKey,
  InvalidText,
  NotIncluded,
} from "./collecting.ts";
import spec from "./spec.md" with { type: "text" };

export const collecting = registerConcept({
  class: CollectingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_DIRECTION: InvalidDirection,
    COLLECTION_NOT_FOUND: CollectionNotFound,
    INVALID_SORT_KEY: InvalidSortKey,
    INVALID_CARD: InvalidCard,
    NOT_INCLUDED: NotIncluded,
  },
});
