import { compute, earlier, each, former, no, reaction, returned, view, when, where, whether } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concepts";
import { AbsoluteSiteUrl, AddressOutputPath, SiteUrl } from "./calculations.ts";
import { CONFIGURATION_PATH, PAGE_CONTENT_PATH, PHASE_SEQUENCE, TRUSTED_COLLECTION_EXCERPTS } from "./shared.ts";

const {
  Cataloging,
  DependencyTracking,
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

const ActivatedDeploymentWork = view(
  "active deployment work returned by queue transition (action, result)",
  ({ action, result }, { work }) => where(
    compute(computations.deploymentTransitionWork, { action, result }, work),
    computations.isTextValue({ value: work }),
    Deploying._work({ work }).is({ status: "active" }),
  ),
).optional();

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
      AbsoluteSiteUrl({ address }).is({ url }),
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
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "emit", transitioned: true }))
    .where(Governing._publishing({}).is({ policy }))
    .then(Deploying.start({ policy })),
);

/** A required not-found page must be authored before generated routes are claimed. */
export const MissingRequiredNotFoundPagesDiagnose = reaction(() =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "emit", transitioned: true }))
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

export const ActivatedNojekyllWorkBegins = reaction(({ action, result, work, producer }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      Deploying._work({ work }).is({ kind: "nojekyll", producer }),
    )
    .then(Emitting.beginAttempt({ producer })),
);

export const BegunNojekyllWorkIntends = reaction(({ producer, attempt, path }) =>
  when(Emitting.beginAttempt({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ kind: "nojekyll", path }),
    )
    .then(Emitting.intend({ producer, attempt, path, content: "", medium: "text/plain" })),
);

/** Redirect and pagination routes are claimed in queue order. */
export const ActivatedRoutedDeploymentWorkClaims = reaction(({ action, result, work, owner, address }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      RoutedDeploymentWork({ work }).is({ owner, address }),
    )
    .then(Routing.claim({ owner, address })),
);

/** Successful generated claims retain the same inspection provenance as before. */
export const GeneratedClaimsBeginDependencies = reaction(({ owner }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(DependencyTracking.beginAttempt({ subject: owner })),
);

export const GeneratedDependenciesTrackConfiguration = reaction(({ owner, attempt }) =>
  when(DependencyTracking.beginAttempt({ subject: owner }).responds({ attempt }))
    .where(Deploying._forOwner({ owner }))
    .then(DependencyTracking.recordDependency({ subject: owner, attempt, input: CONFIGURATION_PATH })),
);

export const GeneratedDependenciesSettle = reaction(({ owner, attempt }) =>
  when(DependencyTracking.recordDependency({ subject: owner, attempt, input: CONFIGURATION_PATH }).responds({}))
    .where(Deploying._forOwner({ owner }))
    .then(DependencyTracking.settleAttempt({ subject: owner, attempt })),
);

/** Local redirect targets use routing projection and canonical origin when available. */
export const ClaimedLocalRedirectsPrepare = reaction(({ owner, work, raw, target, canonical, content }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(
      Deploying._forOwner({ owner }).is({ work, kind: "redirect", to: raw }),
      SiteUrl({ target: raw }).is({ url: target }),
      AbsoluteSiteUrl({ address: raw }).is({ url: canonical }),
      compute(computations.deploymentRedirectDocument, { target, canonical }, content),
    )
    .then(Deploying.prepareRedirect({ work, target, canonical, content })),
);

export const ClaimedUnoriginatedRedirectsPrepare = reaction(({ owner, work, raw, target, content }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(
      Deploying._forOwner({ owner }).is({ work, kind: "redirect", to: raw }),
      SiteUrl({ target: raw }).is({ url: target }),
      no(AbsoluteSiteUrl({ address: raw })),
      compute(computations.deploymentRedirectDocument, { target, canonical: target }, content),
    )
    .then(Deploying.prepareRedirect({ work, target, canonical: target, content })),
);

export const ClaimedExternalRedirectsPrepare = reaction(({ owner, work, target, content }) =>
  when(Routing.claim({ owner }).responds({}))
    .where(
      Deploying._forOwner({ owner }).is({ work, kind: "redirect", to: target }),
      computations.targetHasKind({ target, kind: "external" }),
      compute(computations.deploymentRedirectDocument, { target, canonical: target }, content),
    )
    .then(Deploying.prepareRedirect({ work, target, canonical: target, content })),
);

export const PreparedRedirectsBegin = reaction(({ work, producer }) =>
  when(Deploying.prepareRedirect({ work }).responds({}))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.beginAttempt({ producer })),
);

export const BegunRedirectsIntend = reaction(({ producer, attempt, work, address, path, content }) =>
  when(Emitting.beginAttempt({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "redirect", from: address }),
      AddressOutputPath({ address }).is({ path }),
      earlier(Deploying.prepareRedirect, { work }, { content }),
    )
    .then(Emitting.intend({ producer, attempt, path, content, medium: "text/html" })),
);

/** Resolve a pagination plan before replacing it with page work. */
export const ActivatedPaginationPlansDivide = reaction(({ action, result, deployment, work, collectionName, catalog, templateName, template }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      Deploying._work({ work }).is({ deployment, kind: "pagination-plan", collection: collectionName, templateName }),
      Cataloging._named({ name: collectionName }).is({ catalog }),
      Templating._template({ name: templateName }).is({ template }),
    )
    .then(Deploying.expandPagination({ deployment, work, template, entries: CatalogEntries({ catalog }) })),
);

export const ActivatedPaginationPlansWithoutCollectionsDiagnose = reaction(({ action, result, work, collectionName }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName }),
      no(Cataloging._named({ name: collectionName })),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "PAGINATION_COLLECTION_NOT_FOUND",
        message: "A pagination rule names no configured collection.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.reject({ work }).named("reject"),
    ),
);

