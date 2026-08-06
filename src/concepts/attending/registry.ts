import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { AttendingConcept } from "./attending.ts";
import spec from "./spec.md" with { type: "text" };

export const attending = registerConcept({ class: AttendingConcept, spec });
