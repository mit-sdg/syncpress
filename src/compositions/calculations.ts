import { compute, view, where } from "@mit-sdg/sync-engine/language";
import { computations } from "@syncpress/concept-set";

/** Optional relational facades over nullable pure calculations. */
export const DerivedAddress = view(
  "derived address of path (path)",
  ({ path }, { address }) => where(
    compute(computations.deriveAddress, { path }, address),
    computations.isTextValue({ value: address }),
  ),
).optional();

export const AddressOutputPath = view(
  "output path of address (address)",
  ({ address }, { path }) => where(
    compute(computations.addressOutputPath, { address }, path),
    computations.isTextValue({ value: path }),
  ),
).optional();

export const OutputPathAddress = view(
  "address of output path (path)",
  ({ path }, { address }) => where(
    compute(computations.outputPathAddress, { path }, address),
    computations.isTextValue({ value: address }),
  ),
).optional();

export const RetargetedReference = view(
  "retargeted reference from original (original) to replacement (replacement)",
  ({ replacement, original }, { target }) => where(
    compute(computations.retargetReference, { replacement, original }, target),
    computations.isTextValue({ value: target }),
  ),
).optional();

export const RelativePath = view(
  "path (path) relative to prefix (prefix)",
  ({ path, prefix }, { relative }) => where(
    compute(computations.relativePath, { path, prefix }, relative),
    computations.isTextValue({ value: relative }),
  ),
).optional();

export const JoinedPath = view(
  "path joining prefix (prefix) and name (name)",
  ({ prefix, name }, { path }) => where(
    compute(computations.joinPath, { prefix, name }, path),
    computations.isTextValue({ value: path }),
  ),
).optional();

export const DirectoryPath = view(
  "directory prefix of path (path)",
  ({ path }, { prefix }) => where(
    compute(computations.directoryPath, { path }, prefix),
    computations.isTextValue({ value: prefix }),
  ),
).optional();