export const ActivatedPaginationPlansWithoutTemplatesDiagnose = reaction(({ action, result, work, collectionName, templateName }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      Deploying._work({ work }).is({ kind: "pagination-plan", collection: collectionName, templateName }),
      Cataloging._named({ name: collectionName }),
      no(Templating._template({ name: templateName })),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "TEMPLATE_NOT_FOUND",
        message: "A pagination rule selects an undefined template.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.reject({ work }).named("reject"),
    ),
);

export const ClaimedPaginationPagesPrepareContext = reaction(
  ({ owner, work, site, collections, address, canonicalUrl, sourcePath, title, collection, number, pages, cards, previous, next, context }) =>
    when(Routing.claim({ owner }).responds({}))
      .where(
        Deploying._forOwner({ owner }).is({
          work,
          kind: "pagination-page",
          address,
          sourcePath,
          title,
          collection,
          number,
          pages,
          cards,
          previous,
          next,
        }),
        Governing._site({}).is({ site }),
        Cataloging._record({}).is({ catalogs: collections }),
        whether(AbsoluteSiteUrl({ address }).is({ url: canonicalUrl })),
        compute(computations.deploymentPaginationContext, {
          site,
          collections,
          address,
          canonicalUrl,
          sourcePath,
          title,
          collection,
          number,
          pages,
          cards,
          previous,
          next,
        }, context),
      )
    .then(Deploying.preparePageContext({ work, context })),
);

export const PaginationContextsRender = reaction(({ work, owner, template, context }) =>
  when(Deploying.preparePageContext({ work }).responds({ owner, template, context })).then(
    Templating.renderTemplate({
      template,
      subject: owner,
      context,
      trusted: [PAGE_CONTENT_PATH, TRUSTED_COLLECTION_EXCERPTS],
    }),
  ),
);

export const RenderedPaginationLayoutsScan = reaction(({ owner, output }) =>
  when(Templating.renderTemplate({ subject: owner }).responds({ output }))
    .where(Deploying._forOwner({ owner }).is({ kind: "pagination-page" }))
    .then(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT, text: output })),
);

export const AbsoluteDeploymentLayoutReferencesRebase = reaction(({ source, reference, raw, url }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      computations.targetHasKind({ target: raw, kind: "absolute" }),
      SiteUrl({ target: raw }).is({ url }),
    )
    .then(Referencing.resolve({ reference, form: "address", value: url })),
);

export const NonlocalDeploymentLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: DEPLOYMENT_LAYOUT }).responds({ source }))
    .where(HeldDeploymentLayoutReference({ source }).is({ reference, raw }))
    .then(Referencing.resolve({ reference, form: "address", value: raw })),
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
      no(SiteUrl({ target: raw })),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_LOCAL_REFERENCE",
        message: "A generated layout reference could not be projected.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.rejectOwnerWork({ owner }).named("reject"),
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
      Deploying.rejectOwnerWork({ owner }).named("reject"),
    ),
);

