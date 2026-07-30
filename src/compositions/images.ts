import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { DEFAULTS, PAGE_PATTERNS, PARTS, PATHS, ROOTS } from "./shared.ts";

const {
  Configuring,
  Diagnosing,
  Embedding,
  Emitting,
  Filing,
  Matching,
  Referencing,
  Routing,
  Transcoding,
} = concepts;

/** Admit only local primary raster image sources. */
export const PrimaryRasterImagesAdmit = reaction(
  ({ source, page, raw, image, root, path, content, pattern }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw, role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target: image }),
        no(Routing._address({ owner: image })),
        Filing._file({ file: image }).is({ root, path, content }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path }).is({ matched: true }),
      )
      .then(Transcoding.admit({ subject: image, content })),
);

/** Render the configured rendition set after an image has been admitted. */
export const AdmittedRasterImagesRender = reaction(({ original, configuration, widths, formats }) =>
  when(Transcoding.admit({}).responds({ original }))
    .where(
      Configuring._active({}).is({ root: configuration }),
      Configuring._values({
        node: configuration,
        path: PATHS.imagesWidths,
        otherwise: [...DEFAULTS.imageWidths],
      }).is({ values: widths }),
      Configuring._values({
        node: configuration,
        path: PATHS.imagesFormats,
        otherwise: [...DEFAULTS.imageFormats],
      }).is({ values: formats }),
    )
    .then(Transcoding.render({ original, widths, formats })),
);

/** Stage the exact fallback beside the page that owns its primary image reference. */
export const RasterFallbacksStage = reaction(
  ({
    original,
    image,
    source,
    page,
    raw,
    root,
    imagePath,
    name,
    pageAddress,
    pagePath,
    prefix,
    path,
    pattern,
    content,
    mediaType,
  }) =>
    when(Transcoding.render({ original }).responds({}))
      .where(
        earlier(Referencing.scan, { part: PARTS.body }, { source }),
        Transcoding._original({ subject: image }).is({ original }),
        Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
        Referencing._references({ source }).is({ raw, role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target: image }),
        no(Routing._address({ owner: image })),
        Filing._file({ file: image }).is({ root, path: imagePath, name }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path: imagePath }).is({ matched: true }),
        Routing._address({ owner: page }).is({ address: pageAddress }),
        Routing._file({ address: pageAddress }).is({ path: pagePath }),
        Filing._directory({ path: pagePath }).is({ prefix }),
        Filing._join({ prefix, name }).is({ path }),
        Transcoding._renditions({ original }).is({
          fallback: true,
          content,
          mediaType,
        }),
      )
      .then(Emitting.intend({ producer: page, claim: image, path, content, medium: mediaType })),
);

/** Declare the embedding only after that fallback intent has been staged. */
export const RasterFallbacksDeclare = reaction(
  ({
    page,
    path,
    original,
    derived,
    source,
    reference,
    raw,
    label,
    image,
    root,
    imagePath,
    name,
    pattern,
    pageAddress,
    pagePath,
    prefix,
    address,
    fallback,
    format,
    width,
    height,
    attributes,
  }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Transcoding.render, { original }, { derived }),
        earlier(Referencing.scan, { subject: page, part: PARTS.body }, { source }),
        Referencing._references({ source }).is({ reference, raw, label, role: "image", attributes }),
        Transcoding._original({ subject: image }).is({ original }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target: image }),
        no(Routing._address({ owner: image })),
        Filing._file({ file: image }).is({ root, path: imagePath, name }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path: imagePath }).is({ matched: true }),
        Routing._address({ owner: page }).is({ address: pageAddress }),
        Routing._file({ address: pageAddress }).is({ path: pagePath }),
        Filing._directory({ path: pagePath }).is({ prefix }),
        Filing._join({ prefix, name }).is({ path }),
        Routing._locate({ path }).is({ address }),
        Routing._retarget({ replacement: address, original: raw }).is({ target: fallback }),
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
  ({ source, page, raw, image, root, imagePath, name, pattern, pageAddress, pagePath, prefix, outputPath, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw, role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target: image }),
        no(Routing._address({ owner: image })),
        Filing._file({ file: image }).is({ root, path: imagePath, name }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path: imagePath }).is({ matched: true }),
        Routing._address({ owner: page }).is({ address: pageAddress }),
        Routing._file({ address: pageAddress }).is({ path: pagePath }),
        Filing._directory({ path: pagePath }).is({ prefix }),
        Filing._join({ prefix, name }).is({ path: outputPath }),
        Routing._locate({ path: outputPath }).is({ address }),
        no(Routing._retarget({ replacement: address, original: raw })),
        Filing._file({ file: page }).is({ path: sourcePath }),
      )
      .then(
        Diagnosing.report({
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
    reference,
    source,
    page,
    raw,
    image,
    original,
    rendition,
    content,
    mediaType,
    name,
    configuration,
    assets,
    path,
  }) =>
    when(Embedding.declare({}).responds({ embedding }))
      .where(
        Embedding._embedding({ embedding }).is({ subject: reference }),
        Referencing._reference({ reference }).is({ source, raw, role: "image" }),
        Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target: image }),
        Transcoding._original({ subject: image }).is({ original }),
        Transcoding._renditions({ original }).is({
          rendition,
          fallback: false,
          content,
          mediaType,
          name,
        }),
        Configuring._active({}).is({ root: configuration }),
        Configuring._scalar({
          node: configuration,
          path: PATHS.pathsAssets,
          otherwise: DEFAULTS.assetsPath,
        }).is({ value: assets }),
        Filing._join({ prefix: assets, name }).is({ path }),
      )
      .then(Emitting.intend({ producer: page, claim: rendition, path, content, medium: mediaType })),
);

