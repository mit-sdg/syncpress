import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { collecting } from "./concepts/collecting/registry.ts";
import { composing } from "./concepts/composing/registry.ts";
import { configuring } from "./concepts/configuring/registry.ts";
import { documenting } from "./concepts/documenting/registry.ts";
import { filing } from "./concepts/filing/registry.ts";
import { layering } from "./concepts/layering/registry.ts";
import { matching } from "./concepts/matching/registry.ts";

export const syncpressConcepts = conceptSet({
  Collecting: collecting,
  Composing: composing,
  Configuring: configuring,
  Documenting: documenting,
  Filing: filing,
  Layering: layering,
  Matching: matching,
});
export const { concepts, vocabulary } = syncpressConcepts;
