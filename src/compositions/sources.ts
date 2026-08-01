import { earlier, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { MAX_PAGE_LAYER_RANK, PATHS, ROOTS } from "./shared.ts";
import { ContentDocumentFile } from "./views.ts";

const { Configuring, Diagnosing, Documenting, Emitting, Filing, Layering, Matching, Phasing, Templating } = conceptRefs;

export const ContentDocumentsParse = reaction(({ file, text }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(ContentDocumentFile({}).is({ file, text }))
    .then(Documenting.parse({ subject: file, text })),
);

/** Front-matter refusals belong to the authored content file, not a derived page. */
export const DocumentParseFailuresDiagnose = reaction(({ file, root, path, detail }) =>
  when(Documenting.parse({ subject: file }).refuses({ error: "MALFORMED_ATTRIBUTES", detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "read" }),
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
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(
      Filing._named({ name: ROOTS.templates }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Templating.define({ name: path, source: text })),
);

export const IncludesDefine = reaction(({ root, file, path, text }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
    .where(
      Filing._named({ name: ROOTS.includes }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Templating.define({ name: path, source: text })),
);

export const TemplateDefinitionFailuresDiagnose = reaction(({ root, file, path, text, error, detail }) =>
  when(Templating.define({ name: path, source: text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "read" }),
      Filing._named({ name: ROOTS.templates }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const IncludeDefinitionFailuresDiagnose = reaction(({ root, file, path, text, error, detail }) =>
  when(Templating.define({ name: path, source: text }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "read" }),
      Filing._named({ name: ROOTS.includes }).is({ root }),
      Filing._under({ root, prefix: "" }).is({ file, path }),
      Filing._text({ file }).is({ text }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);

export const PublicFilesIntendOutput = reaction(({ root, file, path, content }) =>
  when(Phasing.advance({}).responds({ phase: "read" }))
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
      earlier(Phasing.advance, {}, { phase: "read" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: subject }).is({ root }),
    )
    .then(Layering.clear({ subject })),
);

export const ClearedContentGetsDefaults = reaction(
  ({ subject, content, path, configuration, defaults, index, rule, text, pattern, valuesNode, values }) =>
    when(Layering.clear({ subject }).responds({}))
      .where(
        earlier(Phasing.advance, {}, { phase: "read" }),
        Filing._named({ name: ROOTS.content }).is({ root: content }),
        Filing._file({ file: subject }).is({ root: content, path }),
        Configuring._active({}).is({ root: configuration }),
        Configuring._at({ node: configuration, path: PATHS.defaults }).is({ found: defaults }),
        Configuring._items({ node: defaults }).is({ index, item: rule }),
        Configuring._at({ node: rule, path: PATHS.defaultMatch }).is({ value: text }),
        Matching._compiled({ text }).is({ pattern }),
        Matching._matches({ pattern, path }).is({ matched: true }),
        Configuring._at({ node: rule, path: PATHS.defaultValues }).is({ found: valuesNode }),
        Configuring._record({ node: valuesNode }).is({ values }),
      )
      .then(Layering.contribute({ subject, rank: index, values })),
);

export const ClearedContentGetsAttributes = reaction(({ subject, root, attributes }) =>
  when(Layering.clear({ subject }).responds({}))
    .where(
      earlier(Phasing.advance, {}, { phase: "read" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: subject }).is({ root }),
      Documenting._document({ subject }).is({ attributes }),
    )
    .then(Layering.contribute({ subject, rank: MAX_PAGE_LAYER_RANK, values: attributes })),
);
