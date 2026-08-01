import { earlier, reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concept-set";
import { PARTS, ROOTS } from "./shared.ts";

const { Converting, Diagnosing, Documenting, Filing, Phasing, Rendering, Routing } = conceptRefs;

export const PageExcerptsConvert = reaction(({ page, body, profileName, profile }) =>
  when(Phasing.advance({}).responds({ phase: "excerpt" }))
    .where(
      Routing._claims({}).is({ owner: page }),
      Documenting._document({ subject: page }).is({ body }),
      Rendering._latest({ subject: page }).is({ profile: profileName }),
      Converting._profile({ name: profileName }).is({ profile }),
    )
    .then(Converting.convert({ subject: page, part: PARTS.excerpt, profile, source: body })),
);

export const ExcerptConversionFailuresDiagnose = reaction(({ page, root, path, error, detail }) =>
  when(Converting.convert({ subject: page, part: PARTS.excerpt }).refuses({ error, detail }))
    .where(
      earlier(Phasing.advance, {}, { phase: "excerpt" }),
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._file({ file: page }).is({ root, path }),
    )
    .then(Diagnosing.report({ severity: "error", code: error, message: detail, source: path })),
);
