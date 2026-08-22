import { each, form, former, view, where, whether } from "@mit-sdg/sync-engine/language";
import { concepts as conceptRefs } from "@syncpress/concepts";
import { PARTS, ROOTS } from "./shared.ts";

const {
  Cataloging,
  DependencyTracking,
  Diagnosing,
  Emitting,
  Filing,
  Layering,
  Referencing,
  RenderTracking,
  Routing,
  Templating,
} = conceptRefs;


export const InspectionOwner = view(
  "the inspection owner of target (target)",
  ({ target }, { owner }, { root }) => [
    where(Routing._owner({ address: target }).is({ owner })),
    where(
      Filing._named({ name: ROOTS.content }).is({ root }),
      Filing._at({ root, path: target }).is({ file: owner }),
    ),
  ],
).optional();

const OwnerRouteInspection = former("the route inspection of owner (owner)", ({ owner }, { route }) =>
  form({ route: where(whether(Routing._address({ owner }).is({ address: route }))).form({ address: route }) })
);

const OwnerSourceInspection = former("the source inspection of owner (owner)", ({ owner }, { path, digest }) =>
  form({ source: where(whether(Filing._file({ file: owner }).is({ path, digest }))).form({ path, digest }) })
);

const OwnerTemplateInspection = former(
  "the template inspection of owner (owner)",
  ({ owner }, { name, template, digest, used }) =>
    form({
      template: where(
        whether(RenderTracking._latest({ subject: owner }).is({ template: name })),
        whether(Templating._template({ name }).is({ template, digest })),
      ).form({
        name,
        digest,
        tree: each(Templating._tree({ owner: template }).is({ used })).form({ used }),
      }),
    }),
);

const OwnerLayerInspection = former(
  "the layer inspection of owner (owner)",
  ({ owner }, { layer, rank, values, path, originRank, originLayer }) =>
    form({
      layers: each(Layering._layers({ subject: owner }).is({ layer, rank, values })).form({ layer, rank, values }),
      origins: each(Layering._leafOrigins({ subject: owner }).is({ path, rank: originRank, layer: originLayer })).form({
        path,
        rank: originRank,
        layer: originLayer,
      }),
    }),
);

const OwnerRenderingInspection = former(
  "the rendering inspection of owner (owner)",
  (
    { owner },
    {
      rendering,
      path,
      profile,
      template,
      stage,
      bodySource,
      layoutSource,
      historicalRendering,
      historicalPath,
      historicalProfile,
      historicalTemplate,
      historicalStage,
    },
  ) =>
    form({
      rendering: where(
        whether(RenderTracking._latest({ subject: owner }).is({ rendering, path, profile, template, stage })),
      ).form({
        attempt: rendering,
        path,
        profile,
        template,
        stage,
        body: where(
          whether(Referencing._finished({ subject: rendering, part: PARTS.body }).is({ source: bodySource })),
        ).form({ source: bodySource }),
        layout: where(
          whether(Referencing._finished({ subject: rendering, part: PARTS.layout }).is({ source: layoutSource })),
        ).form({ source: layoutSource }),
      }),
      renderings: each(RenderTracking._all({}).is({
        rendering: historicalRendering,
        subject: owner,
        path: historicalPath,
        profile: historicalProfile,
        template: historicalTemplate,
        stage: historicalStage,
      })).form({
        attempt: historicalRendering,
        path: historicalPath,
        profile: historicalProfile,
        template: historicalTemplate,
        stage: historicalStage,
      }),
    }),
);

const OwnerCatalogInspection = former(
  "the catalog inspection of owner (owner)",
  ({ owner }, { catalog, name, index }) =>
    form({
      memberships: each(Cataloging._membership({ item: owner }).is({ catalog, name }))
        .where(Cataloging._position({ catalog, item: owner }).is({ index }))
        .form({ collection: catalog, name, index }),
    }),
);

const OwnerDependencyInspection = former(
  "the dependency inspection of owner (owner)",
  ({ owner }, { state, reason, input }) =>
    form({
      dependencies: where(
        DependencyTracking._state({ subject: owner }).is({ state }),
        whether(DependencyTracking._reason({ subject: owner }).is({ reason })),
      ).form({
        state,
        reason,
        inputs: each(DependencyTracking._uses({ subject: owner }).is({ input })).form({ input }),
      }),
    }),
);

const OwnerOutputInspection = former(
  "the output inspection of owner (owner)",
  ({ owner }, { path, digest, medium }) =>
    form({
      outputs: each(Emitting._byProducer({ producer: owner }).is({ path, digest, medium })).form({ path, digest, medium }),
    }),
);

const OwnerClaimInspection = former("the claim inspection of owner (owner)", ({ owner }, { address }) =>
  form({ claims: each(Routing._claims({}).is({ owner, address })).form({ owner, address }) })
);

/** Diagnostics are build-wide until reporting records an explicit subject relation. */
const BuildDiagnosticsInspection = former(
  "the build diagnostics inspection",
  (_inputs, { diagnostic, severity, code, message, source, line, column, relatedSource, relatedLine, relatedColumn, note }) =>
    form({
      diagnostics: each(Diagnosing._all({}).is({ diagnostic, severity, code, message, source, line, column })).form({
        diagnostic,
        severity,
        code,
        message,
        source,
        line,
        column,
        related: each(
          Diagnosing._related({ diagnostic }).is({ source: relatedSource, line: relatedLine, column: relatedColumn, note }),
        ).form({ source: relatedSource, line: relatedLine, column: relatedColumn, note }),
      }),
    }),
);

/** Complete inspection data, assembled from small concept-focused fragments. */
export const SiteInspection = former("the site inspection of owner (owner)", ({ owner }) =>
  form({})
    .splicing(OwnerRouteInspection({ owner }))
    .splicing(OwnerSourceInspection({ owner }))
    .splicing(OwnerTemplateInspection({ owner }))
    .splicing(OwnerLayerInspection({ owner }))
    .splicing(OwnerRenderingInspection({ owner }))
    .splicing(OwnerCatalogInspection({ owner }))
    .splicing(OwnerDependencyInspection({ owner }))
    .splicing(OwnerOutputInspection({ owner }))
    .splicing(OwnerClaimInspection({ owner }))
    .splicing(BuildDiagnosticsInspection({}))
);
