import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { CONFIGURATION_PATH, PHASES, PHASE_SEQUENCE, ROOTS } from "./shared.ts";
import { InspectionOwner, SiteBuildSummary, SiteInspection } from "./views.ts";

const { Depending, Deploying, Diagnosing, Emitting, Filing, Governing, Phasing, Routing } = conceptRefs;

/** Translate one host file into Filing through the portable application boundary. */
export const StageSiteFile = endpoint("/site/stage", ({ name, filePath, encoded, root }) =>
  receive({ name, filePath, encoded })
    .then(Filing.open({ name }).responds({ root }))
    .then(Filing.placeBase64({ root, path: filePath, encoded }).responds({}))
    .then(respond({})),
);

/** Enumerate routed owners without a current dependency result. */
export const UnsettledRouteOwners = view(
  "unsettled route owner",
  (_inputs, { owner }, _bindings) =>
    where(
      Routing._claims({}).is({ owner }),
      no(Depending._current({ subject: owner })),
    ),
).many();

/** Interpret the staged project configuration once and expose only valid policy. */
export const AssessSite = endpoint("/site/assess", ({ project, settings, source, policy, sources }) =>
  receive({})
    .where(
      Filing._named({ name: ROOTS.project }).is({ root: project }),
      Filing._at({ root: project, path: CONFIGURATION_PATH }).is({ file: settings }),
      Filing._text({ file: settings }).is({ text: source }),
    )
    .then(Governing.assess({ source }).responds({ policy, sources }))
    .then(respond({ policy, sources })),
);

export const RejectUnstagedProject = endpoint("/site/assess", () =>
  receive({})
    .where(no(Filing._named({ name: ROOTS.project })))
    .then(respond({ error: "PROJECT_NOT_STAGED" })),
);

export const RejectUnstagedConfiguration = endpoint("/site/assess", ({ project }) =>
  receive({})
    .where(
      Filing._named({ name: ROOTS.project }).is({ root: project }),
      no(Filing._at({ root: project, path: CONFIGURATION_PATH })),
    )
    .then(respond({ error: "CONFIGURATION_NOT_STAGED" })),
);

/** Answer deterministically when the staged configuration is not UTF-8 text. */
export const RejectNonTextSiteConfiguration = endpoint("/site/assess", ({ project, settings }) =>
  receive({})
    .where(
      Filing._named({ name: ROOTS.project }).is({ root: project }),
      Filing._at({ root: project, path: CONFIGURATION_PATH }).is({ file: settings }),
      no(Filing._text({ file: settings })),
    )
    .then(respond({ error: "INVALID_TEXT" })),
);

/** Direct output and prepare the phase sequence from an already valid assessment. */
export const ConfigureSite = endpoint("/site/configure", ({ destination, sequence }) =>
  receive({ destination })
    .where(Governing._policy({}))
    .then(Emitting.direct({ destination }).responds({}))
    .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
    .then(respond({ sequence })),
);

export const RejectUnassessedConfiguration = endpoint("/site/configure", ({ destination }) =>
  receive({ destination })
    .where(no(Governing._policy({})))
    .then(respond({ error: "CONFIGURATION_NOT_ASSESSED" })),
);

/** Prepare the phase sequence without directing or materializing output. */
export const PrepareSite = endpoint("/site/prepare", ({ sequence }) =>
  receive({})
    .where(Governing._policy({}))
    .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
    .then(respond({ sequence })),
);

export const RejectUnassessedPreparation = endpoint("/site/prepare", () =>
  receive({})
    .where(no(Governing._policy({})))
    .then(respond({ error: "CONFIGURATION_NOT_ASSESSED" })),
);

export const InspectSite = endpoint("/site/inspect", ({ target, owner }) =>
  receive({ target }).then(
    where(InspectionOwner({ target }).is({ owner }))
      .then(respond({ owner, inspection: SiteInspection({ owner }) }))
      .named("found"),
    where(no(InspectionOwner({ target })))
      .then(respond({ error: "INSPECTION_TARGET_NOT_FOUND" }))
      .named("missing"),
  ),
);

export const ReadSiteSummary = endpoint("/site/summary", () =>
  receive({}).then(respond({ summary: SiteBuildSummary({}) })),
);

export const StartSiteBuild = endpoint("/site/start", ({ sequence, job, phase, attempt }) =>
  receive({ sequence }).then(
    where(no(Phasing._latest({ sequence })))
      .then(Phasing.start({ sequence }).responds({ job, phase, attempt }))
      .then(respond({ job, phase, attempt }))
      .named("start"),
    where(Phasing._latest({ sequence }))
      .then(respond({ error: "BUILD_ALREADY_STARTED" }))
      .named("already-started"),
  ),
);

export const AdvanceSiteBuild = endpoint("/site/advance", ({ job, attempt, phase, nextAttempt, transitioned }) =>
  receive({ job, attempt })
    .then(Phasing.advance({ job, attempt }).responds({ phase, attempt: nextAttempt, transitioned }))
    .then(respond({ phase, attempt: nextAttempt, transitioned })),
);

/**
 * Publish only a completed deployment and diagnostically clean build. The
 * filesystem edge invokes this internal endpoint after its phase job settles.
 */
export const ReconcileSite = endpoint("/site/reconcile", ({ job, sequence, written, replaced, kept, removed }) =>
  receive({ job }).then(
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      Deploying._outcome({}).is({ state: "completed" }),
      no(UnsettledRouteOwners({})),
    )
      .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
      .then(respond({ written, replaced, kept, removed }))
      .named("reconcile"),
    where(no(Phasing._job({ job })))
      .then(respond({ error: "BUILD_NOT_COMPLETE" }))
      .named("incomplete"),
    where(Phasing._job({ job }).is.not({ name: PHASE_SEQUENCE }))
      .then(respond({ error: "BUILD_NOT_COMPLETE" }))
      .named("wrong-sequence"),
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "running" }),
    )
      .then(respond({ error: "BUILD_NOT_COMPLETE" }))
      .named("running"),
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "failed" }),
    )
      .then(respond({ error: "BUILD_FAILED" }))
      .named("failed"),
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      UnsettledRouteOwners({}),
    )
      .then(respond({ error: "BUILD_INCOMPLETE" }))
      .named("unsettled"),
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      no(UnsettledRouteOwners({})),
      no(Deploying._outcome({}).is({ state: "completed" })),
    )
      .then(respond({ error: "BUILD_INCOMPLETE" }))
      .named("deployment-incomplete"),
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "finished" }),
      Diagnosing._clean({}).is({ clean: false }),
    )
      .then(respond({ error: "BUILD_HAS_ERRORS" }))
      .named("errors"),
    where(
      Phasing._job({ job }).is({ sequence, name: PHASE_SEQUENCE }),
      no(Phasing._latest({ sequence }).is({ job })),
    )
      .then(respond({ error: "BUILD_SUPERSEDED" }))
      .named("superseded"),
  ),
);
