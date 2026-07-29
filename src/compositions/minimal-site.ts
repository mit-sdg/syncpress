import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concept-set.ts";

const { Composing, Converting, Documenting, Emitting, Filing, Matching, Routing, Templating } = concepts;

const MARKDOWN_PATTERN = "**/*.md";
const PAGE_TEMPLATE_NAME = "page.html";
const PAGE_TEMPLATE = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>{{ page.data.title | default: "Syncpress" }}</title></head>
<body><main>{{ page.content }}</main></body>
</html>
`;

/** Configure the fixed Markdown-to-HTML pipeline and its output destination. */
export const ConfigureSite = endpoint("/site/configure", ({ destination }) =>
  receive({ destination })
    .then(Matching.compile({ text: MARKDOWN_PATTERN }).responds({}))
    .then(
      Converting.declare({
        name: "markdown",
        kind: "markdown",
        extensions: [],
        raw: true,
        separator: "",
      }).responds({}),
    )
    .then(Templating.define({ name: PAGE_TEMPLATE_NAME, source: PAGE_TEMPLATE }).responds({}))
    .then(Emitting.direct({ destination }).responds({}))
    .then(respond({ destination })),
);

/** Publish all completed output intents to the configured destination. */
export const ReconcileSite = endpoint("/site/reconcile", ({ written, replaced, kept, removed }) =>
  receive({})
    .then(Emitting.reconcile({}).responds({ written, replaced, kept, removed }))
    .then(respond({ written, replaced, kept, removed })),
);

export const ChangedMarkdownIsDocumented = reaction(({ file, path, text, pattern }) =>
  when(Filing.place({}).responds({ file, changed: true }))
    .where(
      Filing._file({ file }).is({ path }),
      Filing._text({ file }).is({ text }),
      Matching._compiled({ text: MARKDOWN_PATTERN }).is({ pattern }),
      Matching._matches({ pattern, path }).is({ matched: true }),
    )
    .then(Documenting.parse({ subject: file, text })),
);

export const DocumentIsConverted = reaction(({ subject, body, profile }) =>
  when(Documenting.parse({ subject }).responds({ body }))
    .where(Converting._profile({ name: "markdown" }).is({ profile }))
    .then(Converting.convert({ subject, part: "body", profile, source: body })),
);

export const ConvertedBodyClaimsRoute = reaction(({ subject, path, address }) =>
  when(Converting.convert({ subject, part: "body" }).responds({}))
    .where(
      Filing._file({ file: subject }).is({ path }),
      Routing._derive({ path }).is({ address }),
    )
    .then(Routing.claim({ owner: subject, address })),
);

export const ClaimedRouteClearsContext = reaction(({ owner }) =>
  when(Routing.claim({ owner }).responds({})).then(Composing.clear({ subject: owner, part: "context" })),
);

export const ClearedContextGetsPageData = reaction(({ subject, attributes }) =>
  when(Composing.clear({ subject, part: "context" }).responds({}))
    .where(Documenting._document({ subject }).is({ attributes }))
    .then(Composing.set({ subject, part: "context", path: ["page", "data"], value: attributes })),
);

export const ContextDataGetsURL = reaction(({ subject, url }) =>
  when(Composing.set({ subject, part: "context", path: ["page", "data"] }).responds({}))
    .where(Routing._address({ owner: subject }).is({ url }))
    .then(Composing.set({ subject, part: "context", path: ["page", "url"], value: url })),
);

export const ContextURLGetsContent = reaction(({ subject, output }) =>
  when(Composing.set({ subject, part: "context", path: ["page", "url"] }).responds({}))
    .where(Converting._for({ subject, part: "body" }).is({ output }))
    .then(Composing.set({ subject, part: "context", path: ["page", "content"], value: output })),
);

export const ContextContentIsRendered = reaction(({ subject, context, template }) =>
  when(Composing.set({ subject, part: "context", path: ["page", "content"] }).responds({}))
    .where(
      Composing._record({ subject, part: "context" }).is({ values: context }),
      Templating._template({ name: PAGE_TEMPLATE_NAME }).is({ template }),
    )
    .then(
      Templating.render({
        template,
        subject,
        context,
        trusted: [["page", "content"]],
      }),
    ),
);

export const RenderedPageBeginsEmission = reaction(({ subject, template }) =>
  when(Templating.render({ subject, template }).responds({}))
    .where(Templating._template({ name: PAGE_TEMPLATE_NAME }).is({ template }))
    .then(Emitting.begin({ producer: subject })),
);

export const EmissionBeginsIntent = reaction(({ producer, template, output, address, path }) =>
  when(Emitting.begin({ producer }).responds({}))
    .where(
      Templating._template({ name: PAGE_TEMPLATE_NAME }).is({ template }),
      Templating._rendering({ template, subject: producer }).is({ output }),
      Routing._address({ owner: producer }).is({ address }),
      Routing._file({ address }).is({ path }),
    )
    .then(Emitting.intend({ producer, path, content: output, medium: "text/html" })),
);

export const IntendedPageCommits = reaction(({ producer }) =>
  when(Emitting.intend({ producer }).responds({})).then(Emitting.commit({ producer })),
);
