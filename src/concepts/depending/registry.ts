import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { DependingConcept, NotBuilding } from "./depending.ts";
import spec from "./spec.md" with { type: "text" };

export const depending = registerConcept({ class: DependingConcept, spec, refusals: { NOT_BUILDING: NotBuilding } });
