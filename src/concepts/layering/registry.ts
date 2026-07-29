import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { LayeringConcept, NoSuchLayer, RankTaken } from "./layering.ts";
import spec from "./spec.md" with { type: "text" };

export const layering = registerConcept({
  class: LayeringConcept,
  spec,
  refusals: { NO_SUCH_LAYER: NoSuchLayer, RANK_TAKEN: RankTaken },
});
