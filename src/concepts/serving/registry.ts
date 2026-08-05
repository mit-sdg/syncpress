import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import { AddressUnavailable, InvalidServer, ServerNotFound, ServerNotOpen, ServingConcept } from "./serving.ts";
import spec from "./spec.md" with { type: "text" };

export const serving = registerConcept({
  class: ServingConcept,
  spec,
  refusals: {
    ADDRESS_UNAVAILABLE: AddressUnavailable,
    INVALID_SERVER: InvalidServer,
    SERVER_NOT_FOUND: ServerNotFound,
    SERVER_NOT_OPEN: ServerNotOpen,
  },
});
