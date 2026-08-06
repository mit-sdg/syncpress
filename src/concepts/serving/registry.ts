import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  AddressUnavailable,
  InvalidPublication,
  InvalidServer,
  PublicationUnavailable,
  ServerCloseFailed,
  ServerNotFound,
  ServerNotOpen,
  ServingConcept,
} from "./serving.ts";
import spec from "./spec.md" with { type: "text" };

export const serving = registerConcept({
  class: ServingConcept,
  spec,
  refusals: {
    ADDRESS_UNAVAILABLE: AddressUnavailable,
    INVALID_PUBLICATION: InvalidPublication,
    INVALID_SERVER: InvalidServer,
    PUBLICATION_UNAVAILABLE: PublicationUnavailable,
    SERVER_CLOSE_FAILED: ServerCloseFailed,
    SERVER_NOT_FOUND: ServerNotFound,
    SERVER_NOT_OPEN: ServerNotOpen,
  },
});
