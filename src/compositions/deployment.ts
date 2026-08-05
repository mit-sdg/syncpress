import { earlier, each, former, no, reaction, view, when, where, whether } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { AddressOutputPath } from "./calculations.ts";
import { CONFIGURATION_PATH, PAGE_CONTENT_PATH, PHASE_SEQUENCE, TRUSTED_COLLECTION_EXCERPTS } from "./shared.ts";

const {
  Cataloging,
  Depending,
  Deploying,
  Diagnosing,
  Emitting,
  Governing,
  Phasing,
  Referencing,
  Routing,
  Templating,
} = conceptRefs;

const DEPLOYMENT_LAYOUT = "deployment-layout";

// Cataloging owns this order. each(...) preserves it in deployment snapshots.
const CatalogEntries = former(
  "the deployment entries of catalog (catalog)",
  ({ catalog }, { item, card }) =>
    each(Cataloging._entries({ catalog }).is({ item, card })).form({ item, card }),
);

const SitemapPage = view(
  "sitemap page",
  (_inputs, { owner, address, url }, _bindings) =>
    where(
      Routing._claims({}).is({ owner, address }).is.not({ address: "/404.html" }),
      no(Deploying._forOwner({ owner }).is({ kind: "redirect" })),
      Routing._absolute({ address }).is({ url }),
    ),
).many();

const RoutedDeploymentWork = view(
  "routed deployment work (work)",
  ({ work }, { owner, address }, _bindings) => [
    where(Deploying._work({ work }).is({ kind: "redirect", owner, from: address })),
    where(Deploying._work({ work }).is({ kind: "pagination-page", owner, address })),
  ],
).optional();

const CommittableDeploymentWork = view(
  "committable deployment work of producer (producer)",
  ({ producer }, { work }, _bindings) => [
    where(Deploying._forProducer({ producer }).is({ work, kind: "nojekyll", status: "active" })),
    where(Deploying._forProducer({ producer }).is({ work, status: "prepared" })),
  ],
).optional();

const HeldDeploymentLayoutReference = view(
  "held deployment layout reference of source (source)",
  ({ source }, { reference, raw }, _bindings) => [
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "external" })),
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "fragment" })),
  ],
).many();

const SitemapUrls = former(
  "the sitemap urls",
  // Routing._claims is already deterministically ordered; preserve that order.
  (_inputs, { owner, address, url }) =>
    each(SitemapPage({}).is({ owner, address, url })).form({ url }),
);

/** Start a finite deployment queue as part of the emit phase itself. */
export const EmitPhaseStartsDeployment = reaction(({ policy }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "emit", transitioned: true }))
    .where(Governing._publishing({}).is({ policy }))
    .then(Deploying.start({ policy })),
);

