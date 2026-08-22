import { conceptSet } from "@mit-sdg/sync-engine/assembly";
import { syncpressComputations } from "./compositions/computations.ts";
import { cataloging } from "./concepts/cataloging/registry.ts";
import { commanding } from "./concepts/commanding/registry.ts";
import { converting } from "./concepts/converting/registry.ts";
import { dependencyTracking } from "./concepts/dependency-tracking/registry.ts";
import { deliveryArbitration } from "./concepts/delivery-arbitration/registry.ts";
import { diagnosing } from "./concepts/diagnosing/registry.ts";
import { documentParsing } from "./concepts/document-parsing/registry.ts";
import { deploying } from "./concepts/deploying/registry.ts";
import { embedding } from "./concepts/embedding/registry.ts";
import { emitting } from "./concepts/emitting/registry.ts";
import { filing } from "./concepts/filing/registry.ts";
import { governing } from "./concepts/governing/registry.ts";
import { holding } from "./concepts/holding/registry.ts";
import { layering } from "./concepts/layering/registry.ts";
import { locating } from "./concepts/locating/registry.ts";
import { phasing } from "./concepts/phasing/registry.ts";
import { referencing } from "./concepts/referencing/registry.ts";
import { renderTracking } from "./concepts/render-tracking/registry.ts";
import { routing } from "./concepts/routing/registry.ts";
import { serving } from "./concepts/serving/registry.ts";
import { templating } from "./concepts/templating/registry.ts";
import { transcoding } from "./concepts/transcoding/registry.ts";
import { watching } from "./concepts/watching/registry.ts";

/** Bind every concept contract to the implementation used by Syncpress. */
export const applicationConceptSet = conceptSet(
  {
    Cataloging: cataloging,
    Commanding: commanding,
    Converting: converting,
    DependencyTracking: dependencyTracking,
    DeliveryArbitration: deliveryArbitration,
    Diagnosing: diagnosing,
    DocumentParsing: documentParsing,
    Deploying: deploying,
    Embedding: embedding,
    Emitting: emitting,
    Filing: filing,
    Governing: governing,
    Holding: holding,
    Layering: layering,
    Locating: locating,
    Phasing: phasing,
    Referencing: referencing,
    RenderTracking: renderTracking,
    Routing: routing,
    Serving: serving,
    Templating: templating,
    Transcoding: transcoding,
    Watching: watching,
  },
  syncpressComputations,
);

// `concepts` contains inert references for composition; assembled applications
// expose the corresponding runtime instances through `application.concepts`.
export const { computations, concepts } = applicationConceptSet;
// Retained as the generated wire's source anchor until artifacts are repinned.
