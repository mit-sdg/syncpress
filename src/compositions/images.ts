import { earlier, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { JoinedPath, OutputPathAddress, RetargetedReference } from "./calculations.ts";
import { DIAGNOSTIC_SCOPES, PAGE_PATTERNS, PARTS } from "./shared.ts";
import {
  BesidePageOutput,
  ResolvedLocalBodyReference,
  UnroutedContentBodyAsset,
} from "./references.ts";

const {
  Diagnosing,
  Embedding,
  Emitting,
  Filing,
  Governing,
  Referencing,
  RenderTracking,
  Routing,
  Transcoding,
} = conceptRefs;

export const RasterBodyAssetReference = view(
  "primary raster body asset reference of source (source)",
  ({ source }, { rendering, page, reference, raw, image, name, content }, { imagePath }) =>
    where(
      UnroutedContentBodyAsset({ source }).is({
        rendering,
        page,
        reference,
        raw,
        role: "image",
        asset: image,
        sourcePath: imagePath,
        name,
        content,
      }),
      computations.patternHasResult({ pattern: PAGE_PATTERNS.raster, path: imagePath, matched: true }),
    ),
).many();

export const ResponsiveBodyImageEmbedding = view(
  "responsive body image embedding (embedding)",
  ({ embedding }, { rendering, page, original }, { source, reference, raw, image }) =>
    where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Referencing._reference({ reference }).is({ source, raw, role: "image" }),
      Referencing._source({ source }).is({ subject: rendering, part: PARTS.body }),
      RenderTracking._active({ rendering }).is({ subject: page }),
      computations.targetHasKind({ target: raw, kind: "relative" }),
      Filing._resolve({ file: page, address: raw }).is({ target: image }),
      Transcoding._original({ subject: image }).is({ original }),
    ),
).optional();

/** Admit only local primary raster image sources. */
export const PrimaryRasterImagesAdmit = reaction(
  ({ source, image, content }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        RasterBodyAssetReference({ source }).is({ image, content }),
      )
      .then(Transcoding.ingest({ subject: image, content })),
);

/** Render the configured rendition set after an image has been admitted. */
export const AdmittedRasterImagesRender = reaction(({ original, widths, formats }) =>
  when(Transcoding.ingest({}).responds({ original }))
    .where(Governing._images({}).is({ widths, formats }))
    .then(Transcoding.generateRenditions({ original, widths, formats })),
);

/** Stage the exact fallback beside the page that owns its primary image reference. */
export const RasterFallbacksStage = reaction(
  ({
    original,
    image,
    source,
    rendering,
    page,
    name,
    path,
    content,
    mediaType,
    emissionAttempt,
  }) =>
    when(Transcoding.generateRenditions({ original }).responds({}))
      .where(
        earlier(Referencing.scan, { part: PARTS.body }, { source }),
        Transcoding._original({ subject: image }).is({ original }),
        RasterBodyAssetReference({ source }).is({ rendering, page, image, name }),
        RenderTracking._active({ rendering }).is({ emissionAttempt }),
        BesidePageOutput({ page, name }).is({ path }),
        Transcoding._renditions({ original }).is({
          fallback: true,
          content,
          mediaType,
        }),
      )
      .then(Emitting.intend({ producer: page, attempt: emissionAttempt, claim: image, path, content, medium: mediaType })),
);

/** Declare the embedding only after that fallback intent has been staged. */
export const RasterFallbacksDeclare = reaction(
  ({
    page,
    rendering,
    path,
    emissionAttempt,
    original,
    derived,
    source,
    reference,
    raw,
    label,
    image,
    name,
    address,
    fallback,
    format,
    width,
    height,
    attributes,
  }) =>
    when(Emitting.intend({ producer: page, attempt: emissionAttempt, path }).responds({}))
      .where(
        earlier(Transcoding.generateRenditions, { original }, { derived }),
        earlier(Referencing.scan, { subject: rendering, part: PARTS.body }, { source }),
        RasterBodyAssetReference({ source }).is({ rendering, page, reference, raw, image, name }),
        RenderTracking._active({ rendering }).is({ emissionAttempt }),
        Referencing._reference({ reference }).is({ label, attributes }),
        Transcoding._original({ subject: image }).is({ original }),
        BesidePageOutput({ page, name }).is({ path }),
        OutputPathAddress({ path }).is({ address }),
        RetargetedReference({ replacement: address, original: raw }).is({ target: fallback }),
        Transcoding._renditions({ original }).is({ fallback: true, format, width, height }),
      )
      .then(
        Embedding.declare({
          subject: reference,
          alternative: label,
          width,
          height,
          expects: derived,
          original: fallback,
          originalFormat: format,
          attributes,
        }),
      ),
);

