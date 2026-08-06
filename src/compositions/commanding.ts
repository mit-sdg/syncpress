/** Syncpress command policy applied to generic process-facing concepts. */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { compute, no, view, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";

const { Attending, Commanding } = conceptRefs;

export const SyncpressCommand = view(
  "the Syncpress command represented by words (words)",
  ({ words }, { name, operands }) =>
    where(
      computations.syncpressCommandValid({ words }),
      compute(computations.syncpressCommandName, { words }, name),
      compute(computations.syncpressCommandOperands, { words }, operands),
    ),
).optional();

const SyncpressUsage = view(
  "the Syncpress usage report",
  (_input, { text }) => where(compute(computations.syncpressUsage, {}, text)),
).one();

const SyncpressMisuse = view(
  "the Syncpress misuse report",
  (_input, { text }) => where(compute(computations.syncpressMisuse, {}, text)),
).one();

export const InterpretCommandLine = endpoint(
  "/cli/interpret",
  ({ supplied, words }) =>
    receive({ arguments: supplied })
      .then(Commanding.capture({ arguments: supplied }).responds({ words }))
      .then(
        where(SyncpressCommand({ words }))
          .then(respond({ words }))
          .named("recognized"),
        where(no(SyncpressCommand({ words })))
          .then(respond({ error: "INVALID_USAGE" }))
          .named("invalid"),
      ),
);

export const AnnounceUsage = endpoint("/cli/usage", ({ text }) =>
  receive({})
    .where(SyncpressUsage({}).is({ text }))
    .then(Commanding.write({ stream: "output", text }).responds({}))
    .then(respond({})),
);

export const AnnounceMisuse = endpoint("/cli/misuse", ({ text }) =>
  receive({})
    .where(SyncpressMisuse({}).is({ text }))
    .then(Commanding.write({ stream: "error", text }).responds({}))
    .then(respond({})),
);

export const WriteCommandLine = endpoint("/cli/write", ({ stream, text }) =>
  receive({ stream, text })
    .then(Commanding.write({ stream, text }).responds({}))
    .then(respond({})),
);

export const HoldUntilStopped = endpoint("/cli/hold", ({ reason }) =>
  receive({})
    .then(Attending.hold({}).responds({ reason }))
    .then(respond({ reason })),
);

export const SetCommandLineExit = endpoint("/cli/exit", ({ code }) =>
  receive({ code })
    .then(Commanding.exit({ code }).responds({}))
    .then(respond({})),
);
