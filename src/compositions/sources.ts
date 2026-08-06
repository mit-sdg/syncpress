import { earlier, no, reaction, when } from "@mit-sdg/sync-engine/language";
import { computations, concepts as conceptRefs } from "@syncpress/concept-set";
import { RelativePath } from "./calculations.ts";
import { MAX_PAGE_LAYER_RANK, PHASE_SEQUENCE, ROOTS } from "./shared.ts";
import { ContentDocumentFile } from "./views.ts";

const { Diagnosing, Documenting, Emitting, Filing, Governing, Layering, Phasing, Templating } = conceptRefs;

export const ContentDocumentsParse = reaction(({ file, text }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "read", transitioned: true }))
    .where(ContentDocumentFile({}).is({ file, text }))
    .then(Documenting.parse({ subject: file, text })),
);

/** Front-matter refusals belong to the authored content file, not a derived page. */
export const DocumentParseFailuresDiagnose = reaction(({ file, root, path, detail }) =>
  when(Documenting.parse({ subject: file }).refuses({ error: "MALFORMED_ATTRIBUTES", detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "read", transitioned: true }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file }).is({ root, path }),
    )
    .then(
      Diagnosing.report({
        severity: "error",
        code: "MALFORMED_ATTRIBUTES",
        message: detail,
        source: path,
      }),
    ),
);

export const TemplatesDefine = reaction(({ root, file, path, text }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "read", transitioned: true }))
    .where(
      Filing._named({ name: ROOTS.templates }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      no(RelativePath({ path, prefix: ROOTS.includes })),
      Filing._text({ file }).is({ text }),
    )
    .then(Templating.register({ name: path, source: text, origin: file })),
);

export const IncludesDefine = reaction(({ root, file, physicalPath, path, text }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "read", transitioned: true }))
    .where(
      Filing._named({ name: ROOTS.templates }).is({ root }),
      Filing._under({ root, prefix: ROOTS.includes }).is({ file, path: physicalPath }),
      RelativePath({ path: physicalPath, prefix: ROOTS.includes }).is({ relative: path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Templating.register({ name: path, source: text, origin: file })),
);

export const TemplateDefinitionFailuresDiagnose = reaction(({ root, file, path, text, error, detail }) =>
  when(Templating.register({ name: path, source: text, origin: file }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "read", transitioned: true }),
      Filing._named({ name: ROOTS.templates }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const IncludeDefinitionFailuresDiagnose = reaction(({ root, file, physicalPath, path, text, error, detail }) =>
  when(Templating.register({ name: path, source: text, origin: file }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "read", transitioned: true }),
      Filing._named({ name: ROOTS.templates }).is({ root }),
      Filing._under({ root, prefix: ROOTS.includes }).is({ file, path: physicalPath }),
      RelativePath({ path: physicalPath, prefix: ROOTS.includes }).is({ relative: path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const PublicFilesIntendOutput = reaction(({ root, file, path, content }) =>
  when(Phasing.advance({}).responds({ name: PHASE_SEQUENCE, phase: "read", transitioned: true }))
    .where(
      Filing._named({ name: ROOTS.public }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._file({ file }).is({ content }),
    )
    .then(
      Emitting.intend({
        producer: file,
        path,
        content,
        medium: "application/octet-stream",
      }),
    ),
);

export const ParsedContentClearsLayers = reaction(({ subject, root }) =>
  when(Documenting.parse({ subject }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "read", transitioned: true }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: subject }).is({ root }),
    )
    .then(Layering.clear({ subject })),
);

export const ClearedContentGetsDefaults = reaction(
  ({ subject, content, path, index, text, values }) =>
    when(Layering.clear({ subject }).responds({}))
      .where(
        earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "read", transitioned: true }),
        Filing._named({ name: ROOTS.content }).is({ root: content }),
        Filing._file({ file: subject }).is({ root: content, path }),
        Governing._defaults({}).is({ index, text, values }),
        computations.patternHasResult({ pattern: text, path, matched: true }),
      )
      .then(Layering.contribute({ subject, rank: index, values })),
);

export const ClearedContentGetsAttributes = reaction(({ subject, root, attributes }) =>
  when(Layering.clear({ subject }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { name: PHASE_SEQUENCE, phase: "read", transitioned: true }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: subject }).is({ root }),
      Documenting._document({ subject }).is({ attributes }),
    )
    .then(Layering.contribute({ subject, rank: MAX_PAGE_LAYER_RANK, values: attributes })),
);
