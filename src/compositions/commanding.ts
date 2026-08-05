/**
 * The operator's side of the command line. One request interprets what they
 * typed; the rest report back to them on their own streams. What a request
 * asks for is carried out by the host adapter that owns a runtime for it.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts as conceptRefs } from "@syncpress/concept-set";

const { Commanding } = conceptRefs;

export const InterpretCommandLine = endpoint(
  "/cli/interpret",
  ({ args, name, directory, destination, target, port }) =>
    receive({ arguments: args })
      .then(Commanding.interpret({ arguments: args }).responds({ name, directory, destination, target, port }))
      .then(respond({ name, directory, destination, target, port })),
);

export const AnnounceUsage = endpoint("/cli/usage", ({ usage }) =>
  receive({})
    .where(Commanding._usage({}).is({ usage }))
    .then(Commanding.say({ text: usage }).responds({}))
    .then(respond({})),
);

export const AnnounceMisuse = endpoint("/cli/misuse", ({ misuse }) =>
  receive({})
    .where(Commanding._misuse({}).is({ misuse }))
    .then(respond({ misuse })),
);

export const AnnounceBuild = endpoint(
  "/cli/announce",
  ({ pages, files, written, replaced, kept, removed, text }) =>
    receive({ pages, files, written, replaced, kept, removed })
      .then(Commanding.summarize({ pages, files, written, replaced, kept, removed }).responds({ text }))
      .then(respond({ text })),
);

export const SayToOperator = endpoint("/cli/say", ({ text }) =>
  receive({ text })
    .then(Commanding.say({ text }).responds({}))
    .then(respond({})),
);

export const AnnounceServer = endpoint("/cli/serving", ({ directory, host, port }) =>
  receive({ directory, host, port })
    .then(Commanding.announce({ directory, host, port }).responds({}))
    .then(respond({})),
);

export const WarnOperator = endpoint("/cli/warn", ({ text }) =>
  receive({ text })
    .then(Commanding.warn({ text }).responds({}))
    .then(respond({})),
);

export const HoldUntilStopped = endpoint("/cli/hold", ({ reason }) =>
  receive({})
    .then(Commanding.hold({}).responds({ reason }))
    .then(respond({ reason })),
);

export const SetCommandLineExit = endpoint("/cli/exit", ({ code }) =>
  receive({ code })
    .then(Commanding.exit({ code }).responds({}))
    .then(respond({})),
);
