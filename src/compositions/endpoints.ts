/**
 * The application boundary. One request runs one complete site build or
 * inspection: the endpoint records what the host wants, starts the phase
 * sequence, and answers at the settlement frontier where that job reaches a
 * terminal state. Every step in between belongs to a reaction.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { faulted } from "@mit-sdg/sync-engine/advanced";
import { no, reaction, refused, view, when, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { PHASES, PHASE_SEQUENCE, PLACES } from "./shared.ts";
import { InspectionOwner, SiteBuildSummary, SiteInspection } from "./views.ts";

const { Depending, Deploying, Diagnosing, Emitting, Locating, Phasing, Routing } = conceptRefs;

/** A direct refusal already owns boundary delivery; remember not to answer it again at settlement. */
export const RefusalInterruptsAggregateDelivery = reaction(() =>
  when(refused({})).then(Diagnosing.interrupt({})),
);

/** Runtime faults use the same one-answer boundary rule as refusals. */
export const FaultInterruptsAggregateDelivery = reaction(() =>
  when(faulted({})).then(Diagnosing.interrupt({})),
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

/** A job that reached a terminal state, whatever that state turned out to be. */
export const SettledSiteBuild = view(
  "the settled site build of sequence (sequence)",
  ({ sequence }, { job, state }) =>
    where(Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state })),
).optional();

/** A finished job whose work left nothing to diagnose, deploy, or wait for. */
export const PublishableSiteBuild = view(
  "the publishable site build of sequence (sequence)",
  ({ sequence }, { job }) =>
    where(
      Phasing._latest({ sequence }).is({ job, name: PHASE_SEQUENCE, state: "finished" }),
      Diagnosing._delivery({}).is({ interrupted: false }),
      Diagnosing._clean({}).is({ clean: true }),
      Deploying._outcome({}).is({ state: "completed" }),
      no(UnsettledRouteOwners({})),
    ),
).optional();

/* Build: stage the host project, run every phase, then publish a clean result. */

export const BuildSiteAtDestination = endpoint(
  "/site/build",
  ({ directory, destination, sequence, job, written, replaced, kept, removed }) =>
    receive({ directory, destination })
      .where(computations.isTextValue({ value: destination }))
      .then(Locating.request({ name: PLACES.base, path: directory }).responds({}))
      .then(Locating.request({ name: PLACES.destination, path: destination }).responds({}))
      .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
      .then(Phasing.start({ sequence }).responds({ job }))
      .afterFlowSettles()
      .then(
        where(PublishableSiteBuild({ sequence }).is({ job }))
          .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
          .then(respond({ written, replaced, kept, removed, summary: SiteBuildSummary({}) }))
          .named("published"),
        where(
          SettledSiteBuild({ sequence }).is({ job, state: "finished" }),
          Diagnosing._delivery({}).is({ interrupted: false }),
          Diagnosing._clean({}).is({ clean: false }),
        )
          .then(respond({ error: "BUILD_HAS_ERRORS" }))
          .named("errors"),
        where(
          SettledSiteBuild({ sequence }).is({ job, state: "finished" }),
          Diagnosing._delivery({}).is({ interrupted: false }),
          Diagnosing._clean({}).is({ clean: true }),
          no(PublishableSiteBuild({ sequence })),
        )
          .then(respond({ error: "BUILD_INCOMPLETE" }))
          .named("incomplete"),
        where(
          SettledSiteBuild({ sequence }).is({ job, state: "failed" }),
          Diagnosing._delivery({}).is({ interrupted: false }),
        )
          .then(respond({ error: "BUILD_FAILED" }))
          .named("failed"),
      ),
  { input: { required: ["directory"], defaults: { destination: null } } },
);

export const BuildSiteAtConfiguredOutput = endpoint(
  "/site/build",
  ({ directory, destination, sequence, job, written, replaced, kept, removed }) =>
    receive({ directory, destination })
      .where(computations.isAbsentValue({ value: destination }))
      .then(Locating.request({ name: PLACES.base, path: directory }).responds({}))
      .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
      .then(Phasing.start({ sequence }).responds({ job }))
      .afterFlowSettles()
      .then(
        where(PublishableSiteBuild({ sequence }).is({ job }))
          .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
          .then(respond({ written, replaced, kept, removed, summary: SiteBuildSummary({}) }))
          .named("published"),
        where(
          SettledSiteBuild({ sequence }).is({ job, state: "finished" }),
          Diagnosing._delivery({}).is({ interrupted: false }),
          Diagnosing._clean({}).is({ clean: false }),
        )
          .then(respond({ error: "BUILD_HAS_ERRORS" }))
          .named("errors"),
        where(
          SettledSiteBuild({ sequence }).is({ job, state: "finished" }),
          Diagnosing._delivery({}).is({ interrupted: false }),
          Diagnosing._clean({}).is({ clean: true }),
          no(PublishableSiteBuild({ sequence })),
        )
          .then(respond({ error: "BUILD_INCOMPLETE" }))
          .named("incomplete"),
        where(
          SettledSiteBuild({ sequence }).is({ job, state: "failed" }),
          Diagnosing._delivery({}).is({ interrupted: false }),
        )
          .then(respond({ error: "BUILD_FAILED" }))
          .named("failed"),
      ),
);

/* Inspect: stage and run the same phases, then report one page's provenance. */

export const InspectSite = endpoint("/site/inspect", ({ directory, target, sequence, job, owner }) =>
  receive({ directory, target })
    .then(Locating.request({ name: PLACES.base, path: directory }).responds({}))
    .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
    .then(Phasing.start({ sequence }).responds({ job }))
    .afterFlowSettles()
    .then(
      where(
        SettledSiteBuild({ sequence }).is({ job, state: "finished" }),
        Diagnosing._delivery({}).is({ interrupted: false }),
        InspectionOwner({ target }).is({ owner }),
      )
        .then(respond({ owner, inspection: SiteInspection({ owner }) }))
        .named("found"),
      where(
        SettledSiteBuild({ sequence }).is({ job, state: "finished" }),
        Diagnosing._delivery({}).is({ interrupted: false }),
        no(InspectionOwner({ target })),
      )
        .then(respond({ error: "INSPECTION_TARGET_NOT_FOUND" }))
        .named("missing"),
      where(
        SettledSiteBuild({ sequence }).is({ job, state: "failed" }),
        Diagnosing._delivery({}).is({ interrupted: false }),
      )
        .then(respond({ error: "BUILD_FAILED" }))
        .named("failed"),
    ),
);

export const ReadSiteSummary = endpoint("/site/summary", () =>
  receive({}).then(respond({ summary: SiteBuildSummary({}) })),
);

/* Phase progression: each phase begins only once the previous one settles. */

/** Advance the first phase only after all work caused by its announcement settles. */
export const AdvanceStartedSiteBuild = reaction(({ sequence, job, attempt }) =>
  when(Phasing.start({ sequence }).responds({ job, name: PHASE_SEQUENCE, attempt }))
    .afterFlowSettles()
    .where(Phasing._running({ sequence }).is({ job, name: PHASE_SEQUENCE, attempt }))
    .then(Phasing.advance({ job, attempt })),
);

/** Continue each later phase at the next settlement frontier in the same flow. */
export const AdvanceSiteBuild = reaction(({ job, attempt, nextAttempt }) =>
  when(Phasing.advance({ job, attempt }).responds({ name: PHASE_SEQUENCE, transitioned: true }))
    .afterFlowSettles()
    .where(Phasing._job({ job }).is({ name: PHASE_SEQUENCE, state: "running", attempt: nextAttempt }))
    .then(Phasing.advance({ job, attempt: nextAttempt })),
);
