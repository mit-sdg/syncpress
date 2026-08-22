import { earlier, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concepts";
import { PARTS, PHASE_SEQUENCE, ROOTS } from "./shared.ts";

const { Converting, Diagnosing, DocumentParsing, Filing, Phasing, RenderTracking, Routing } = conceptRefs;

export const PageExcerptsConvert = reaction(({ page, body, profileName, profile }) =>
  when(Phasing.completePhase({}).responds({ name: PHASE_SEQUENCE, phase: "excerpt", transitioned: true }))
    .where(
      Routing._claims({}).is({ owner: page }),
      DocumentParsing._document({ subject: page }).is({ body }),
      RenderTracking._latest({ subject: page }).is({ profile: profileName }),
      Converting._profile({ name: profileName }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.excerpt, profile, source: body })),
);

export const ExcerptConversionFailuresDiagnose = reaction(({ page, root, path, error, detail }) =>
  when(Converting.convert({ subject: page, part: PARTS.excerpt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.completePhase, {}, { name: PHASE_SEQUENCE, phase: "excerpt", transitioned: true }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);
