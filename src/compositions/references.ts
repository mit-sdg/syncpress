import { earlier, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";
import { PAGE_PATTERNS, PARTS, ROOTS } from "./shared.ts";

const { Diagnosing, Documenting, Emitting, Filing, Matching, Referencing, Rendering, Routing } = concepts;

const ASSET_MEDIUM = "application/octet-stream";

export const RelativeBodyReference = view(
  "relative body reference of source (source)",
  ({ source }, { rendering, page, reference, raw, role }, _bindings) =>
    where(
      Referencing._source({ source }).is({ subject: rendering, part: PARTS.body }),
      Rendering._active({ rendering }).is({ subject: page }),
      Referencing._references({ source }).is({ reference, raw, role }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
    ),
).many();

export const ResolvedLocalBodyReference = view(
  "resolved local body reference of source (source)",
  ({ source }, { rendering, page, reference, raw, role, target }, _bindings) =>
    where(
      RelativeBodyReference({ source }).is({ rendering, page, reference, raw, role }),
      Filing._resolve({ file: page, address: raw }).is({ target }),
    ),
).many();

export const UnroutedContentBodyAsset = view(
  "unrouted content body asset of source (source)",
  ({ source }, { rendering, page, reference, raw, role, asset, root, sourcePath, name, content }, _bindings) =>
    where(
      ResolvedLocalBodyReference({ source }).is({ rendering, page, reference, raw, role, target: asset }),
      no(Routing._address({ owner: asset })),
      no(Documenting._document({ subject: asset })),
      Filing._file({ file: asset }).is({ root, path: sourcePath, name, content }),
      Filing._root({ root }).is({ name: ROOTS.content }),
    ),
).many();

export const BesidePageOutput = view(
  "beside-page output for page (page) and name (name)",
  ({ page, name }, { pageAddress, pagePath, prefix, path }, _bindings) =>
    where(
      Routing._address({ owner: page }).is({ address: pageAddress }),
      Routing._file({ address: pageAddress }).is({ path: pagePath }),
      Filing._directory({ path: pagePath }).is({ prefix }),
      Filing._join({ prefix, name }).is({ path }),
    ),
).optional();

/** Retarget relative references that resolve to a page with a claimed address. */
export const ClaimedBodyReferencesRetarget = reaction(({ source, reference, raw, target, address, value }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      ResolvedLocalBodyReference({ source }).is({ reference, raw, target }),
      Routing._address({ owner: target }).is({ address }),
      Routing._retarget({ replacement: address, original: raw }).is({ target: value }),
    )
    .then(Referencing.answer({ reference, form: "address", value })),
);

/** Copy every non-primary-image local asset beside the page that references it. */
export const OrdinaryBodyAssetsCopy = reaction(
  ({ source, page, target, name, content, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        UnroutedContentBodyAsset({ source }).is({ page, asset: target, name, content }).is.not({ role: "image" }),
        BesidePageOutput({ page, name }).is({ path }),
      )
      .then(
        Emitting.intend({
          producer: page,
          claim: target,
          path,
          content,
          medium: ASSET_MEDIUM,
        }),
      ),
);

/** Answer an ordinary asset only after its bytes are staged in the page attempt. */
export const CopiedOrdinaryBodyAssetsAnswer = reaction(
  ({ page, rendering, path, source, reference, raw, name, address, value }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Referencing.scan, { subject: rendering, part: PARTS.body }, { source }),
        UnroutedContentBodyAsset({ source }).is({ rendering, page, reference, raw, name }).is.not({ role: "image" }),
        BesidePageOutput({ page, name }).is({ path }),
        Routing._locate({ path }).is({ address }),
        Routing._retarget({ replacement: address, original: raw }).is({ target: value }),
      )
      .then(Referencing.answer({ reference, form: "address", value })),
);

/** SVG and other non-raster primary images use the beside-page asset policy. */
export const NonRasterPrimaryImagesCopy = reaction(
  ({ source, page, target, sourcePath, name, content, pattern, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        UnroutedContentBodyAsset({ source }).is({ page, role: "image", asset: target, sourcePath, name, content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path: sourcePath }).is({ matched: false }),
        BesidePageOutput({ page, name }).is({ path }),
      )
      .then(
        Emitting.intend({
          producer: page,
          claim: target,
          path,
          content,
          medium: ASSET_MEDIUM,
        }),
      ),
);

/** Keep primary SVG and other non-raster image references behind their staged bytes. */
export const CopiedNonRasterPrimaryImagesAnswer = reaction(
  ({ page, rendering, path, source, reference, raw, sourcePath, name, pattern, address, value }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Referencing.scan, { subject: rendering, part: PARTS.body }, { source }),
        UnroutedContentBodyAsset({ source }).is({ rendering, page, reference, raw, role: "image", sourcePath, name }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path: sourcePath }).is({ matched: false }),
        BesidePageOutput({ page, name }).is({ path }),
        Routing._locate({ path }).is({ address }),
        Routing._retarget({ replacement: address, original: raw }).is({ target: value }),
      )
      .then(Referencing.answer({ reference, form: "address", value })),
);

/** Parsed documents without a route are pages, not copyable local assets. */
export const UnpublishedDocumentBodyReferencesDiagnose = reaction(
  ({ source, page, target, root, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        ResolvedLocalBodyReference({ source }).is({ page, target }),
        no(Routing._address({ owner: target })),
        Documenting._document({ subject: target }).is({}),
        Filing._file({ file: target }).is({ root }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Filing._file({ file: page }).is({ path }),
      )
      .then(
        Diagnosing.report({
          severity: "error",
          code: "UNPUBLISHED_DOCUMENT_REFERENCE",
          message: "This local reference targets an unpublished document.",
          source: path,
        }),
      ),
);

/** Body URLs that are already nonlocal are complete without rewriting. */
export const AbsoluteBodyReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "absolute" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

export const ExternalBodyReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "external" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

export const FragmentBodyReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "fragment" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

/** Invalid local URLs stay unanswered and become source diagnostics. */
export const MissingBodyReferencesDiagnose = reaction(({ source, page, raw, path }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      RelativeBodyReference({ source }).is({ page, raw }),
      Filing._resolution({ file: page, address: raw }).is({ status: "missing" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "MISSING_LOCAL_REFERENCE",
        message: "This local reference names no staged content file.",
        source: path,
      }),
    ),
);

export const OutsideBodyReferencesDiagnose = reaction(({ source, page, raw, path }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      RelativeBodyReference({ source }).is({ page, raw }),
      Filing._resolution({ file: page, address: raw }).is({ status: "outside" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "OUTSIDE_LOCAL_REFERENCE",
        message: "This local reference leaves the content root.",
        source: path,
      }),
    ),
);

export const InvalidBodyReferencesDiagnose = reaction(({ source, page, raw, path }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      RelativeBodyReference({ source }).is({ page, raw }),
      Filing._resolution({ file: page, address: raw }).is({ status: "invalid" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "INVALID_LOCAL_REFERENCE",
        message: "This local reference has an invalid path spelling.",
        source: path,
      }),
    ),
);

/** Report local references whose URI spelling cannot preserve its suffix safely. */
export const UnretargetableClaimedBodyReferencesDiagnose = reaction(
  ({ source, page, raw, target, address, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        ResolvedLocalBodyReference({ source }).is({ page, raw, target }),
        Routing._address({ owner: target }).is({ address }),
        no(Routing._retarget({ replacement: address, original: raw })),
        Filing._file({ file: page }).is({ path }),
      )
      .then(
        Diagnosing.report({
          severity: "error",
          code: "INVALID_LOCAL_REFERENCE",
          message: "This local reference cannot be safely retargeted.",
          source: path,
        }),
      ),
);

export const UnretargetableNonRasterPrimaryImagesDiagnose = reaction(
  ({ source, page, raw, imagePath, name, pattern, outputPath, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        UnroutedContentBodyAsset({ source }).is({ page, raw, role: "image", sourcePath: imagePath, name }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path: imagePath }).is({ matched: false }),
        BesidePageOutput({ page, name }).is({ path: outputPath }),
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

export const UnretargetableAssetBodyReferencesDiagnose = reaction(
  ({ source, page, raw, name, outputPath, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        UnroutedContentBodyAsset({ source }).is({ page, raw, name }).is.not({ role: "image" }),
        BesidePageOutput({ page, name }).is({ path: outputPath }),
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

/** The completed layout is the only pass that applies the configured site base. */
export const AbsoluteLayoutReferencesRebase = reaction(({ source, reference, raw, url }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "absolute" }),
      Routing._url({ target: raw }).is({ url }),
    )
    .then(Referencing.answer({ reference, form: "address", value: url })),
);

export const ExternalLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "external" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

export const FragmentLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "fragment" }),
    )
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

/** Layouts have no content-directory source path for relative references. */
export const RelativeLayoutReferencesDiagnose = reaction(({ source, rendering, page, raw, path }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: rendering }),
      Rendering._active({ rendering }).is({ subject: page }),
      Referencing._references({ source }).is({ raw }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "RELATIVE_LAYOUT_REFERENCE",
        message: "A layout reference must be site-absolute, external, or fragment-only.",
        source: path,
      }),
    ),
);
