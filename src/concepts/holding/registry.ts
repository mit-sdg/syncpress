import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { HoldingConcept } from "./holding.ts";
import spec from "@design/concepts/Holding.md" with { type: "text" };

export const holding = registerConcept({ class: HoldingConcept, spec });
