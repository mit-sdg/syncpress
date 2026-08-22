import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { InvalidRank, InvalidValues, LayeringConcept, NoSuchLayer, RankTaken } from "./layering.ts";
import spec from "../../../design/concepts/Layering.md" with { type: "text" };

export const layering = registerConcept({
  class: LayeringConcept,
  spec,
  refusals: {
    INVALID_RANK: InvalidRank,
    INVALID_VALUES: InvalidValues,
    NO_SUCH_LAYER: NoSuchLayer,
    RANK_TAKEN: RankTaken,
  },
});
