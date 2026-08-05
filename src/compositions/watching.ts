/**
 * Watching a project while it publishes. Opening a watch also tells it which
 * paths not to count: the output directory a run publishes into, and the prefix
 * Emitting stages its reconciliation transactions under, so a rebuild never
 * observes itself.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { PublicationTransactionPrefix } from "./calculations.ts";

const { Watching } = conceptRefs;

export const OpenSiteWatch = endpoint("/watch/open", ({ directory, settling, output, watch, prefix }) =>
  receive({ directory, settling, output })
    .where(
      computations.isTextValue({ value: output }),
      PublicationTransactionPrefix({ destination: output }).is({ prefix }),
    )
    .then(Watching.observe({ directory, settling, excluded: output, prefix }).responds({ watch }))
    .then(respond({ watch })),
);

export const AttendSiteWatch = endpoint("/watch/attend", ({ watch, within, changed, watching }) =>
  receive({ watch, within })
    .then(Watching.attend({ watch, within }).responds({ changed, watching }))
    .then(respond({ changed, watching })),
);

export const CloseSiteWatch = endpoint("/watch/close", ({ watch }) =>
  receive({ watch })
    .then(Watching.close({ watch }).responds({}))
    .then(respond({})),
);
