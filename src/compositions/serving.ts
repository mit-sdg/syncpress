/**
 * Serving what a build published. A server is opened before anything is built,
 * so a caller learns its address first, and is pointed at each reconciled
 * output as it appears; refreshing it tells every listening reader to reload.
 */
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { concepts as conceptRefs } from "@syncpress/concept-set";

const { Serving } = conceptRefs;

export const OpenSiteServer = endpoint("/serve/open", ({ host, port, server, bound }) =>
  receive({ host, port })
    .then(Serving.open({ host, port }).responds({ server, port: bound }))
    .then(respond({ server, host, port: bound })),
);

/** One published output becomes what the server answers from, and readers are told. */
export const PublishSiteOutput = endpoint("/serve/publish", ({ server, directory, readers }) =>
  receive({ server, directory })
    .then(Serving.publish({ server, directory }).responds({ readers }))
    .then(respond({ readers })),
);

export const CloseSiteServer = endpoint("/serve/close", ({ server }) =>
  receive({ server })
    .then(Serving.close({ server }).responds({}))
    .then(respond({})),
);
