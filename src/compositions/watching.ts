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
import { publicationTransactionPrefix } from "./computations.ts";

const { Watching } = conceptRefs;

function validOpenWatchInput(value: unknown): { ok: true } | { ok: false; detail: string } {
  if (value === null || typeof value !== "object") return { ok: false, detail: "A site watch needs an input object." };
  const input = value as Record<string, unknown>;
  if (typeof input.directory !== "string" || !input.directory.isWellFormed() || input.directory === "") {
    return { ok: false, detail: "A site watch needs a non-empty text directory." };
  }
  if (!Number.isSafeInteger(input.settling) || (input.settling as number) <= 0) {
    return { ok: false, detail: "A site watch needs a positive settling duration." };
  }
  if (typeof input.output !== "string" || !input.output.isWellFormed() || input.output === ""
    || publicationTransactionPrefix(input.output) === null) {
    return { ok: false, detail: "A site watch needs an output path with a safe transaction prefix." };
  }
  return { ok: true };
}

export const OpenSiteWatch = endpoint("/watch/open", ({ directory, settling, output, watch, prefix }) =>
  receive({ directory, settling, output })
    .where(
      computations.isTextValue({ value: output }),
      PublicationTransactionPrefix({ destination: output }).is({ prefix }),
    )
    .then(Watching.observe({ directory, settling, excluded: output, prefix }).responds({ watch }))
    .then(respond({ watch })),
  { validators: { input: validOpenWatchInput } },
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
