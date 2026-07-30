import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../../concept-set.ts";
import { PAGE_PATTERNS, PARTS, ROOTS } from "./shared.ts";

const { Diagnosing, Documenting, Emitting, Filing, Matching, Referencing, Routing } = concepts;

const ASSET_MEDIUM = "application/octet-stream";

/** Retarget relative references that resolve to a page with a claimed address. */
export const ClaimedBodyReferencesRetarget = reaction(({ source, page, reference, raw, target, address, value }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: page }),
      Referencing._references({ source }).is({ reference, raw }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
      Filing._resolve({ file: page, address: raw }).is({ target }),
      Routing._address({ owner: target }).is({ address }),
      Routing._retarget({ replacement: address, original: raw }).is({ target: value }),
    )
    .then(Referencing.answer({ reference, form: "address", value })),
);

/** Copy every non-primary-image local asset into the active page attempt. */
export const OrdinaryBodyAssetsCopy = reaction(
  ({ source, page, raw, target, root, path, content }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw }).is.not({ role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        no(Documenting._document({ subject: target })),
        Filing._file({ file: target }).is({ root, path, content }),
        Filing._root({ root }).is({ name: ROOTS.content }),
      )
      .then(
        Emitting.intend({
          producer: page,
          path,
          content,
          medium: ASSET_MEDIUM,
        }),
      ),
);

/** Answer an ordinary asset only after its bytes are staged in the page attempt. */
export const CopiedOrdinaryBodyAssetsAnswer = reaction(
  ({ page, path, source, reference, raw, target, root, address, value }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Referencing.scan, { subject: page, part: PARTS.body }, { source }),
        Referencing._references({ source }).is({ reference, raw }).is.not({ role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        no(Documenting._document({ subject: target })),
        Filing._file({ file: target }).is({ root, path }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Routing._locate({ path }).is({ address }),
        Routing._retarget({ replacement: address, original: raw }).is({ target: value }),
      )
      .then(Referencing.answer({ reference, form: "address", value })),
);

/** SVG and other non-raster primary images use the ordinary asset-copy path. */
export const NonRasterPrimaryImagesCopy = reaction(
  ({ source, page, raw, target, root, path, content, pattern }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw, role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        no(Documenting._document({ subject: target })),
        Filing._file({ file: target }).is({ root, path, content }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path }).is({ matched: false }),
      )
      .then(
        Emitting.intend({
          producer: page,
          path,
          content,
          medium: ASSET_MEDIUM,
        }),
      ),
);

/** Keep primary SVG and other non-raster image references behind their staged bytes. */
export const CopiedNonRasterPrimaryImagesAnswer = reaction(
  ({ page, path, source, reference, raw, target, root, pattern, address, value }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Referencing.scan, { subject: page, part: PARTS.body }, { source }),
        Referencing._references({ source }).is({ reference, raw, role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        no(Documenting._document({ subject: target })),
        Filing._file({ file: target }).is({ root, path }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path }).is({ matched: false }),
        Routing._locate({ path }).is({ address }),
        Routing._retarget({ replacement: address, original: raw }).is({ target: value }),
      )
      .then(Referencing.answer({ reference, form: "address", value })),
);

/** Parsed documents without a route are pages, not copyable local assets. */
export const UnpublishedDocumentBodyReferencesDiagnose = reaction(
  ({ source, page, raw, target, root, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
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
      Referencing._source({ source }).is({ subject: page }),
      Referencing._references({ source }).is({ raw }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
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
      Referencing._source({ source }).is({ subject: page }),
      Referencing._references({ source }).is({ raw }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
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
      Referencing._source({ source }).is({ subject: page }),
      Referencing._references({ source }).is({ raw }),
      Routing._classify({ target: raw }).is({ kind: "relative" }),
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
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
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
  ({ source, page, raw, target, root, path, pattern, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw, role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        no(Documenting._document({ subject: target })),
        Filing._file({ file: target }).is({ root, path }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Matching._compiled({ text: PAGE_PATTERNS.raster }).is({ pattern }),
        Matching._matches({ pattern, path }).is({ matched: false }),
        Routing._locate({ path }).is({ address }),
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
  ({ source, page, raw, target, root, path, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        Referencing._source({ source }).is({ subject: page }),
        Referencing._references({ source }).is({ raw }).is.not({ role: "image" }),
        Routing._classify({ target: raw }).is({ kind: "relative" }),
        Filing._resolve({ file: page, address: raw }).is({ target }),
        no(Routing._address({ owner: target })),
        no(Documenting._document({ subject: target })),
        Filing._file({ file: target }).is({ root, path }),
        Filing._root({ root }).is({ name: ROOTS.content }),
        Routing._locate({ path }).is({ address }),
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
export const RelativeLayoutReferencesDiagnose = reaction(({ source, page, raw, path }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: page }),
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
