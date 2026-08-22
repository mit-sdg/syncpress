import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import {
  DeploymentActive,
  DeployingConcept,
  InvalidContext,
  InvalidEntries,
  InvalidPolicy,
  InvalidPreparation,
  InvalidRedirect,
  InvalidUrls,
  WorkNotActive,
  WorkNotCurrent,
  WorkNotPrepared,
} from "./deploying.ts";
import spec from "../../../design/concepts/Deploying.md" with { type: "text" };

export const deploying = registerConcept({
  class: DeployingConcept,
  spec,
  refusals: {
    DEPLOYMENT_ACTIVE: DeploymentActive,
    INVALID_CONTEXT: InvalidContext,
    INVALID_ENTRIES: InvalidEntries,
    INVALID_POLICY: InvalidPolicy,
    INVALID_PREPARATION: InvalidPreparation,
    INVALID_REDIRECT: InvalidRedirect,
    INVALID_URLS: InvalidUrls,
    WORK_NOT_ACTIVE: WorkNotActive,
    WORK_NOT_CURRENT: WorkNotCurrent,
    WORK_NOT_PREPARED: WorkNotPrepared,
  },
});
