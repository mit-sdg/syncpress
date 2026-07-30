import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  DeploymentActive,
  DeployingConcept,
  InvalidContext,
  InvalidEntries,
  InvalidPolicy,
  InvalidRedirect,
  InvalidUrls,
  WorkNotActive,
  WorkNotCurrent,
  WorkNotPending,
  WorkNotPrepared,
} from "./deploying.ts";
import spec from "./spec.md" with { type: "text" };

export const deploying = registerConcept({
  class: DeployingConcept,
  spec,
  refusals: {
    DEPLOYMENT_ACTIVE: DeploymentActive,
    INVALID_CONTEXT: InvalidContext,
    INVALID_ENTRIES: InvalidEntries,
    INVALID_POLICY: InvalidPolicy,
    INVALID_REDIRECT: InvalidRedirect,
    INVALID_URLS: InvalidUrls,
    WORK_NOT_ACTIVE: WorkNotActive,
    WORK_NOT_CURRENT: WorkNotCurrent,
    WORK_NOT_PENDING: WorkNotPending,
    WORK_NOT_PREPARED: WorkNotPrepared,
  },
});
