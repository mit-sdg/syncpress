/**
 * The application boundary. One request runs one complete site build or
 * inspection: the endpoint records what the host wants, starts the phase
 * sequence, and answers at the settlement frontier where that job reaches a
 * terminal state. Every step in between belongs to a reaction.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { faulted } from "@mit-sdg/sync-engine/advanced";
import { earlier, no, reaction, refused, view, when, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concepts";
import { PHASES, PHASE_SEQUENCE, PLACES } from "./shared.ts";
import { PendingFailedRenderingCleanup } from "./render.ts";
import { InspectionOwner, SiteInspection } from "./inspection.ts";
import { SiteBuildSummary } from "./views.ts";

const { DeliveryArbitration, DependencyTracking, Deploying, Diagnosing, Emitting, Locating, Phasing, Routing } = conceptRefs;

function validBuildInput(value: unknown): { ok: true } | { ok: false; detail: string } {
  if (value === null || typeof value !== "object") return { ok: false, detail: "A site build needs an input object." };
  const input = value as Record<string, unknown>;
  if (typeof input.directory !== "string" || !input.directory.isWellFormed() || input.directory === "") {
    return { ok: false, detail: "A site build needs a non-empty text directory." };
  }
  if (input.destination !== null && input.destination !== undefined
    && (typeof input.destination !== "string" || !input.destination.isWellFormed() || input.destination === "")) {
    return { ok: false, detail: "A site build destination must be non-empty text when supplied." };
  }
  return { ok: true };
}

/** A direct refusal already owns this flow's boundary delivery. */
export const SiteBuildRefusalsInterruptAggregateDelivery = reaction(({ job }) =>
  when(refused({}))
    .where(earlier(Phasing.start, {}, { job, name: PHASE_SEQUENCE }))
    .then(DeliveryArbitration.recordInterruption({ task: job })),
);

/** Runtime faults use the same one-answer rule, scoped to their build flow. */
export const SiteBuildFaultsInterruptAggregateDelivery = reaction(({ job }) =>
  when(faulted({}))
    .where(earlier(Phasing.start, {}, { job, name: PHASE_SEQUENCE }))
    .then(DeliveryArbitration.recordInterruption({ task: job })),
);

/** Enumerate routed owners without a current dependency result. */
export const UnsettledRouteOwners = view(
  "unsettled route owner",
  (_inputs, { owner }, _bindings) =>
    where(
      Routing._claims({}).is({ owner }),
      no(DependencyTracking._current({ subject: owner })),
    ),
).many();

/** A job that reached a terminal state, whatever that state turned out to be. */
export const SettledSiteBuild = view(
  "the settled site build of job (job)",
  ({ job }, { state }) =>
    where(
      Phasing._job({ job }).is({ name: PHASE_SEQUENCE }),
      Phasing._outcome({ job }).is({ state }),
    ),
).optional();

