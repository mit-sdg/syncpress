import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { CONFIGURATION_PATH } from "./shared.ts";

const { Configuring, Diagnosing, Emitting, Phasing, Routing } = concepts;

const NOJEKYLL_PATH = ".nojekyll";
const NOJEKYLL_PRODUCER = "deployment:nojekyll";

/** Static deployment artifacts belong to the build model, not boundary orchestration. */
export const EnabledNojekyllArtifactsBegin = reaction(({ configuration }) =>
  when(Phasing.advance({}).responds({ phase: "emit" }))
    .where(
      Configuring._active({}).is({ root: configuration }),
      Configuring._scalar({ node: configuration, path: ["deploy", "nojekyll"], otherwise: false }).is({ value: true }),
    )
    .then(Emitting.begin({ producer: NOJEKYLL_PRODUCER })),
);

export const BegunNojekyllArtifactsIntend = reaction(() =>
  when(Emitting.begin({ producer: NOJEKYLL_PRODUCER }).responds({}))
    .where(earlier(Phasing.advance, {}, { phase: "emit" }))
    .then(Emitting.intend({
      producer: NOJEKYLL_PRODUCER,
      path: NOJEKYLL_PATH,
      content: "",
      medium: "text/plain",
    })),
);

export const IntendedNojekyllArtifactsCommit = reaction(() =>
  when(Emitting.intend({ producer: NOJEKYLL_PRODUCER, path: NOJEKYLL_PATH }).responds({}))
    .where(earlier(Phasing.advance, {}, { phase: "emit" }))
    .then(Emitting.commit({ producer: NOJEKYLL_PRODUCER })),
);

export const NojekyllArtifactBeginFailuresDiagnose = reaction(({ error, detail }) =>
  when(Emitting.begin({ producer: NOJEKYLL_PRODUCER }).refuses({ error, detail }))
    .where(earlier(Phasing.advance, {}, { phase: "emit" }))
    .then(Diagnosing.report({
      severity: "error",
      code: "OUTPUT_COLLISION",
      message: detail,
      source: CONFIGURATION_PATH,
    })),
);

export const NojekyllArtifactIntentFailuresDiagnose = reaction(({ error, detail }) =>
  when(Emitting.intend({ producer: NOJEKYLL_PRODUCER, path: NOJEKYLL_PATH }).refuses({ error, detail }))
    .where(earlier(Phasing.advance, {}, { phase: "emit" }))
    .then(Diagnosing.report({
      severity: "error",
      code: "OUTPUT_COLLISION",
      message: detail,
      source: CONFIGURATION_PATH,
    })),
);

export const NojekyllArtifactCommitFailuresDiagnose = reaction(({ error, detail }) =>
  when(Emitting.commit({ producer: NOJEKYLL_PRODUCER }).refuses({ error, detail }))
    .where(earlier(Phasing.advance, {}, { phase: "emit" }))
    .then(Diagnosing.report({
      severity: "error",
      code: "OUTPUT_COLLISION",
      message: detail,
      source: CONFIGURATION_PATH,
    })),
);

export const MissingRequiredNotFoundPagesDiagnose = reaction(({ configuration }) =>
  when(Phasing.advance({}).responds({ phase: "emit" }))
    .where(
      Configuring._active({}).is({ root: configuration }),
      Configuring._scalar({ node: configuration, path: ["deploy", "requireNotFound"], otherwise: false }).is({ value: true }),
      no(Routing._owner({ address: "/404.html" })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "MISSING_NOT_FOUND",
      message: "deploy.requireNotFound requires an authored /404.html page.",
      source: CONFIGURATION_PATH,
    })),
);
