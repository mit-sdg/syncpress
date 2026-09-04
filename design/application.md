# Syncpress application composition

Syncpress composes its concept instances into complete build, inspect, watch,
development-server, and command-line flows. The declarations below inventory
those executable decisions. Each linked reaction advances or diagnoses one
step of those flows; each view and former derives the named reusable read model.

> **TODO:** Replace this declaration inventory with proper responsibility-focused
> composition documents that explain the application decisions beside their typed links.

## Reactions
- [CatalogIndexFailuresDiagnose](reaction:fullSite.collections.CatalogIndexFailuresDiagnose)
- [CollectPhaseIndexesPages](reaction:fullSite.collections.CollectPhaseIndexesPages)
- [AnnounceMisuse](reaction:fullSite.commanding.AnnounceMisuse)
- [AnnounceUsage](reaction:fullSite.commanding.AnnounceUsage)
- [HoldUntilStopped](reaction:fullSite.commanding.HoldUntilStopped)
- [InterpretCommandLine](reaction:fullSite.commanding.InterpretCommandLine)
- [SetCommandLineExit](reaction:fullSite.commanding.SetCommandLineExit)
- [WriteCommandLine](reaction:fullSite.commanding.WriteCommandLine)
- [AbsoluteDeploymentLayoutReferencesRebase](reaction:fullSite.deployment.AbsoluteDeploymentLayoutReferencesRebase)
- [ActivatedFeedWorkSnapshotsInputs](reaction:fullSite.deployment.ActivatedFeedWorkSnapshotsInputs)
- [ActivatedFeedsWithoutCollectionsDiagnose](reaction:fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose)
- [ActivatedNojekyllWorkBegins](reaction:fullSite.deployment.ActivatedNojekyllWorkBegins)
- [ActivatedPaginationPlansDivide](reaction:fullSite.deployment.ActivatedPaginationPlansDivide)
- [ActivatedPaginationPlansWithoutCollectionsDiagnose](reaction:fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose)
- [ActivatedPaginationPlansWithoutTemplatesDiagnose](reaction:fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose)
- [ActivatedRoutedDeploymentWorkClaims](reaction:fullSite.deployment.ActivatedRoutedDeploymentWorkClaims)
- [ActivatedSitemapWorkSnapshotsUrls](reaction:fullSite.deployment.ActivatedSitemapWorkSnapshotsUrls)
- [BegunFeedsIntend](reaction:fullSite.deployment.BegunFeedsIntend)
- [BegunNojekyllWorkIntends](reaction:fullSite.deployment.BegunNojekyllWorkIntends)
- [BegunPaginationPagesIntend](reaction:fullSite.deployment.BegunPaginationPagesIntend)
- [BegunRedirectsIntend](reaction:fullSite.deployment.BegunRedirectsIntend)
- [BegunSitemapsIntend](reaction:fullSite.deployment.BegunSitemapsIntend)
- [ClaimedExternalRedirectsPrepare](reaction:fullSite.deployment.ClaimedExternalRedirectsPrepare)
- [ClaimedLocalRedirectsPrepare](reaction:fullSite.deployment.ClaimedLocalRedirectsPrepare)
- [ClaimedPaginationPagesPrepareContext](reaction:fullSite.deployment.ClaimedPaginationPagesPrepareContext)
- [ClaimedUnoriginatedRedirectsPrepare](reaction:fullSite.deployment.ClaimedUnoriginatedRedirectsPrepare)
- [CommittedDeploymentArtifactsComplete](reaction:fullSite.deployment.CommittedDeploymentArtifactsComplete)
- [DeploymentBeginFailuresDiagnose](reaction:fullSite.deployment.DeploymentBeginFailuresDiagnose)
- [DeploymentCommitFailuresDiagnose](reaction:fullSite.deployment.DeploymentCommitFailuresDiagnose)
- [DeploymentIntentFailuresFailAndAbort](reaction:fullSite.deployment.DeploymentIntentFailuresFailAndAbort)
- [DeploymentOutputFailuresRelateProducers](reaction:fullSite.deployment.DeploymentOutputFailuresRelateProducers)
- [DeploymentReferenceAnswerFailuresDiagnose](reaction:fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose)
- [DeploymentReferenceScanFailuresDiagnose](reaction:fullSite.deployment.DeploymentReferenceScanFailuresDiagnose)
- [DescribedDeploymentOutputFailuresDiagnose](reaction:fullSite.deployment.DescribedDeploymentOutputFailuresDiagnose)
- [EmitPhaseStartsDeployment](reaction:fullSite.deployment.EmitPhaseStartsDeployment)
- [EmptyPaginationLayoutScansBegin](reaction:fullSite.deployment.EmptyPaginationLayoutScansBegin)
- [FinishedPaginationLayoutAnswersBegin](reaction:fullSite.deployment.FinishedPaginationLayoutAnswersBegin)
- [GeneratedClaimsBeginDependencies](reaction:fullSite.deployment.GeneratedClaimsBeginDependencies)
- [GeneratedDependenciesSettle](reaction:fullSite.deployment.GeneratedDependenciesSettle)
- [GeneratedDependenciesTrackConfiguration](reaction:fullSite.deployment.GeneratedDependenciesTrackConfiguration)
- [GeneratedRouteCollisionsDiagnose](reaction:fullSite.deployment.GeneratedRouteCollisionsDiagnose)
- [IntendedDeploymentArtifactsCommit](reaction:fullSite.deployment.IntendedDeploymentArtifactsCommit)
- [InvalidDeploymentLayoutReferencesDiagnose](reaction:fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose)
- [InvalidFeedEntriesDiagnose](reaction:fullSite.deployment.InvalidFeedEntriesDiagnose)
- [InvalidGeneratedRoutesDiagnose](reaction:fullSite.deployment.InvalidGeneratedRoutesDiagnose)
- [MissingRequiredNotFoundPagesDiagnose](reaction:fullSite.deployment.MissingRequiredNotFoundPagesDiagnose)
- [NonlocalDeploymentLayoutReferencesHold](reaction:fullSite.deployment.NonlocalDeploymentLayoutReferencesHold)
- [OriginlessFeedsDiagnose](reaction:fullSite.deployment.OriginlessFeedsDiagnose)
- [PaginationContextsRender](reaction:fullSite.deployment.PaginationContextsRender)
- [PaginationTemplateFailuresDiagnose](reaction:fullSite.deployment.PaginationTemplateFailuresDiagnose)
- [PreparedFeedsBegin](reaction:fullSite.deployment.PreparedFeedsBegin)
- [PreparedRedirectsBegin](reaction:fullSite.deployment.PreparedRedirectsBegin)
- [PreparedSitemapsBegin](reaction:fullSite.deployment.PreparedSitemapsBegin)
- [RenderedPaginationLayoutsScan](reaction:fullSite.deployment.RenderedPaginationLayoutsScan)
- [SnapshottedFeedInputsPrepare](reaction:fullSite.deployment.SnapshottedFeedInputsPrepare)
- [SnapshottedSitemapUrlsPrepare](reaction:fullSite.deployment.SnapshottedSitemapUrlsPrepare)
- [UnprojectableDeploymentLayoutReferencesDiagnose](reaction:fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose)
- [AdvanceSiteBuild](reaction:fullSite.endpoints.AdvanceSiteBuild)
- [AdvanceStartedSiteBuild](reaction:fullSite.endpoints.AdvanceStartedSiteBuild)
- [BuildSiteAtConfiguredOutput](reaction:fullSite.endpoints.BuildSiteAtConfiguredOutput)
- [BuildSiteAtDestination](reaction:fullSite.endpoints.BuildSiteAtDestination)
- [InspectSite](reaction:fullSite.endpoints.InspectSite)
- [ReadSiteSummary](reaction:fullSite.endpoints.ReadSiteSummary)
- [SiteBuildFaultsInterruptAggregateDelivery](reaction:fullSite.endpoints.SiteBuildFaultsInterruptAggregateDelivery)
- [SiteBuildRefusalsInterruptAggregateDelivery](reaction:fullSite.endpoints.SiteBuildRefusalsInterruptAggregateDelivery)
- [ExcerptConversionFailuresDiagnose](reaction:fullSite.excerpts.ExcerptConversionFailuresDiagnose)
- [PageExcerptsConvert](reaction:fullSite.excerpts.PageExcerptsConvert)
- [AdmittedRasterImagesRender](reaction:fullSite.images.AdmittedRasterImagesRender)
- [CompletedEmbeddingsAnswer](reaction:fullSite.images.CompletedEmbeddingsAnswer)
- [DeclaredEmbeddingsAnswer](reaction:fullSite.images.DeclaredEmbeddingsAnswer)
- [PrimaryRasterImagesAdmit](reaction:fullSite.images.PrimaryRasterImagesAdmit)
- [RasterAdmissionsDiagnose](reaction:fullSite.images.RasterAdmissionsDiagnose)
- [RasterEmbeddingDeclarationsDiagnose](reaction:fullSite.images.RasterEmbeddingDeclarationsDiagnose)
- [RasterFallbacksDeclare](reaction:fullSite.images.RasterFallbacksDeclare)
- [RasterFallbacksStage](reaction:fullSite.images.RasterFallbacksStage)
- [RasterOffersDiagnose](reaction:fullSite.images.RasterOffersDiagnose)
- [RasterRendersDiagnose](reaction:fullSite.images.RasterRendersDiagnose)
- [RasterRenditionsOffer](reaction:fullSite.images.RasterRenditionsOffer)
- [RasterRenditionsStage](reaction:fullSite.images.RasterRenditionsStage)
- [UnretargetableRasterPrimaryImagesDiagnose](reaction:fullSite.images.UnretargetableRasterPrimaryImagesDiagnose)
- [AbsoluteLayoutReferencesRebase](reaction:fullSite.references.AbsoluteLayoutReferencesRebase)
- [ClaimedBodyReferencesRetarget](reaction:fullSite.references.ClaimedBodyReferencesRetarget)
- [CopiedBodyAssetsAnswer](reaction:fullSite.references.CopiedBodyAssetsAnswer)
- [CopyableBodyAssetsCopy](reaction:fullSite.references.CopyableBodyAssetsCopy)
- [InvalidBodyReferencesDiagnose](reaction:fullSite.references.InvalidBodyReferencesDiagnose)
- [MissingAbsoluteReferencesDiagnose](reaction:fullSite.references.MissingAbsoluteReferencesDiagnose)
- [MissingBodyReferencesDiagnose](reaction:fullSite.references.MissingBodyReferencesDiagnose)
- [MissingBodyReferencesHold](reaction:fullSite.references.MissingBodyReferencesHold)
- [NonlocalBodyReferencesHold](reaction:fullSite.references.NonlocalBodyReferencesHold)
- [NonlocalLayoutReferencesHold](reaction:fullSite.references.NonlocalLayoutReferencesHold)
- [OutsideBodyReferencesDiagnose](reaction:fullSite.references.OutsideBodyReferencesDiagnose)
- [RelativeLayoutReferencesDiagnose](reaction:fullSite.references.RelativeLayoutReferencesDiagnose)
- [UnpublishedDocumentBodyReferencesDiagnose](reaction:fullSite.references.UnpublishedDocumentBodyReferencesDiagnose)
- [UnpublishedDocumentBodyReferencesHold](reaction:fullSite.references.UnpublishedDocumentBodyReferencesHold)
- [UnretargetableClaimedBodyReferencesDiagnose](reaction:fullSite.references.UnretargetableClaimedBodyReferencesDiagnose)
- [UnretargetableCopiedBodyAssetsDiagnose](reaction:fullSite.references.UnretargetableCopiedBodyAssetsDiagnose)
- [BodyConversionFailuresDiagnose](reaction:fullSite.render.BodyConversionFailuresDiagnose)
- [BodyTemplateFailuresDiagnose](reaction:fullSite.render.BodyTemplateFailuresDiagnose)
- [BodyTemplateFailuresFailRendering](reaction:fullSite.render.BodyTemplateFailuresFailRendering)
- [ClaimedRoutesBeginPageDependencies](reaction:fullSite.render.ClaimedRoutesBeginPageDependencies)
- [CommittedPageOutputsSettleDependencies](reaction:fullSite.render.CommittedPageOutputsSettleDependencies)
- [ConvertedBodiesScan](reaction:fullSite.render.ConvertedBodiesScan)
- [EmptyBodyScansSettleRendering](reaction:fullSite.render.EmptyBodyScansSettleRendering)
- [EmptyLayoutScansSettleRendering](reaction:fullSite.render.EmptyLayoutScansSettleRendering)
- [FailedRenderingsAbandonDependencies](reaction:fullSite.render.FailedRenderingsAbandonDependencies)
- [FailedRenderingsAbortOutput](reaction:fullSite.render.FailedRenderingsAbortOutput)
- [FilledBodiesConvert](reaction:fullSite.render.FilledBodiesConvert)
- [FilledBodiesTrackTemplates](reaction:fullSite.render.FilledBodiesTrackTemplates)
- [FinishedBodyAnswersSettleRendering](reaction:fullSite.render.FinishedBodyAnswersSettleRendering)
- [FinishedLayoutAnswersSettleRendering](reaction:fullSite.render.FinishedLayoutAnswersSettleRendering)
- [IntendedPageOutputsCommit](reaction:fullSite.render.IntendedPageOutputsCommit)
- [InvalidPageRenderingSelectionsAbandonDependencies](reaction:fullSite.render.InvalidPageRenderingSelectionsAbandonDependencies)
- [InvalidPageRenderingSelectionsAbortOutput](reaction:fullSite.render.InvalidPageRenderingSelectionsAbortOutput)
- [InvalidPageRenderingSelectionsDiagnose](reaction:fullSite.render.InvalidPageRenderingSelectionsDiagnose)
- [LayoutTemplateFailuresDiagnose](reaction:fullSite.render.LayoutTemplateFailuresDiagnose)
- [LayoutTemplateFailuresFailRendering](reaction:fullSite.render.LayoutTemplateFailuresFailRendering)
- [MissingRenderingProfilesDiagnose](reaction:fullSite.render.MissingRenderingProfilesDiagnose)
- [MissingRenderingTemplatesDiagnose](reaction:fullSite.render.MissingRenderingTemplatesDiagnose)
- [PageAssetEmissionFailuresDiagnose](reaction:fullSite.render.PageAssetEmissionFailuresDiagnose)
- [PageDependenciesOpenEmission](reaction:fullSite.render.PageDependenciesOpenEmission)
- [PageEmissionFailuresDiagnose](reaction:fullSite.render.PageEmissionFailuresDiagnose)
- [PageEmissionsBeginRendering](reaction:fullSite.render.PageEmissionsBeginRendering)
- [RenderedLayoutsScan](reaction:fullSite.render.RenderedLayoutsScan)
- [RenderedLayoutsTrackTemplates](reaction:fullSite.render.RenderedLayoutsTrackTemplates)
- [RenderingAttemptsRetractDiagnostics](reaction:fullSite.render.RenderingAttemptsRetractDiagnostics)
- [RenderingBeginningsAbandonDependencies](reaction:fullSite.render.RenderingBeginningsAbandonDependencies)
- [RenderingBeginningsAbortEmission](reaction:fullSite.render.RenderingBeginningsAbortEmission)
- [RenderingBeginningsDiagnose](reaction:fullSite.render.RenderingBeginningsDiagnose)
- [RenderingDiagnosticsFailActiveAttempts](reaction:fullSite.render.RenderingDiagnosticsFailActiveAttempts)
- [RetractedRenderingAttemptsTrackSource](reaction:fullSite.render.RetractedRenderingAttemptsTrackSource)
- [SettledBodiesRenderOriginatedPages](reaction:fullSite.render.SettledBodiesRenderOriginatedPages)
- [SettledBodiesRenderUnoriginatedPages](reaction:fullSite.render.SettledBodiesRenderUnoriginatedPages)
- [SettledLayoutsStagePageOutput](reaction:fullSite.render.SettledLayoutsStagePageOutput)
- [TrackedRenderingSourcesFillBodies](reaction:fullSite.render.TrackedRenderingSourcesFillBodies)
- [DerivedRoutesClaim](reaction:fullSite.routes.DerivedRoutesClaim)
- [ExplicitRoutesClaim](reaction:fullSite.routes.ExplicitRoutesClaim)
- [InvalidRouteClaimsDiagnose](reaction:fullSite.routes.InvalidRouteClaimsDiagnose)
- [RouteCollisionsReport](reaction:fullSite.routes.RouteCollisionsReport)
- [UnpublishedRoutesRelease](reaction:fullSite.routes.UnpublishedRoutesRelease)
- [CloseSiteServer](reaction:fullSite.serving.CloseSiteServer)
- [OpenSiteServer](reaction:fullSite.serving.OpenSiteServer)
- [PublishSiteOutput](reaction:fullSite.serving.PublishSiteOutput)
- [AssessedConfigurationProblemsDiagnose](reaction:fullSite.settings.AssessedConfigurationProblemsDiagnose)
- [ConfigurationAssessmentRetractsDiagnostics](reaction:fullSite.settings.ConfigurationAssessmentRetractsDiagnostics)
- [SettingsCollectionDeclarationFailuresDiagnose](reaction:fullSite.settings.SettingsCollectionDeclarationFailuresDiagnose)
- [SettingsDeclareCatalogs](reaction:fullSite.settings.SettingsDeclareCatalogs)
- [SettingsDeclareMarkdownProfile](reaction:fullSite.settings.SettingsDeclareMarkdownProfile)
- [SettingsDeclareVerbatimProfile](reaction:fullSite.settings.SettingsDeclareVerbatimProfile)
- [SettingsMarkdownProfileFailuresDiagnose](reaction:fullSite.settings.SettingsMarkdownProfileFailuresDiagnose)
- [SettingsPhaseRetractsDiagnostics](reaction:fullSite.settings.SettingsPhaseRetractsDiagnostics)
- [SettingsResetCatalogs](reaction:fullSite.settings.SettingsResetCatalogs)
- [SettingsVerbatimProfileFailuresDiagnose](reaction:fullSite.settings.SettingsVerbatimProfileFailuresDiagnose)
- [ClearedContentGetsAttributes](reaction:fullSite.sources.ClearedContentGetsAttributes)
- [ClearedContentGetsDefaults](reaction:fullSite.sources.ClearedContentGetsDefaults)
- [ContentDocumentsParse](reaction:fullSite.sources.ContentDocumentsParse)
- [DocumentParseFailuresDiagnose](reaction:fullSite.sources.DocumentParseFailuresDiagnose)
- [ParsedContentClearsLayers](reaction:fullSite.sources.ParsedContentClearsLayers)
- [PublicFilesIntendOutput](reaction:fullSite.sources.PublicFilesIntendOutput)
- [TemplateDefinitionFailuresDiagnose](reaction:fullSite.sources.TemplateDefinitionFailuresDiagnose)
- [TemplatesDefine](reaction:fullSite.sources.TemplatesDefine)
- [AdmittedConfigurationIsLoaded](reaction:fullSite.staging.AdmittedConfigurationIsLoaded)
- [AdmittedSourceRootsAreLoaded](reaction:fullSite.staging.AdmittedSourceRootsAreLoaded)
- [BegunSiteBuildDeliveriesRetractStagingDiagnostics](reaction:fullSite.staging.BegunSiteBuildDeliveriesRetractStagingDiagnostics)
- [ConfiguredOutputDirectsPublication](reaction:fullSite.staging.ConfiguredOutputDirectsPublication)
- [DestinationDirectsPublication](reaction:fullSite.staging.DestinationDirectsPublication)
- [EscapingConfiguredOutputDiagnoses](reaction:fullSite.staging.EscapingConfiguredOutputDiagnoses)
- [EscapingContentRootDiagnoses](reaction:fullSite.staging.EscapingContentRootDiagnoses)
- [EscapingPublicRootDiagnoses](reaction:fullSite.staging.EscapingPublicRootDiagnoses)
- [EscapingTemplateRootDiagnoses](reaction:fullSite.staging.EscapingTemplateRootDiagnoses)
- [GroundedSiteAdmitsConfiguration](reaction:fullSite.staging.GroundedSiteAdmitsConfiguration)
- [LoadedConfigurationIsAssessed](reaction:fullSite.staging.LoadedConfigurationIsAssessed)
- [LocateGroundsSiteDirectory](reaction:fullSite.staging.LocateGroundsSiteDirectory)
- [OutputOverlappingConfigurationDiagnoses](reaction:fullSite.staging.OutputOverlappingConfigurationDiagnoses)
- [OutputOverlappingSourceRootDiagnoses](reaction:fullSite.staging.OutputOverlappingSourceRootDiagnoses)
- [StageAdmitsConfiguredOutput](reaction:fullSite.staging.StageAdmitsConfiguredOutput)
- [StageAdmitsRequestedDestination](reaction:fullSite.staging.StageAdmitsRequestedDestination)
- [StageAdmitsSourceRoots](reaction:fullSite.staging.StageAdmitsSourceRoots)
- [StartedSiteBuildsBeginAggregateDelivery](reaction:fullSite.staging.StartedSiteBuildsBeginAggregateDelivery)
- [UndecodableConfigurationDiagnoses](reaction:fullSite.staging.UndecodableConfigurationDiagnoses)
- [UndirectablePublicationDiagnoses](reaction:fullSite.staging.UndirectablePublicationDiagnoses)
- [UngroundableSiteDirectoryDiagnoses](reaction:fullSite.staging.UngroundableSiteDirectoryDiagnoses)
- [UnloadableSourceRootDiagnoses](reaction:fullSite.staging.UnloadableSourceRootDiagnoses)
- [UnreadableConfigurationDiagnoses](reaction:fullSite.staging.UnreadableConfigurationDiagnoses)
- [UnresolvableLocationDiagnoses](reaction:fullSite.staging.UnresolvableLocationDiagnoses)
- [AttendSiteWatch](reaction:fullSite.watching.AttendSiteWatch)
- [CloseSiteWatch](reaction:fullSite.watching.CloseSiteWatch)
- [OpenSiteWatch](reaction:fullSite.watching.OpenSiteWatch)
## Views
- [AbsoluteSiteUrl](view:fullSite.calculations.AbsoluteSiteUrl)
- [AddressOutputPath](view:fullSite.calculations.AddressOutputPath)
- [DerivedAddress](view:fullSite.calculations.DerivedAddress)
- [DirectoryPath](view:fullSite.calculations.DirectoryPath)
- [JoinedPath](view:fullSite.calculations.JoinedPath)
- [OutputPathAddress](view:fullSite.calculations.OutputPathAddress)
- [PublicationTransactionPrefix](view:fullSite.calculations.PublicationTransactionPrefix)
- [RelativePath](view:fullSite.calculations.RelativePath)
- [RetargetedReference](view:fullSite.calculations.RetargetedReference)
- [SiteUrl](view:fullSite.calculations.SiteUrl)
- [SyncpressCommand](view:fullSite.commanding.SyncpressCommand)
- [PublishableSiteBuild](view:fullSite.endpoints.PublishableSiteBuild)
- [SettledSiteBuild](view:fullSite.endpoints.SettledSiteBuild)
- [UnsettledRouteOwners](view:fullSite.endpoints.UnsettledRouteOwners)
- [RasterBodyAssetReference](view:fullSite.images.RasterBodyAssetReference)
- [ResponsiveBodyImageEmbedding](view:fullSite.images.ResponsiveBodyImageEmbedding)
- [InspectionOwner](view:fullSite.inspection.InspectionOwner)
- [RelativeBodyReference](view:fullSite.references.RelativeBodyReference)
- [ResolvedLocalBodyReference](view:fullSite.references.ResolvedLocalBodyReference)
- [UnroutedContentBodyAsset](view:fullSite.references.UnroutedContentBodyAsset)
- [PendingFailedRenderingCleanup](view:fullSite.render.PendingFailedRenderingCleanup)
- [ContentDocumentFile](view:fullSite.views.ContentDocumentFile)
- [PublicationPlace](view:fullSite.views.PublicationPlace)
## Formers
- [SiteInspection](former:fullSite.inspection.SiteInspection)
- [CompletedOriginatedPageRenderContext](former:fullSite.views.CompletedOriginatedPageRenderContext)
- [CompletedUnoriginatedPageRenderContext](former:fullSite.views.CompletedUnoriginatedPageRenderContext)
- [OriginatedPageRenderContext](former:fullSite.views.OriginatedPageRenderContext)
- [PublicationCard](former:fullSite.views.PublicationCard)
- [SiteBuildSummary](former:fullSite.views.SiteBuildSummary)
- [UnoriginatedPageRenderContext](former:fullSite.views.UnoriginatedPageRenderContext)
## Boundary endpoints