export const EmptyPaginationLayoutScansBegin = reaction(({ owner, producer }) =>
  when(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT }).responds({ completed: true }))
    .where(Deploying._forOwner({ owner }).is({ producer }))
    .then(Emitting.beginAttempt({ producer })),
);

export const FinishedPaginationLayoutAnswersBegin = reaction(({ owner, producer }) =>
  when(Referencing.resolve({}).responds({ subject: owner, part: DEPLOYMENT_LAYOUT, completed: true }))
    .where(Deploying._forOwner({ owner }).is({ producer }))
    .then(Emitting.beginAttempt({ producer })),
);

export const BegunPaginationPagesIntend = reaction(({ producer, attempt, address, path, text }) =>
  when(Emitting.beginAttempt({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ kind: "pagination-page", address }),
      AddressOutputPath({ address }).is({ path }),
      Referencing._finished({ subject: producer, part: DEPLOYMENT_LAYOUT }).is({ text }),
    )
    .then(Emitting.intend({ producer, attempt, path, content: text, medium: "text/html" })),
);

export const PaginationTemplateFailuresDiagnose = reaction(({ owner, error, detail }) =>
  when(Templating.renderTemplate({ subject: owner }).refuses({ error, detail }))
    .where(Deploying._forOwner({ owner }).is({ kind: "pagination-page" }))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwnerWork({ owner })),
);

export const DeploymentReferenceScanFailuresDiagnose = reaction(({ owner, error, detail }) =>
  when(Referencing.scan({ subject: owner, part: DEPLOYMENT_LAYOUT }).refuses({ error, detail }))
    .where(Deploying._forOwner({ owner }))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwnerWork({ owner })),
);

// This owner is also discovered by a state read, so the same non-publishable
// partial-failure rule used above applies.
export const DeploymentReferenceAnswerFailuresDiagnose = reaction(({ reference, error, detail, source, owner }) =>
  when(Referencing.resolve({ reference }).refuses({ error, detail }))
    .where(
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: owner, part: DEPLOYMENT_LAYOUT }),
      Deploying._forOwner({ owner }),
    )
    .then(
      Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH }).named("diagnose"),
      Deploying.rejectOwnerWork({ owner }).named("reject"),
    ),
);

/** Sitemap and feed snapshots are formed only after all earlier route work has completed. */
export const ActivatedSitemapWorkSnapshotsUrls = reaction(({ action, result, work }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      Deploying._work({ work }).is({ kind: "sitemap" }),
    )
    .then(Deploying.snapshotSitemap({ work, urls: SitemapUrls({}) })),
);

export const SnapshottedSitemapUrlsPrepare = reaction(({ work, urls, content }) =>
  when(Deploying.snapshotSitemap({ work }).responds({ urls }))
    .where(compute(computations.deploymentSitemapDocument, { urls }, content))
    .then(Deploying.prepareSitemap({ work, content })),
);

export const PreparedSitemapsBegin = reaction(({ work, producer }) =>
  when(Deploying.prepareSitemap({ work }).responds({}))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.beginAttempt({ producer })),
);

export const BegunSitemapsIntend = reaction(({ producer, attempt, work, path, content }) =>
  when(Emitting.beginAttempt({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "sitemap" }),
      earlier(Deploying.prepareSitemap, { work }, { path, content }),
    )
    .then(Emitting.intend({ producer, attempt, path, content, medium: "application/xml" })),
);

export const ActivatedFeedWorkSnapshotsInputs = reaction(
  ({ action, result, work, collectionName, catalog, site }) =>
    when(returned({ concept: "Deploying", action, result }))
      .where(
        ActivatedDeploymentWork({ action, result }).is({ work }),
        Deploying._work({ work }).is({ kind: "feed", collection: collectionName }),
        Cataloging._named({ name: collectionName }).is({ catalog }),
        Governing._site({}).is({ site }),
      )
      .then(Deploying.snapshotFeed({ work, site, entries: CatalogEntries({ catalog }) })),
);

