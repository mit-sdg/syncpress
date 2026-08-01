import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, view, where } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { CONFIGURATION_PATH, PHASES, PHASE_SEQUENCE, ROOTS } from "./shared.ts";

const { Configuring, Depending, Deploying, Diagnosing, Emitting, Filing, Governing, Phasing, Routing } = conceptRefs;

/** Enumerate routed owners without a current dependency result. */
export const UnsettledRouteOwners = view(
  "unsettled route owner",
  (_inputs, { owner }, _bindings) =>
    where(
      Routing._claims({}).is({ owner }),
      no(Depending._current({ subject: owner })),
    ),
).many();

/**
 * Load a configuration already staged in the project root and prepare a build
 * sequence. The filesystem edge establishes that precondition before invoking
 * this internal endpoint.
 */
export const ConfigureSite = endpoint("/site/configure", ({ destination, project, settings, source, sequence }) =>
  receive({ destination })
    .where(
      Filing._named({ name: ROOTS.project }).is({ root: project }),
      Filing._at({ root: project, path: CONFIGURATION_PATH }).is({ file: settings }),
      Filing._text({ file: settings }).is({ text: source }),
    )
    .then(Configuring.load({ source, notation: "yaml" }).responds({}))
    .then(Governing.assess({ source }).responds({}))
    .then(Emitting.direct({ destination }).responds({}))
    .then(Phasing.declare({ name: PHASE_SEQUENCE, phases: [...PHASES] }).responds({ sequence }))
    .then(respond({ sequence })),
);

/**
 * Publish only a completed deployment and diagnostically clean build. The
 * filesystem edge invokes this internal endpoint after its phase job settles.
 */
export const ReconcileSite = endpoint("/site/reconcile", ({ job, written, replaced, kept, removed }) =>
  receive({ job }).then(
    where(
      Phasing._outcome({ job }).is({ state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      Deploying._outcome({}).is({ state: "completed" }),
      no(UnsettledRouteOwners({})),
    )
      .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
      .then(respond({ written, replaced, kept, removed }))
      .named("reconcile"),
    where(no(Phasing._outcome({ job })))
      .then(respond({ error: "BUILD_NOT_COMPLETE" }))
      .named("incomplete"),
    where(Phasing._outcome({ job }).is({ state: "failed" }))
      .then(respond({ error: "BUILD_FAILED" }))
      .named("failed"),
    where(
      Phasing._outcome({ job }).is({ state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      UnsettledRouteOwners({}),
    )
      .then(respond({ error: "BUILD_INCOMPLETE" }))
      .named("unsettled"),
    where(
      Phasing._outcome({ job }).is({ state: "finished" }),
      Diagnosing._clean({}).is({ clean: true }),
      no(UnsettledRouteOwners({})),
      no(Deploying._outcome({}).is({ state: "completed" })),
    )
      .then(respond({ error: "BUILD_INCOMPLETE" }))
      .named("deployment-incomplete"),
    where(
      Phasing._outcome({ job }).is({ state: "finished" }),
      Diagnosing._clean({}).is({ clean: false }),
    )
      .then(respond({ error: "BUILD_HAS_ERRORS" }))
      .named("errors"),
  ),
);