The application exposes these exact package-facing operation paths.

```endpoints
fullSite.commanding.AnnounceMisuse at /cli/misuse
fullSite.commanding.AnnounceUsage at /cli/usage
fullSite.commanding.HoldUntilStopped at /cli/hold
fullSite.commanding.InterpretCommandLine at /cli/interpret
fullSite.commanding.SetCommandLineExit at /cli/exit
fullSite.commanding.WriteCommandLine at /cli/write
fullSite.endpoints.BuildSiteAtConfiguredOutput at /site/build
fullSite.endpoints.BuildSiteAtDestination at /site/build
fullSite.endpoints.InspectSite at /site/inspect
fullSite.endpoints.ReadSiteSummary at /site/summary
fullSite.serving.CloseSiteServer at /serve/close
fullSite.serving.OpenSiteServer at /serve/open
fullSite.serving.PublishSiteOutput at /serve/publish
fullSite.watching.AttendSiteWatch at /watch/attend
fullSite.watching.CloseSiteWatch at /watch/close
fullSite.watching.OpenSiteWatch at /watch/open
```

## Pure computations

These named calculations project paths, rendering choices, deployment documents, and command-line values without host effects.

```computations
absoluteReferenceAddress(target: Value) : Value
  Returns the canonical routed address named by a site-absolute reference when one exists.

absoluteReferenceOutputPath(target: Value) : Value
  Returns the emitted file path named by a site-absolute reference when it is safely representable.

absoluteReferencePath(target: Value) : Value
  Returns a site-absolute reference's path without its query string or fragment.

addressOutputPath(address: Value) : Value
  Computes the deterministic addressOutputPath projection used by composition.

deploymentFeedPreparation(path: Value, title: Value, description: Value, site: Value, entries: Value) : Value
  Computes the deterministic deploymentFeedPreparation projection used by composition.

deploymentPaginationContext(site: Value, collections: Value, address: Value, canonicalUrl: Value, sourcePath: Value, title: Value, collection: Value, number: Value, pages: Value, cards: Value, previous: Value, next: Value) : Value
  Computes the deterministic deploymentPaginationContext projection used by composition.

deploymentRedirectDocument(target: Value, canonical: Value) : Value
  Computes the deterministic deploymentRedirectDocument projection used by composition.

deploymentSitemapDocument(urls: Value) : Value
  Computes the deterministic deploymentSitemapDocument projection used by composition.

deploymentTransitionCompleted(action: Value, result: Value) : Value
  Reports whether a deployment queue transition exhausted the complete work queue.

deploymentTransitionWork(action: Value, result: Value) : Value
  Computes the deterministic deploymentTransitionWork projection used by composition.

deriveAddress(path: Value) : Value
  Computes the deterministic deriveAddress projection used by composition.

directoryPath(path: Value) : Value
  Computes the deterministic directoryPath projection used by composition.

isAbsentValue(value: Value) : Value
  Computes the deterministic isAbsentValue projection used by composition.

isTextValue(value: Value) : Value
  Computes the deterministic isTextValue projection used by composition.

joinPath(prefix: Value, name: Value) : Value
  Computes the deterministic joinPath projection used by composition.

outputPathAddress(path: Value) : Value
  Computes the deterministic outputPathAddress projection used by composition.

pageRenderingError(path: Value, data: Value) : Value
  Computes the deterministic pageRenderingError projection used by composition.

pageRenderingErrorDetail(path: Value, data: Value) : Value
  Computes the deterministic pageRenderingErrorDetail projection used by composition.

pageRenderingProfile(path: Value, data: Value) : Value
  Computes the deterministic pageRenderingProfile projection used by composition.

pageRenderingSelectionHasValidity(path: Value, data: Value, valid: Value) : Value
  Computes the deterministic pageRenderingSelectionHasValidity projection used by composition.

pageRenderingTemplate(path: Value, data: Value) : Value
  Computes the deterministic pageRenderingTemplate projection used by composition.

patternHasResult(pattern: Value, path: Value, matched: Value) : Value
  Computes the deterministic patternHasResult projection used by composition.

projectAbsoluteSiteUrl(base: Value, origin: Value, address: Value) : Value
  Computes the deterministic projectAbsoluteSiteUrl projection used by composition.

projectSiteUrl(base: Value, target: Value) : Value
  Computes the deterministic projectSiteUrl projection used by composition.

prospectiveLocalReferenceAddress(sourcePath: Value, target: Value) : Value
  Projects a missing content-relative reference to the URL it would use if its target were produced.

publicationTransactionPrefix(destination: Value) : Value
  Computes the deterministic publicationTransactionPrefix projection used by composition.

relativePath(path: Value, prefix: Value) : Value
  Computes the deterministic relativePath projection used by composition.

retargetReference(replacement: Value, original: Value) : Value
  Computes the deterministic retargetReference projection used by composition.

syncpressCommandName(words: Value) : Value
  Computes the deterministic syncpressCommandName projection used by composition.

syncpressCommandOperands(words: Value) : Value
  Computes the deterministic syncpressCommandOperands projection used by composition.

syncpressCommandValid(words: Value) : Value
  Computes the deterministic syncpressCommandValid projection used by composition.

syncpressMisuse() : Value
  Computes the deterministic syncpressMisuse projection used by composition.

syncpressUsage() : Value
  Computes the deterministic syncpressUsage projection used by composition.

targetHasKind(target: Value, kind: Value) : Value
  Computes the deterministic targetHasKind projection used by composition.

```
