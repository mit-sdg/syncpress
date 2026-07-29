import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  ConversionFailed,
  ConvertingConcept,
  IncompatibleProfile,
  InvalidConversionInput,
  InvalidProfile,
  InvalidSubject,
  ProfileNotFound,
  UnsupportedExtension,
  UnsupportedProfileKind,
} from "./converting.ts";
import spec from "./spec.md" with { type: "text" };

export const converting = registerConcept({
  class: ConvertingConcept,
  spec,
  refusals: {
    INVALID_PROFILE: InvalidProfile,
    UNSUPPORTED_PROFILE_KIND: UnsupportedProfileKind,
    UNSUPPORTED_EXTENSION: UnsupportedExtension,
    INCOMPATIBLE_PROFILE: IncompatibleProfile,
    PROFILE_NOT_FOUND: ProfileNotFound,
    INVALID_CONVERSION_INPUT: InvalidConversionInput,
    INVALID_SUBJECT: InvalidSubject,
    CONVERSION_FAILED: ConversionFailed,
  },
});