/** Unsafe raster fallback spellings cannot become safe responsive markup. */
export const UnretargetableRasterPrimaryImagesDiagnose = reaction(
  ({ source, page, raw, name, outputPath, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        RasterBodyAssetReference({ source }).is({ page, raw, name }),
        BesidePageOutput({ page, name }).is({ path: outputPath }),
        OutputPathAddress({ path: outputPath }).is({ address }),
        no(RetargetedReference({ replacement: address, original: raw })),
        Filing._file({ file: page }).is({ path: sourcePath }),
      )
      .then(
        Diagnosing.report({
          scope: DIAGNOSTIC_SCOPES.rendering,
          severity: "error",
          code: "INVALID_LOCAL_REFERENCE",
          message: "This local reference cannot be safely retargeted.",
          source: sourcePath,
        }),
      ),
);

/** Stage each optimized rendition under the configured assets directory. */
export const RasterRenditionsStage = reaction(
  ({
    embedding,
    rendering,
    page,
    original,
    rendition,
    content,
    mediaType,
    name,
    assets,
    path,
    emissionAttempt,
  }) =>
    when(Embedding.declare({}).responds({ embedding }))
      .where(
        ResponsiveBodyImageEmbedding({ embedding }).is({ rendering, page, original }),
        RenderTracking._active({ rendering }).is({ emissionAttempt }),
        Transcoding._renditions({ original }).is({
          rendition,
          fallback: false,
          content,
          mediaType,
          name,
        }),
        Governing._paths({}).is({ assets }),
        JoinedPath({ prefix: assets, name }).is({ path }),
      )
      .then(Emitting.intend({ producer: page, attempt: emissionAttempt, claim: rendition, path, content, medium: mediaType })),
);

/** Offer a rendition only after the matching asset intent has been staged. */
export const RasterRenditionsOffer = reaction(
  ({ embedding, page, path, original, format, width, order, name, assets, address }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Embedding.declare, {}, { embedding }),
        ResponsiveBodyImageEmbedding({ embedding }).is({ page, original }),
        Transcoding._renditions({ original }).is({ fallback: false, format, width, order, name }),
        Governing._paths({}).is({ assets }),
        JoinedPath({ prefix: assets, name }).is({ path }),
        OutputPathAddress({ path }).is({ address }),
      )
       .then(Embedding.provideCandidate({ embedding, address, format, width, order })),
);

/** Zero-derived images complete on declaration after their fallback is staged. */
export const DeclaredEmbeddingsAnswer = reaction(({ embedding, reference, markup }) =>
  when(Embedding.declare({}).responds({ embedding, completed: true }))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Embedding._markup({ embedding }).is({ markup }),
    )
    .then(Referencing.resolve({ reference, form: "markup", value: markup })),
);

/** Positive-derived images answer only after the final staged offer completes. */
export const CompletedEmbeddingsAnswer = reaction(({ embedding, reference, markup }) =>
  when(Embedding.provideCandidate({ embedding }).responds({ completed: true }))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Embedding._markup({ embedding }).is({ markup }),
    )
    .then(Referencing.resolve({ reference, form: "markup", value: markup })),
);

/** Image failures retain the original page output and make the build unpublishable. */
export const RasterAdmissionsDiagnose = reaction(({ image, error, detail, source, page, path }) =>
  when(Transcoding.ingest({ subject: image }).refuses({ error, detail }))
    .where(
      earlier(Referencing.scan, { part: PARTS.body }, { source }),
      ResolvedLocalBodyReference({ source }).is({ page, role: "image", target: image }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const RasterRendersDiagnose = reaction(({ original, error, detail, source, page, image, path }) =>
  when(Transcoding.generateRenditions({ original }).refuses({ error, detail }))
    .where(
      earlier(Referencing.scan, { part: PARTS.body }, { source }),
      ResolvedLocalBodyReference({ source }).is({ page, role: "image", target: image }),
      Transcoding._original({ subject: image }).is({ original }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const RasterEmbeddingDeclarationsDiagnose = reaction(({ reference, error, detail, source, rendering, page, path }) =>
  when(Embedding.declare({ subject: reference }).refuses({ error, detail }))
    .where(
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: rendering, part: PARTS.body }),
       RenderTracking._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);

export const RasterOffersDiagnose = reaction(({ embedding, error, detail, reference, source, rendering, page, path }) =>
  when(Embedding.provideCandidate({ embedding }).refuses({ error, detail }))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: rendering, part: PARTS.body }),
       RenderTracking._active({ rendering }).is({ subject: page }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code: error, message: detail, source: path })),
);