export const SnapshottedFeedInputsPrepare = reaction(
  ({ work, path, title, description, site, entries, preparation }) =>
    when(Deploying.snapshotFeed({ work }).responds({ path, title, description, site, entries }))
      .where(compute(computations.deploymentFeedPreparation, { path, title, description, site, entries }, preparation))
      .then(Deploying.prepareFeed({ work, preparation })),
);

export const ActivatedFeedsWithoutCollectionsDiagnose = reaction(({ action, result, work, collectionName }) =>
  when(returned({ concept: "Deploying", action, result }))
    .where(
      ActivatedDeploymentWork({ action, result }).is({ work }),
      Deploying._work({ work }).is({ kind: "feed", collection: collectionName }),
      no(Cataloging._named({ name: collectionName })),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "FEED_COLLECTION_NOT_FOUND",
        message: "Feed names no configured collection.",
        source: CONFIGURATION_PATH,
      }).named("diagnose"),
      Deploying.reject({ work }).named("reject"),
    ),
);

export const OriginlessFeedsDiagnose = reaction(({ work }) =>
  when(Deploying.prepareFeed({ work }).responds({ origin: false }))
    .then(Diagnosing.report({
      severity: "error",
      code: "ORIGIN_REQUIRED",
      message: "Feed generation requires a valid site.origin.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const InvalidFeedEntriesDiagnose = reaction(({ work }) =>
  when(Deploying.prepareFeed({ work }).responds({ origin: true, valid: false }))
    .then(Diagnosing.report({
      severity: "error",
      code: "INVALID_FEED_ENTRY",
      message: "Feed entries need a routed URL and a valid data.date.",
      source: CONFIGURATION_PATH,
    }).responds({}))
    .then(Deploying.reject({ work })),
);

export const PreparedFeedsBegin = reaction(({ work, producer }) =>
  when(Deploying.prepareFeed({ work }).responds({ origin: true, valid: true }))
    .where(Deploying._work({ work }).is({ producer }))
    .then(Emitting.beginAttempt({ producer })),
);

export const BegunFeedsIntend = reaction(({ producer, attempt, work, path, content }) =>
  when(Emitting.beginAttempt({ producer }).responds({ attempt }))
    .where(
      Deploying._forProducer({ producer }).is({ work, kind: "feed" }),
      earlier(Deploying.prepareFeed, { work }, { path, content, origin: true }),
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
    .then(Emitting.commitAttempt({ producer, attempt })),
);

export const CommittedDeploymentArtifactsComplete = reaction(({ producer, attempt, work }) =>
  when(Emitting.commitAttempt({ producer, attempt }).responds({}))
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
    .then(Deploying.rejectOwnerWork({ owner })),
);

export const InvalidGeneratedRoutesDiagnose = reaction(({ owner, detail }) =>
  when(Routing.claim({ owner }).refuses({ error: "INVALID_ADDRESS", detail }))
    .where(Deploying._forOwner({ owner }))
    .then(Diagnosing.report({ severity: "error", code: "INVALID_ADDRESS", message: detail, source: CONFIGURATION_PATH }).responds({}))
    .then(Deploying.rejectOwnerWork({ owner })),
);

export const DeploymentBeginFailuresDiagnose = reaction(({ producer, work, error, detail }) =>
  when(Emitting.beginAttempt({ producer }).refuses({ error, detail }))
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
    .then(Deploying.failWork({ producer, path, code: error, detail }).responds({}))
    .then(Emitting.abortAttempt({ producer, attempt })),
);

/** Failure state is durable before diagnostics, so interrupted reporting cannot publish. */
export const DescribedDeploymentOutputFailuresDiagnose = reaction(({ path, code, message }) =>
  when(Deploying.failWork({ path }).responds({ code, message })).then(
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
      earlier(Deploying.failWork, {}, { path }),
      Emitting._producers({ path }).is({ producer }),
    )
    .then(Diagnosing.addRelatedLocation({
      diagnostic,
      source: producer,
      note: "Competing output producer.",
    })),
);

export const DeploymentCommitFailuresDiagnose = reaction(({ producer, attempt, work, error, detail }) =>
  when(Emitting.commitAttempt({ producer, attempt }).refuses({ error, detail }))
    .where(
      CommittableDeploymentWork({ producer }).is({ work }),
      Emitting._open({ producer }).is({ attempt }),
    )
    .then(Deploying.reject({ work }).responds({}))
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: CONFIGURATION_PATH })),
);