export const StartedDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.start({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const CompletedDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.complete({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const FailedDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.fail({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const RejectedDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.reject({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const RejectedOwnerDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.rejectOwner({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const RejectedProducerDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.rejectProducer({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const DividedPaginationsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.divide({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

/** A required not-found page must be authored before generated routes are claimed. */
export const MissingRequiredNotFoundPagesDiagnose = reaction(() =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "emit", transitioned: true }))
    .where(
      Governing._deployment({}).is({ requireNotFound: true }),
      no(Routing._owner({ address: "/404.html" })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "MISSING_NOT_FOUND",
      message: "deploy.requireNotFound requires an authored /404.html page.",
      source: CONFIGURATION_PATH,
    })),
);

export const NojekyllWorkBegins = reaction(({ deployment, work, producer }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(Deploying._work({ work }).is({ kind: "nojekyll", producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunNojekyllWorkIntends = reaction(({ producer, attempt, path }) =>
  when(Emitting.begin({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ kind: "nojekyll", path }),
    )
    .then(Emitting.intend({ producer, attempt, path, content: "", medium: "text/plain" })),
);

/** Redirect and pagination routes are claimed in queue order. */
export const RoutedDeploymentWorkClaims = reaction(({ deployment, work, owner, address }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(RoutedDeploymentWork({ work }).is({ owner, address }))
    .then(Routing.claim({ owner, address })),
);

/** Successful generated claims retain the same inspection provenance as before. */
export const GeneratedClaimsBeginDependencies = reaction(({ owner }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(Depending.begin({ subject: owner })),
);

export const GeneratedDependenciesTrackConfiguration = reaction(({ owner, attempt }) =>
  when(Depending.begin({ subject: owner }).responds({ attempt }))
    .where(Deploying._forOwner({ owner }))
    .then(Depending.use({ subject: owner, attempt, input: CONFIGURATION_PATH })),
);

export const GeneratedDependenciesSettle = reaction(({ owner, attempt }) =>
  when(Depending.use({ subject: owner, attempt, input: CONFIGURATION_PATH }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(Depending.settle({ subject: owner, attempt })),
);

/** Local redirect targets use routing projection and canonical origin when available. */
export const ClaimedLocalRedirectsRender = reaction(({ owner, work, raw, target, canonical }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(
      Deploying._forOwner({ owner }).is({ work, kind: "redirect", to: raw }),
      Routing._url({ target: raw }).is({ url: target }),
      Routing._absolute({ address: raw }).is({ url: canonical }),
    )
    .then(Deploying.redirect({ work, target, canonical })),
);

export const ClaimedUnoriginatedRedirectsRender = reaction(({ owner, work, raw, target }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(
      Deploying._forOwner({ owner }).is({ work, kind: "redirect", to: raw }),
      Routing._url({ target: raw }).is({ url: target }),
      no(Routing._absolute({ address: raw })),
    )
    .then(Deploying.redirect({ work, target, canonical: target })),
);

export const ClaimedExternalRedirectsRender = reaction(({ owner, work, target }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(
      Deploying._forOwner({ owner }).is({ work, kind: "redirect", to: target }),
      computations.targetHasKind({ target, kind: "external" }),
    )
    .then(Deploying.redirect({ work, target, canonical: target })),
);

export const RenderedRedirectsBegin = reaction(({ work, producer }) =>
  when(Deploying.redirect({ work }).responds({}))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunRedirectsIntend = reaction(({ producer, attempt, work, address, path, content }) =>
  when(Emitting.begin({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "redirect", from: address }),
      AddressOutputPath({ address }).is({ path }),
      earlier(Deploying.redirect, { work }, { content }),
    )
    .then(Emitting.intend({ producer, attempt, path, content, medium: "text/html" })),
);

/** Resolve a pagination plan before replacing it with page work. */
export const PaginationPlansDivide = reaction(({ deployment, work, collectionName, catalog, templateName, template }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName, templateName }),
      Cataloging._named({ name: collectionName }).is({ catalog }),
      Templating._template({ name: templateName }).is({ template }),
    )
    .then(Deploying.divide({ deployment, work, template, entries: CatalogEntries({ catalog }) })),
);

export const MissingPaginationCollectionsDiagnose = reaction(({ deployment, work, collectionName }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName }),
      no(Cataloging._named({ name: collectionName })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "PAGINATION_COLLECTION_NOT_FOUND",
      message: "A pagination rule names no configured collection.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const MissingPaginationTemplatesDiagnose = reaction(({ deployment, work, collectionName, templateName }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName, templateName }),
      Cataloging._named({ name: collectionName }),
      no(Templating._template({ name: templateName })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "TEMPLATE_NOT_FOUND",
      message: "A pagination rule selects an undefined template.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const ClaimedPaginationPagesFormContext = reaction(
  ({ owner, work, site, collections, address, canonicalUrl }) =>
    when(Routing.claim({ owner }).responds({}))
      .where(
        Deploying._forOwner({ owner }).is({ work, kind: "pagination-page", address }),
        Governing._site({}).is({ site }),
        Cataloging._record({}).is({ catalogs: collections }),
        whether(Routing._absolute({ address }).is({ url: canonicalUrl })),
      )
      .then(Deploying.context({ work, site, collections, canonicalUrl })),
);

export const PaginationContextsRender = reaction(({ work, owner, template, context }) =>
  when(Deploying.context({ work }).responds({ owner, template, context })).then(
    Templating.render({
      template,
      subject: owner,
      context,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    }),
  ),
);

export const RenderedPaginationLayoutsScan = reaction(({ owner, output }) =>
  when(Templating.render({ subject: owner }).responds({ output }))
    .where(Deploying._forOwner({ owner }).is({ kind: "pagination-page" }))
    .then(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT, text: output })),
);

export const AbsoluteDeploymentLayoutReferencesRebase = reaction(({ source, reference, raw, url }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      computations.targetHasKind({ target: raw, kind: "absolute" }),
      Routing._url({ target: raw }).is({ url }),
    )
    .then(Referencing.answer({ reference, form: "address", value: url })),
);

export const NonlocalDeploymentLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(HeldDeploymentLayoutReference({ source }).is({ reference, raw }))
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

// These effects share an owner discovered by a state read, so they cannot form
// portable later stages. Either partial result remains non-publishable: rejected
// work makes the deployment fail, while unrejected work leaves it active.
export const UnprojectableDeploymentLayoutReferencesDiagnose = reaction(({ source, owner, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: owner }),
      Deploying._forOwner({ owner }),
      Referencing._references({ source }).is({ raw }),
      computations.targetHasKind({ target: raw, kind: "absolute" }),
      no(Routing._url({ target: raw })),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_LOCAL_REFERENCE",
        message: "A generated layout reference could not be projected.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.rejectOwner({ owner }).named("reject"),
    ),
);

export const InvalidDeploymentLayoutReferencesDiagnose = reaction(({ source, owner, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: owner }),
      Deploying._forOwner({ owner }),
      Referencing._references({ source }).is({ raw }),
      computations.targetHasKind({ target: raw, kind: "relative" }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "RELATIVE_LAYOUT_REFERENCE",
        message: "A generated layout reference must be site-absolute, external, or fragment-only.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.rejectOwner({ owner }).named("reject"),
    ),
);

export const EmptyPaginationLayoutScansBegin = reaction(({ owner, producer }) =>
  when(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT }).responds({ completed: true }))
    .where(Deploying._forOwner({ owner }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const FinishedPaginationLayoutAnswersBegin = reaction(({ owner, producer }) =>
  when(Referencing.answer({}).responds({ subject: owner, part: DEPLOYMENT_LAYOUT, completed: true }))
    .where(Deploying._forOwner({ owner }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunPaginationPagesIntend = reaction(({ producer, attempt, address, path, text }) =>
  when(Emitting.begin({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ kind: "pagination-page", address }),
      AddressOutputPath({ address }).is({ path }),
      Referencing._finished({ subject: producer, part: DEPLOYMENT_LAYOUT }).is({ text }),
    )
    .then(Emitting.intend({ producer, attempt, path, content: text, medium: "text/html" })),
);

export const PaginationTemplateFailuresDiagnose = reaction(({ owner, error, detail }) =>
  when(Templating.render({ subject: owner }).refuses({ error, detail }))
    .where(Deploying._forOwner({ owner }).is({ kind: "pagination-page" }))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwner({ owner })),
);

export const DeploymentReferenceScanFailuresDiagnose = reaction(({ owner, error, detail }) =>
  when(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT }).refuses({ error, detail }))
    .where(Deploying._forOwner({ owner }))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwner({ owner })),
);

// This owner is also discovered by a state read, so the same non-publishable
// partial-failure rule used above applies.
export const DeploymentReferenceAnswerFailuresDiagnose = reaction(({ reference, error, detail, source, owner }) =>
  when(Referencing.answer({ reference }).refuses({ error, detail }))
    .where(
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: owner, part: DEPLOYMENT_LAYOUT }),
      Deploying._forOwner({ owner }),
    )
    .then(
      Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.rejectOwner({ owner }).named("reject"),
    ),
);

/** Sitemap and feed snapshots are formed only after all earlier route work has completed. */
export const SitemapWorkPrepares = reaction(({ deployment, work }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(Deploying._work({ work }).is({ kind: "sitemap" }))
    .then(Deploying.sitemap({ work, urls: SitemapUrls({}) })),
);

export const PreparedSitemapsBegin = reaction(({ work, producer }) =>
  when(Deploying.sitemap({ work }).responds({}))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunSitemapsIntend = reaction(({ producer, attempt, work, path, content }) =>
  when(Emitting.begin({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "sitemap" }),
      earlier(Deploying.sitemap, { work }, { path, content }),
    )
    .then(Emitting.intend({ producer, attempt, path, content, medium: "application/xml" })),
);

export const FeedWorkPrepares = reaction(({ deployment, work, collectionName, catalog, site }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "feed", collection: collectionName }),
      Cataloging._named({ name: collectionName }).is({ catalog }),
      Governing._site({}).is({ site }),
    )
    .then(Deploying.feed({ work, site, entries: CatalogEntries({ catalog }) })),
);

export const MissingFeedCollectionsDiagnose = reaction(({ deployment, work, collectionName }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "feed", collection: collectionName }),
      no(Cataloging._named({ name: collectionName })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "FEED_COLLECTION_NOT_FOUND",
      message: "Feed names no configured collection.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const OriginlessFeedsDiagnose = reaction(({ work }) =>
  when(Deploying.feed({ work }).responds({ origin: false }))
    .then(Diagnosing.report({
      severity: "error",
      code: "ORIGIN_REQUIRED",
      message: "Feed generation requires a valid site.origin.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const InvalidFeedEntriesDiagnose = reaction(({ work }) =>
  when(Deploying.feed({ work }).responds({ origin: true, valid: false }))
    .then(Diagnosing.report({
      severity: "error",
      code: "INVALID_FEED_ENTRY",
      message: "Feed entries need a routed URL and a valid data.date.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const PreparedFeedsBegin = reaction(({ work, producer }) =>
  when(Deploying.feed({ work }).responds({ origin: true, valid: true }))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunFeedsIntend = reaction(({ producer, attempt, work, path, content }) =>
  when(Emitting.begin({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "feed" }),
      earlier(Deploying.feed, { work }, { path, content, origin: true }),
    )
    .then(Emitting.intend({ producer, attempt, path, content, medium: "application/atom+xml" })),
);

/** Every successfully staged deployment artifact commits and advances the queue. */
export const IntendedDeploymentArtifactsCommit = reaction(({ producer, attempt }) =>
  when(Emitting.intend({ producer, attempt }).responds({}))
    .where(
      CommittableDeploymentWork({ producer }),
      Emitting._open({ producer }).is({ attempt }),
    )
    .then(Emitting.commit({ producer, attempt })),
);

export const CommittedDeploymentArtifactsComplete = reaction(({ producer, attempt, work }) =>
  when(Emitting.commit({ producer, attempt }).responds({}))
    .where(
      CommittableDeploymentWork({ producer }).is({ work }),
      Emitting._attempt({ producer }).is({ attempt }),
    )
    .then(Deploying.complete({ work })),
);

export const GeneratedRouteCollisionsDiagnose = reaction(({ owner, detail }) =>
  when(Routing.claim({ owner }).refuses({ error: "ADDRESS_TAKEN", detail }))
    .where(Deploying._forOwner({ owner }))
    .then(Diagnosing.report({ severity: "error", code: "ROUTE_COLLISION", message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwner({ owner })),
);

export const InvalidGeneratedRoutesDiagnose = reaction(({ owner, detail }) =>
  when(Routing.claim({ owner }).refuses({ error: "INVALID_ADDRESS", detail }))
    .where(Deploying._forOwner({ owner }))
    .then(Diagnosing.report({ severity: "error", code: "INVALID_ADDRESS", message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwner({ owner })),
);

export const DeploymentBeginFailuresDiagnose = reaction(({ producer, work, error, detail }) =>
  when(Emitting.begin({ producer }).refuses({ error, detail }))
    .where(CommittableDeploymentWork({ producer }).is({ work }))
    .then(Deploying.reject({ work }).responds({}))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);

export const DeploymentIntentFailuresFailAndAbort = reaction(({ producer, attempt, path, error, detail }) =>
  when(Emitting.intend({ producer, attempt, path }).refuses({ error, detail }))
    .where(
      CommittableDeploymentWork({ producer }),
      Emitting._open({ producer }).is({ attempt }),
    )
    .then(Deploying.fail({ producer, path, code: error, detail }).responds({}))
    .then(Emitting.abort({ producer, attempt })),
);

/** Failure state is durable before diagnostics, so interrupted reporting cannot publish. */
export const DescribedDeploymentOutputFailuresDiagnose = reaction(({ path, code, message }) =>
  when(Deploying.fail({ path }).responds({ code, message })).then(
    Diagnosing.report({
      severity: "error",
      code,
      message,
      source: CONFIGURATION_PATH,
    }),
  ),
);

export const DeploymentOutputFailuresRelateProducers = reaction(({ diagnostic, path, producer }) =>
  when(Diagnosing.report({ code: "PATH_CONTESTED" }).responds({ diagnostic }))
    .where(
      earlier(Deploying.fail, {}, { path }),
      Emitting._producers({ path }).is({ producer }),
    )
    .then(Diagnosing.relate({
      diagnostic,
      source: producer,
      note: "Competing output producer.",
    })),
);

export const DeploymentCommitFailuresDiagnose = reaction(({ producer, attempt, work, error, detail }) =>
  when(Emitting.commit({ producer, attempt }).refuses({ error, detail }))
    .where(
      CommittableDeploymentWork({ producer }).is({ work }),
      Emitting._open({ producer }).is({ attempt }),
    )
    .then(Deploying.reject({ work }).responds({}))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
