import { earlier, each, former, no, reaction, view, when, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { TRUSTED_COLLECTION_EXCERPTS } from "../concepts/templating/templating.ts";
import { CONFIGURATION_PATH, CONTEXT_PATHS, PARTS, PATHS } from "./shared.ts";

const {
  Collecting,
  Configuring,
  Depending,
  Deploying,
  Diagnosing,
  Emitting,
  Governing,
  Phasing,
  Referencing,
  Routing,
  Templating,
} = concepts;

const DEPLOYMENT_LAYOUT = "deployment-layout";

const CollectionEntries = former(
  "the deployment entries of collection (collection)",
  ({ collection }, { item, card }) =>
    each(Collecting._items({ collection }).is({ item, card })).form({ item, card }),
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

const SitemapUrls = former(
  "the sitemap urls",
  (_inputs, { owner, address, url }) =>
    each(SitemapPage({}).is({ owner, address, url })).form({ url }),
);

/** Start a finite deployment queue as part of the emit phase itself. */
export const EmittingStartsDeployment = reaction(({ policy }) =>
  when(Phasing.advance({}).responds({ phase: "emit" }))
    .where(Governing._publishing({}).is({ policy }))
    .then(Deploying.start({ policy })),
);

export const StartedDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.start({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const CompletedDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.complete({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const CompletedOwnerDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.completeOwner({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const CompletedProducerDeploymentsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.completeProducer({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

export const DividedPaginationsDispatch = reaction(({ deployment, work }) =>
  when(Deploying.divide({}).responds({ deployment, work })).then(Deploying.dispatch({ deployment, work })),
);

/** A required not-found page must be authored before generated routes are claimed. */
export const MissingRequiredNotFoundPagesDiagnose = reaction(() =>
  when(Phasing.advance({}).responds({ phase: "emit" }))
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

export const BegunNojekyllWorkIntends = reaction(({ producer, path }) =>
  when(Emitting.begin({ producer }).responds({}))
    .where(
      Deploying._forProducer({ producer }).is({ kind: "nojekyll", path }),
    )
    .then(Emitting.intend({ producer, path, content: "", medium: "text/plain" })),
);

/** Redirect and pagination routes are claimed in queue order. */
export const RoutedDeploymentWorkClaims = reaction(({ deployment, work, owner, address }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "redirect", owner, from: address }),
    )
    .then(Routing.claim({ owner, address })),
);

export const PaginationPageWorkClaims = reaction(({ deployment, work, owner, address }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(Deploying._work({ work }).is({ kind: "pagination-page", owner, address }))
    .then(Routing.claim({ owner, address })),
);

/** Successful generated claims retain the same inspection provenance as before. */
export const GeneratedClaimsBeginDependencies = reaction(({ owner }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(Depending.begin({ subject: owner })),
);

export const GeneratedDependenciesTrackConfiguration = reaction(({ owner }) =>
  when(Depending.begin({ subject: owner }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(Depending.use({ subject: owner, input: CONFIGURATION_PATH })),
);

export const GeneratedDependenciesSettle = reaction(({ owner }) =>
  when(Depending.use({ subject: owner, input: CONFIGURATION_PATH }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(Depending.settle({ subject: owner })),
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
      Routing._classify({ target }).is({ kind: "external" }),
    )
    .then(Deploying.redirect({ work, target, canonical: target })),
);

export const RenderedRedirectsBegin = reaction(({ work, producer }) =>
  when(Deploying.redirect({ work }).responds({}))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunRedirectsIntend = reaction(({ producer, work, address, path, content }) =>
  when(Emitting.begin({ producer }).responds({}))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "redirect", from: address }),
      Routing._file({ address }).is({ path }),
      earlier(Deploying.redirect, { work }, { content }),
    )
    .then(Emitting.intend({ producer, path, content, medium: "text/plain" })),
);

/** Resolve a pagination plan before replacing it with page work. */
export const PaginationPlansDivide = reaction(({ deployment, work, collectionName, collection, templateName, template }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName, templateName }),
      Collecting._named({ name: collectionName }).is({ collection }),
      Templating._template({ name: templateName }).is({ template }),
    )
    .then(Deploying.divide({ deployment, work, template, entries: CollectionEntries({ collection }) })),
);

export const MissingPaginationCollectionsDiagnose = reaction(({ deployment, work, collectionName }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName }),
      no(Collecting._named({ name: collectionName })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "PAGINATION_COLLECTION_NOT_FOUND",
      message: "A pagination rule names no configured collection.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.complete({ work })),
);

export const MissingPaginationTemplatesDiagnose = reaction(({ deployment, work, collectionName, templateName }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName, templateName }),
      Collecting._named({ name: collectionName }),
      no(Templating._template({ name: templateName })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "TEMPLATE_NOT_FOUND",
      message: "A pagination rule selects an undefined template.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.complete({ work })),
);

export const ClaimedPaginationPagesFormContext = reaction(
  ({ owner, work, configuration, site, collections, address, canonicalUrl }) =>
    when(Routing.claim({ owner }).responds({}))
      .where(
        Deploying._forOwner({ owner }).is({ work, kind: "pagination-page", address }),
        Configuring._active({}).is({ root: configuration }),
        Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
        Collecting._catalog({}).is({ collections }),
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
      trusted: [CONTEXT_PATHS.pageContent, TRUSTED_COLLECTION_EXCERPTS],
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
      Routing._classify({ target: raw }).is({ kind: "absolute" }),
      Routing._url({ target: raw }).is({ url }),
    )
    .then(Referencing.answer({ reference, form: "address", value: url })),
);

export const NonlocalDeploymentLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "external" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

export const FragmentDeploymentLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "fragment" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

export const UnprojectableDeploymentLayoutReferencesDiagnose = reaction(({ source, owner, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: owner }),
      Deploying._forOwner({ owner }),
      Referencing._references({ source }).is({ raw }),
      Routing._classify({ target: raw }).is({ kind: "absolute" }),
      no(Routing._url({ target: raw })),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_LOCAL_REFERENCE",
        message: "A generated layout reference could not be projected.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
    ),
);

export const InvalidDeploymentLayoutReferencesDiagnose = reaction(({ source, owner, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: owner }),
      Deploying._forOwner({ owner }),
      Referencing._references({ source }).is({ raw }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "RELATIVE_LAYOUT_REFERENCE",
        message: "A generated layout reference must be site-absolute, external, or fragment-only.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
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

export const BegunPaginationPagesIntend = reaction(({ producer, address, path, text }) =>
  when(Emitting.begin({ producer }).responds({}))
    .where(
      Deploying._forProducer({ producer }).is({ kind: "pagination-page", address }),
      Routing._file({ address }).is({ path }),
      Referencing._finished({ subject: producer, part: DEPLOYMENT_LAYOUT }).is({ text }),
    )
    .then(Emitting.intend({ producer, path, content: text, medium: "text/plain" })),
);

export const PaginationTemplateFailuresDiagnose = reaction(({ owner, error, detail }) =>
  when(Templating.render({ subject: owner }).refuses({ error, detail }))
    .where(Deploying._forOwner({ owner }).is({ kind: "pagination-page" }))
    .then(
      Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
    ),
);

export const DeploymentReferenceScanFailuresDiagnose = reaction(({ owner, error, detail }) =>
  when(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT }).refuses({ error, detail }))
    .where(Deploying._forOwner({ owner }))
    .then(
      Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
    ),
);

export const DeploymentReferenceAnswerFailuresDiagnose = reaction(({ reference, error, detail, source, owner }) =>
  when(Referencing.answer({ reference }).refuses({ error, detail }))
    .where(
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: owner, part: DEPLOYMENT_LAYOUT }),
      Deploying._forOwner({ owner }),
    )
    .then(
      Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
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

export const BegunSitemapsIntend = reaction(({ producer, work, path, content }) =>
  when(Emitting.begin({ producer }).responds({}))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "sitemap" }),
      earlier(Deploying.sitemap, { work }, { path, content }),
    )
    .then(Emitting.intend({ producer, path, content, medium: "text/plain" })),
);

export const FeedWorkPrepares = reaction(({ deployment, work, collectionName, collection, configuration, site }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "feed", collection: collectionName }),
      Collecting._named({ name: collectionName }).is({ collection }),
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({ node: configuration, path: PATHS.site, otherwise: {} }).is({ values: site }),
    )
    .then(Deploying.feed({ work, site, entries: CollectionEntries({ collection }) })),
);

export const MissingFeedCollectionsDiagnose = reaction(({ deployment, work, collectionName }) =>
  when(Deploying.dispatch({ deployment, work }).responds({}))
    .where(
      Deploying._work({ work }).is({ kind: "feed", collection: collectionName }),
      no(Collecting._named({ name: collectionName })),
    )
    .then(Diagnosing.report({
      severity: "error",
      code: "FEED_COLLECTION_NOT_FOUND",
      message: "Feed names no configured collection.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.complete({ work })),
);

export const OriginlessFeedsDiagnose = reaction(({ work }) =>
  when(Deploying.feed({ work }).responds({ origin: false }))
    .then(
      Diagnosing.report({
        severity: "error",
        code: "ORIGIN_REQUIRED",
        message: "Feed generation requires a valid site.origin.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.complete({ work }).named("continue"),
    ),
);

export const InvalidFeedEntriesDiagnose = reaction(({ work }) =>
  when(Deploying.feed({ work }).responds({ origin: true, valid: false })).then(
    Diagnosing.report({
      severity: "error",
      code: "INVALID_FEED_ENTRY",
      message: "Feed entries need a routed URL and a valid data.date.",
      source: CONFIGURATION_PATH,
    }),
  ),
);

export const PreparedFeedsBegin = reaction(({ work, producer }) =>
  when(Deploying.feed({ work }).responds({ origin: true }))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.begin({ producer })),
);

export const BegunFeedsIntend = reaction(({ producer, work, path, content }) =>
  when(Emitting.begin({ producer }).responds({}))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "feed" }),
      earlier(Deploying.feed, { work }, { path, content, origin: true }),
    )
    .then(Emitting.intend({ producer, path, content, medium: "text/plain" })),
);

/** Every successfully staged deployment artifact commits and advances the queue. */
export const IntendedDeploymentArtifactsCommit = reaction(({ producer }) =>
  when(Emitting.intend({ producer }).responds({}))
    .where(Deploying._forProducer({ producer }))
    .then(Emitting.commit({ producer })),
);

export const CommittedDeploymentArtifactsComplete = reaction(({ producer, work }) =>
  when(Emitting.commit({ producer }).responds({}))
    .where(Deploying._forProducer({ producer }).is({ work }))
    .then(Deploying.complete({ work })),
);

export const GeneratedRouteCollisionsDiagnose = reaction(({ owner, detail }) =>
  when(Routing.claim({ owner }).refuses({ error: "ADDRESS_TAKEN", detail }))
    .where(Deploying._forOwner({ owner }))
    .then(
      Diagnosing.report({ severity: "error", code: "ROUTE_COLLISION", message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
    ),
);

export const InvalidGeneratedRoutesDiagnose = reaction(({ owner, detail }) =>
  when(Routing.claim({ owner }).refuses({ error: "INVALID_ADDRESS", detail }))
    .where(Deploying._forOwner({ owner }))
    .then(
      Diagnosing.report({ severity: "error", code: "INVALID_ADDRESS", message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeOwner({ owner }).named("continue"),
    ),
);

export const DeploymentBeginFailuresDiagnose = reaction(({ producer, error, detail }) =>
  when(Emitting.begin({ producer }).refuses({ error, detail }))
    .where(Deploying._forProducer({ producer }))
    .then(
      Diagnosing.report({ severity: "error", code: "OUTPUT_COLLISION", message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeProducer({ producer }).named("continue"),
    ),
);

export const DeploymentIntentFailuresDiagnose = reaction(({ producer, path, error, detail }) =>
  when(Emitting.intend({ producer, path }).refuses({ error, detail }))
    .where(Deploying._forProducer({ producer }))
    .then(
      Deploying.outputFailure({ path, detail }).named("describe"),
      Emitting.abort({ producer }).named("abort"),
      Deploying.completeProducer({ producer }).named("continue"),
    ),
);

export const DescribedDeploymentOutputFailuresDiagnose = reaction(({ path, message }) =>
  when(Deploying.outputFailure({ path }).responds({ message })).then(
    Diagnosing.report({
      severity: "error",
      code: "OUTPUT_COLLISION",
      message,
      source: CONFIGURATION_PATH,
    }),
  ),
);

export const DeploymentOutputFailuresRelateProducers = reaction(({ diagnostic, path, producer }) =>
  when(Diagnosing.report({ code: "OUTPUT_COLLISION" }).responds({ diagnostic }))
    .where(
      earlier(Deploying.outputFailure, {}, { path }),
      Emitting._producers({ path }).is({ producer }),
    )
    .then(Diagnosing.relate({
      diagnostic,
      source: producer,
      note: "Competing output producer.",
    })),
);

export const DeploymentCommitFailuresDiagnose = reaction(({ producer, error, detail }) =>
  when(Emitting.commit({ producer }).refuses({ error, detail }))
    .where(Deploying._forProducer({ producer }))
    .then(
      Diagnosing.report({ severity: "error", code: "OUTPUT_COLLISION", message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.completeProducer({ producer }).named("continue"),
    ),
);
