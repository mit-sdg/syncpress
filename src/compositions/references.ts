import { earlier, no, reaction, view, when, where } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import {
  AddressOutputPath,
  DirectoryPath,
  JoinedPath,
  OutputPathAddress,
  RetargetedReference,
  SiteUrl,
} from "./calculations.ts";
import { DIAGNOSTIC_SCOPES, PAGE_PATTERNS, PARTS, ROOTS } from "./shared.ts";

const { Diagnosing, Documenting, Emitting, Filing, Referencing, Rendering, Routing } = conceptRefs;

const ASSET_MEDIUM = "application/octet-stream";

export const RelativeBodyReference = view(
  "relative body reference of source (source)",
  ({ source }, { rendering, page, reference, raw, role }, _bindings) =>
    where(
      Referencing._source({ source }).is({ subject: rendering, part: PARTS.body }),
      Rendering._active({ rendering }).is({ subject: page }),
      Referencing._references({ source }).is({ reference, raw, role }),
      computations.targetHasKind({ target: raw, kind: "relative" }),
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
  ({ source }, { rendering, page, reference, raw, role, asset, sourcePath, name, content }, { root }) =>
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
  ({ page, name }, { path }, { pageAddress, pagePath, prefix }) =>
    where(
      Routing._address({ owner: page }).is({ address: pageAddress }),
      AddressOutputPath({ address: pageAddress }).is({ path: pagePath }),
      DirectoryPath({ path: pagePath }).is({ prefix }),
      JoinedPath({ prefix, name }).is({ path }),
    ),
).optional();

const CopyableBodyAsset = view(
  "copyable body asset of source (source)",
  ({ source }, { rendering, page, reference, raw, asset, name, content }, { sourcePath }) => [
    where(
      UnroutedContentBodyAsset({ source }).is({ rendering, page, reference, raw, asset, name, content }).is.not({ role: "image" }),
    ),
    where(
      UnroutedContentBodyAsset({ source }).is({ rendering, page, reference, raw, role: "image", asset, sourcePath, name, content }),
      computations.patternHasResult({ pattern: PAGE_PATTERNS.raster, path: sourcePath, matched: false }),
    ),
  ],
).many();

const HeldBodyReference = view(
  "held body reference of source (source)",
  ({ source }, { reference, raw }, _bindings) => [
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "absolute" })),
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "external" })),
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "fragment" })),
  ],
).many();

const HeldLayoutReference = view(
  "held layout reference of source (source)",
  ({ source }, { reference, raw }, _bindings) => [
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "external" })),
    where(Referencing._references({ source }).is({ reference, raw }), computations.targetHasKind({ target: raw, kind: "fragment" })),
  ],
).many();

/** Retarget relative references that resolve to a page with a claimed address. */
export const ClaimedBodyReferencesRetarget = reaction(({ source, reference, raw, target, address, value }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(
      ResolvedLocalBodyReference({ source }).is({ reference, raw, target }),
      Routing._address({ owner: target }).is({ address }),
      RetargetedReference({ replacement: address, original: raw }).is({ target: value }),
    )
    .then(Referencing.answer({ reference, form: "address", value })),
);

/** Copy ordinary and non-raster image assets beside the page that references them. */
export const CopyableBodyAssetsCopy = reaction(
  ({ source, rendering, page, target, name, content, path, emissionAttempt }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        CopyableBodyAsset({ source }).is({ rendering, page, asset: target, name, content }),
        Rendering._active({ rendering }).is({ emissionAttempt }),
        BesidePageOutput({ page, name }).is({ path }),
      )
      .then(
        Emitting.intend({
          producer: page,
          attempt: emissionAttempt,
          claim: target,
          path,
          content,
          medium: ASSET_MEDIUM,
        }),
      ),
);

/** Answer a copied asset only after its bytes are staged in the page attempt. */
export const CopiedBodyAssetsAnswer = reaction(
  ({ page, rendering, path, source, reference, raw, name, address, value }) =>
    when(Emitting.intend({ producer: page, path }).responds({}))
      .where(
        earlier(Referencing.scan, { subject: rendering, part: PARTS.body }, { source }),
        CopyableBodyAsset({ source }).is({ rendering, page, reference, raw, name }),
        BesidePageOutput({ page, name }).is({ path }),
        OutputPathAddress({ path }).is({ address }),
        RetargetedReference({ replacement: address, original: raw }).is({ target: value }),
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
          scope: DIAGNOSTIC_SCOPES.rendering,
          severity: "error",
          code: "UNPUBLISHED_DOCUMENT_REFERENCE",
          message: "This local reference targets an unpublished document.",
          source: path,
        }),
      ),
);