/** A finished job whose work left nothing to diagnose, deploy, or wait for. */
export const PublishableSiteBuild = view(
  "job (job) is a publishable site build",
  ({ job }) =>
    where(
      SettledSiteBuild({ job }).is({ state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      Deploying._outcome({}).is({ state: "completed" }),
      no(UnsettledRouteOwners({})),
    ),
).holds();

/* Build: stage the host project, run every phase, then publish a clean result. */

export const BuildSiteAtDestination = endpoint(
  "/site/build",
  ({ directory, destination, sequence, job, written, replaced, kept, removed }) =>
    receive({ directory, destination })
      .where(computations.isTextValue({ value: destination }))
      .then(Locating.recordRequest({ name: PLACES.base, path: directory }).responds({}))
      .then(Locating.recordRequest({ name: PLACES.destination, path: destination }).responds({}))
      .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
      .then(Phasing.start({ sequence }).responds({ job }))
      .afterFlowSettles()
      .where(SettledSiteBuild({ job }))
      .then(DeliveryArbitration.settle({ task: job }).responds({ task: job, interrupted: false }))
      .then(
        where(PublishableSiteBuild({ job }))
          .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
          .then(respond({ written, replaced, kept, removed, summary: SiteBuildSummary({}) }))
          .named("published"),
        where(
          SettledSiteBuild({ job }).is({ state: "finished" }),
          Diagnosing._clean({}).is({ clean: false }),
        )
          .then(respond({ error: "BUILD_HAS_ERRORS" }))
          .named("errors"),
        where(
          SettledSiteBuild({ job }).is({ state: "finished" }),
          Diagnosing._clean({}).is({ clean: true }),
          no(PublishableSiteBuild({ job })),
        )
          .then(respond({ error: "BUILD_INCOMPLETE" }))
          .named("incomplete"),
        where(
          SettledSiteBuild({ job }).is({ state: "failed" }),
        )
          .then(respond({ error: "BUILD_FAILED" }))
          .named("failed"),
      ),
  {
    input: { required: ["directory"], defaults: { destination: null } },
    validators: { input: validBuildInput },
  },
);

export const BuildSiteAtConfiguredOutput = endpoint(
  "/site/build",
  ({ directory, destination, sequence, job, written, replaced, kept, removed }) =>
    receive({ directory, destination })
      .where(computations.isAbsentValue({ value: destination }))
      .then(Locating.recordRequest({ name: PLACES.base, path: directory }).responds({}))
      .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
      .then(Phasing.start({ sequence }).responds({ job }))
      .afterFlowSettles()
      .where(SettledSiteBuild({ job }))
      .then(DeliveryArbitration.settle({ task: job }).responds({ task: job, interrupted: false }))
      .then(
        where(PublishableSiteBuild({ job }))
          .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
          .then(respond({ written, replaced, kept, removed, summary: SiteBuildSummary({}) }))
          .named("published"),
        where(
          SettledSiteBuild({ job }).is({ state: "finished" }),
          Diagnosing._clean({}).is({ clean: false }),
        )
          .then(respond({ error: "BUILD_HAS_ERRORS" }))
          .named("errors"),
        where(
          SettledSiteBuild({ job }).is({ state: "finished" }),
          Diagnosing._clean({}).is({ clean: true }),
          no(PublishableSiteBuild({ job })),
        )
          .then(respond({ error: "BUILD_INCOMPLETE" }))
          .named("incomplete"),
        where(
          SettledSiteBuild({ job }).is({ state: "failed" }),
        )
          .then(respond({ error: "BUILD_FAILED" }))
          .named("failed"),
      ),
);

/* Inspect: stage and run the same phases, then report one page's provenance. */

export const InspectSite = endpoint("/site/inspect", ({ directory, target, sequence, job, owner }) =>
  receive({ directory, target })
    .then(Locating.recordRequest({ name: PLACES.base, path: directory }).responds({}))
    .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
    .then(Phasing.start({ sequence }).responds({ job }))
    .afterFlowSettles()
    .where(SettledSiteBuild({ job }))
    .then(DeliveryArbitration.settle({ task: job }).responds({ task: job, interrupted: false }))
    .then(
      where(
        SettledSiteBuild({ job }).is({ state: "finished" }),
        InspectionOwner({ target }).is({ owner }),
      )
        .then(respond({ owner, inspection: SiteInspection({ owner }) }))
        .named("found"),
      where(
        SettledSiteBuild({ job }).is({ state: "finished" }),
        no(InspectionOwner({ target })),
      )
        .then(respond({ error: "INSPECTION_TARGET_NOT_FOUND" }))
        .named("missing"),
      where(
        SettledSiteBuild({ job }).is({ state: "failed" }),
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
    .then(Phasing.completePhase({ job, attempt })),
);

/** Continue each later phase at the next settlement frontier in the same flow. */
export const AdvanceSiteBuild = reaction(({ job, attempt, nextAttempt }) =>
  when(Phasing.completePhase({ job, attempt }).responds({ name: PHASE_SEQUENCE, transitioned: true }))
    .afterFlowSettles()
    .where(
      Phasing._job({ job }).is({ name: PHASE_SEQUENCE, state: "running", attempt: nextAttempt }),
      no(PendingFailedRenderingCleanup({})),
    )
    .then(Phasing.completePhase({ job, attempt: nextAttempt })),
);
