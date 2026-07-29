import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { collecting } from "./concepts/collecting/registry.ts";
import { composing } from "./concepts/composing/registry.ts";
import { configuring } from "./concepts/configuring/registry.ts";
import { converting } from "./concepts/converting/registry.ts";
import { depending } from "./concepts/depending/registry.ts";
import { diagnosing } from "./concepts/diagnosing/registry.ts";
import { documenting } from "./concepts/documenting/registry.ts";
import { embedding } from "./concepts/embedding/registry.ts";
import { emitting } from "./concepts/emitting/registry.ts";
import { filing } from "./concepts/filing/registry.ts";
import { layering } from "./concepts/layering/registry.ts";
import { matching } from "./concepts/matching/registry.ts";
import { phasing } from "./concepts/phasing/registry.ts";
import { referencing } from "./concepts/referencing/registry.ts";
import { routing } from "./concepts/routing/registry.ts";
import { templating } from "./concepts/templating/registry.ts";
import { transcoding } from "./concepts/transcoding/registry.ts";

export const syncpressConcepts = conceptSet({
  Collecting: collecting,
  Composing: composing,
  Configuring: configuring,
  Converting: converting,
  Depending: depending,
  Diagnosing: diagnosing,
  Documenting: documenting,
  Embedding: embedding,
  Emitting: emitting,
  Filing: filing,
  Layering: layering,
  Matching: matching,
  Phasing: phasing,
  Referencing: referencing,
  Routing: routing,
  Templating: templating,
  Transcoding: transcoding,
});
export const { concepts, vocabulary } = syncpressConcepts;