/** Body URLs that are already nonlocal are complete without rewriting. */
export const NonlocalBodyReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.body }).responds({ source }))
    .where(HeldBodyReference({ source }).is({ reference, raw }))
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

/** Invalid local URLs stay unanswered and become source diagnostics. */
function localReferenceDiagnostic(status: "missing" | "outside" | "invalid", code: string, message: string) {
  return reaction(({ source, page, raw, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        RelativeBodyReference({ source }).is({ page, raw }),
        Filing._resolution({ file: page, address: raw }).is({ status }),
        Filing._file({ file: page }).is({ path }),
      )
      .then(Diagnosing.report({ scope: DIAGNOSTIC_SCOPES.rendering, severity: "error", code, message, source: path })),
  );
}

export const MissingBodyReferencesDiagnose = localReferenceDiagnostic(
  "missing",
  "MISSING_LOCAL_REFERENCE",
  "This local reference names no staged content file.",
);
export const OutsideBodyReferencesDiagnose = localReferenceDiagnostic(
  "outside",
  "OUTSIDE_LOCAL_REFERENCE",
  "This local reference leaves the content root.",
);
export const InvalidBodyReferencesDiagnose = localReferenceDiagnostic(
  "invalid",
  "INVALID_LOCAL_REFERENCE",
  "This local reference has an invalid path spelling.",
);

/** Report local references whose URI spelling cannot preserve its suffix safely. */
export const UnretargetableClaimedBodyReferencesDiagnose = reaction(
  ({ source, page, raw, target, address, path }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        ResolvedLocalBodyReference({ source }).is({ page, raw, target }),
        Routing._address({ owner: target }).is({ address }),
        no(RetargetedReference({ replacement: address, original: raw })),
        Filing._file({ file: page }).is({ path }),
      )
      .then(
        Diagnosing.report({
          scope: DIAGNOSTIC_SCOPES.rendering,
          severity: "error",
          code: "INVALID_LOCAL_REFERENCE",
          message: "This local reference cannot be safely retargeted.",
          source: path,
        }),
      ),
);

export const UnretargetableCopiedBodyAssetsDiagnose = reaction(
  ({ source, page, raw, name, outputPath, address, sourcePath }) =>
    when(Referencing.scan({ part: PARTS.body }).responds({ source }))
      .where(
        CopyableBodyAsset({ source }).is({ page, raw, name }),
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

/** The completed layout is the only pass that applies the configured site base. */
export const AbsoluteLayoutReferencesRebase = reaction(({ source, reference, raw, url }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._references({ source }).is({ reference, raw }),
      computations.targetHasKind({ target: raw, kind: "absolute" }),
      SiteUrl({ target: raw }).is({ url }),
    )
    .then(Referencing.answer({ reference, form: "address", value: url })),
);

export const NonlocalLayoutReferencesHold = reaction(({ source, reference, raw }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(HeldLayoutReference({ source }).is({ reference, raw }))
    .then(Referencing.answer({ reference, form: "address", value: raw })),
);

/** Layouts have no content-directory source path for relative references. */
export const RelativeLayoutReferencesDiagnose = reaction(({ source, rendering, page, raw, path }) =>
  when(Referencing.scan({ part: PARTS.layout }).responds({ source }))
    .where(
      Referencing._source({ source }).is({ subject: rendering }),
      Rendering._active({ rendering }).is({ subject: page }),
      Referencing._references({ source }).is({ raw }),
      computations.targetHasKind({ target: raw, kind: "relative" }),
      Filing._file({ file: page }).is({ path }),
    )
    .then(
      Diagnosing.report({
        scope: DIAGNOSTIC_SCOPES.rendering,
        severity: "error",
        code: "RELATIVE_LAYOUT_REFERENCE",
        message: "A layout reference must be site-absolute, external, or fragment-only.",
        source: path,
      }),
    ),
);
