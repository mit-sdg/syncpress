import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  CatalogingConcept,
  CatalogNotFound,
  InvalidCard,
  InvalidCondition,
  InvalidDirection,
  InvalidField,
  InvalidSelector,
  InvalidText,
  NotIncluded,
} from "./cataloging.ts";
import spec from "./spec.md" with { type: "text" };

export const cataloging = registerConcept({
  class: CatalogingConcept,
  spec,
  refusals: {
    INVALID_TEXT: InvalidText,
    INVALID_DIRECTION: InvalidDirection,
    INVALID_SELECTOR: InvalidSelector,
    CATALOG_NOT_FOUND: CatalogNotFound,
    INVALID_FIELD: InvalidField,
    INVALID_CONDITION: InvalidCondition,
    INVALID_CARD: InvalidCard,
    NOT_INCLUDED: NotIncluded,
  },
});