/** Offer a rendition only after the matching asset intent has been staged. */
export const RasterRenditionsOffer = reaction(
  ({ embedding, page, path, reference, source, raw, image, original, format, width, order, name, configuration, assets, address }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Embedding.declare, {}, { embedding }),
        Embedding._embedding({ embedding }).is({ subject: reference }),
        Referencing._reference({ reference }).is({ source, raw, role: "image" }),
        Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target: image }),
        Transcoding._original({ subject: image }).is({ original }),
        Transcoding._renditions({ original }).is({ fallback: false, format, width, order, name }),
        Configuring._active({}).is({ root: configuration }),
        Configuring._scalar({
          node: configuration,
          path: PATHS.pathsAssets,
          otherwise: DEFAULTS.assetsPath,
        }).is({ value: assets }),
        Filing._join({ prefix: assets, name }).is({ path }),
        Routing._locate({ path }).is({ address }),
      )
      .then(Embedding.offer({ embedding, address, format, width, order })),
);

/** Zero-derived images complete on declaration after their fallback is staged. */
export const DeclaredEmbeddingsAnswer = reaction(({ embedding, reference, markup }) =>
  when(Embedding.declare({}).responds({ embedding, completed: true }))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Embedding._markup({ embedding }).is({ markup }),
    )
    .then(Referencing.answer({ reference, form: "markup", value: markup })),
);

/** Positive-derived images answer only after the final staged offer completes. */
export const CompletedEmbeddingsAnswer = reaction(({ embedding, reference, markup }) =>
  when(Embedding.offer({ embedding }).responds({ completed: true }))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Embedding._markup({ embedding }).is({ markup }),
    )
    .then(Referencing.answer({ reference, form: "markup", value: markup })),
);

/** Image failures retain the original page output and make the build unpublishable. */
export const RasterAdmissionsDiagnose = reaction(({ image, error, detail, source, page, raw, path }) =>
  when(Transcoding.admit({ subject: image }).refuses({ error, detail }))
    .where(
      earlier(Referencing.scan, { part: PARTS.body }, { source }),
      Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
      Referencing._references({ source }).is({ raw, role: "image" }),
      Filing._resolve({ file: page, address: raw }).is({ target: image }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const RasterRendersDiagnose = reaction(({ original, error, detail, source, page, raw, image, path }) =>
  when(Transcoding.render({ original }).refuses({ error, detail }))
    .where(
      earlier(Referencing.scan, { part: PARTS.body }, { source }),
      Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
      Referencing._references({ source }).is({ raw, role: "image" }),
      Filing._resolve({ file: page, address: raw }).is({ target: image }),
      Transcoding._original({ subject: image }).is({ original }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const RasterEmbeddingDeclarationsDiagnose = reaction(({ reference, error, detail, source, page, path }) =>
  when(Embedding.declare({ subject: reference }).refuses({ error, detail }))
    .where(
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const RasterOffersDiagnose = reaction(({ embedding, error, detail, reference, source, page, path }) =>
  when(Embedding.offer({ embedding }).refuses({ error, detail }))
    .where(
      Embedding._embedding({ embedding }).is({ subject: reference }),
      Referencing._reference({ reference }).is({ source }),
      Referencing._source({ source }).is({ subject: page, part: PARTS.body }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);
