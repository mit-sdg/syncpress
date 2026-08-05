import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { syncpressComputations } from "./computations.ts";
import { attending } from "./concepts/attending/registry.ts";
import { cataloging } from "./concepts/cataloging/registry.ts";
import { commanding } from "./concepts/commanding/registry.ts";
import { converting } from "./concepts/converting/registry.ts";
import { depending } from "./concepts/depending/registry.ts";
import { diagnosing } from "./concepts/diagnosing/registry.ts";
import { documenting } from "./concepts/documenting/registry.ts";
import { deploying } from "./concepts/deploying/registry.ts";
import { embedding } from "./concepts/embedding/registry.ts";
import { emitting } from "./concepts/emitting/registry.ts";
import { filing } from "./concepts/filing/registry.ts";
import { governing } from "./concepts/governing/registry.ts";
import { layering } from "./concepts/layering/registry.ts";
import { locating } from "./concepts/locating/registry.ts";
import { matching } from "./concepts/matching/registry.ts";
import { phasing } from "./concepts/phasing/registry.ts";
import { referencing } from "./concepts/referencing/registry.ts";
import { rendering } from "./concepts/rendering/registry.ts";
import { routing } from "./concepts/routing/registry.ts";
import { scanning } from "./concepts/scanning/registry.ts";
import { serving } from "./concepts/serving/registry.ts";
import { templating } from "./concepts/templating/registry.ts";
import { transcoding } from "./concepts/transcoding/registry.ts";
import { watching } from "./concepts/watching/registry.ts";

/** Bind every concept contract to the implementation used by Syncpress. */
export const syncpressConcepts = conceptSet(
  {
    Attending: attending,
    Cataloging: cataloging,
    Commanding: commanding,
    Converting: converting,
    Depending: depending,
    Diagnosing: diagnosing,
    Documenting: documenting,
    Deploying: deploying,
    Embedding: embedding,
    Emitting: emitting,
    Filing: filing,
    Governing: governing,
    Layering: layering,
    Locating: locating,
    Matching: matching,
    Phasing: phasing,
    Referencing: referencing,
    Rendering: rendering,
    Routing: routing,
    Scanning: scanning,
    Serving: serving,
    Templating: templating,
    Transcoding: transcoding,
    Watching: watching,
  },
  syncpressComputations,
);

// `concepts` contains inert references for composition; assembled applications
// expose the corresponding runtime instances through `application.concepts`.
export const { computations, concepts, vocabulary } = syncpressConcepts;
