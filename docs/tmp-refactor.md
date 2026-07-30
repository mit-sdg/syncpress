# Composition Refactor Tracker

This temporary document tracks the refactor intended to make Syncpress's source
smaller and easier to follow without moving application behavior out of
sync-engine composition. Remove it after the work is complete and durable design
decisions have moved into the relevant concept specifications and product docs.

## Goals

- Keep cross-concept behavior in portable, inspectable reactions.
- Preserve or improve occurrence-level observability.
- Replace repeated branch matrices with named views, formers, semantic actions,
  and owner-controlled lifecycle transitions.
- Correlate transient work by exact attempt or work identity rather than by
  repeatedly reconstructing the latest state.
- Keep concepts independent, behaviorally complete, and no more generic than
  their domain permits.
- Reduce authored composition from the current 2,451 physical lines toward
  1,500-1,800 lines without treating line count as the primary design test.

## Constraints

- Do not move the build pipeline into imperative host orchestration merely to
  reduce source size.
- Do not hide domain decisions inside opaque TypeScript helpers.
- Do not create an application-specific `Settings` concept. Settings are
  derived application policy and should be named in composition.
- Keep `Rendering` independent of routing, diagnostics, filing, templating,
  conversion, and emission. It may own rendering-attempt state and rendering
  policy selected from trusted inputs, but it may not read or call peer
  concepts.
- Do not make `Rendering` own canonical URLs or diagnostic source context.
- Do not introduce a concept whose principle requires actions from another
  concept. Workflows belong in reactions.
- Preserve specialized diagnostics where location, related evidence, failure
  durability, or compensation differs from the ordinary refusal policy.
- Run `bun test` and `bun run check`, regenerate artifacts, and review the
  generated read-back after every completed workstream.

## Status Legend

- `[ ]` not started
- `[~]` in progress or under active design
- `[x]` completed
- `[-]` rejected or deliberately deferred

## Baseline

- [x] Created `Rendering` as the owner of rendering attempts, selected profile
  and template names, and the `started -> body-settled -> layout-settled ->
  completed` lifecycle.
- [x] Converged immediate and final body-reference completion through
  `Rendering.settleBody`.
- [x] Converged immediate and final layout-reference completion through
  `Rendering.settleLayout`.
- [x] Added rendering attempts to page inspection.
- [x] Reduced `src/compositions/render.ts` from 450 to 279 lines.
- [x] Reduced total composition from 2,580 to 2,451 lines.
- [x] Reduced generated read-back from 3,124 to 2,999 lines.
- [x] Verified the baseline with 225 passing tests and `bun run check`.

## Design References

Use these sync-engine design tests before introducing or expanding a concept:

- [What a concept is](https://github.com/mit-sdg/sync-engine/blob/main/docs/design/concepts.md)
- [Evaluating a concept](https://github.com/mit-sdg/sync-engine/blob/main/docs/design/evaluating-concepts.md)
- [Choosing granularity](https://github.com/mit-sdg/sync-engine/blob/main/docs/design/granularity.md)
- [State and actions](https://github.com/mit-sdg/sync-engine/blob/main/docs/design/state-and-actions.md)
- [Composing concepts](https://github.com/mit-sdg/sync-engine/blob/main/docs/design/composing-concepts.md)

Important review rules from those documents:

- A concept has one purpose and a principle it can complete using only its own
  actions and state.
- A workflow is not automatically a concept.
- Dense pass-through reactions may reveal a split below a natural boundary or
  a missing semantic action.
- Actions should name meaningful transitions. A generic action plus a literal
  discriminator can hide the event's meaning from readers.
- Once-only, ordering, and stage-transition decisions belong in the action that
  owns the state.
- Named views are the appropriate home for replaceable application policy that
  derives facts owned by several concepts.

## 1. Normalize Settings With Views

**Decision:** use composition views and, where a complete object is needed,
formers. Do not add a `Settings` concept.

Configuration normalization is application-specific derived policy. It has no
independent lifecycle or principle, so a stateful concept would add an owner for
facts already owned by `Configuring` and `Governing`.

Existing views provide a starting point:

- `MarkdownSettings`
- `VerbatimSettings`
- `DefaultPatternSetting`
- `CollectionPatternSetting`
- `CollectionDeclarationSetting`

Planned work:

- [ ] Inventory repeated `Configuring` joins and configured/default branch pairs
  in `settings.ts`, `views.ts`, `images.ts`, and `deployment.ts`.
- [ ] Add a named site-routing settings view for base-path and origin policy.
- [ ] Add a named image settings view for widths, formats, and asset prefix.
- [ ] Replace separate collection pattern/declaration reads with views that
  expose complete normalized declaration rows where cardinality permits.
- [ ] Name complementary present/absent policy views when optional facts such as
  `site.origin` require genuinely different reaction cases.
- [ ] Use formers only when a consequence needs one complete nested value; use
  views for facts that reactions need to join or test.
- [ ] Remove old views after all consumers use the normalized vocabulary.
- [ ] Confirm each view's declared cardinality and absence behavior in generated
  read-back.

Success criteria:

- Reactions in `settings.ts` state cross-concept effects, not YAML traversal.
- Defaults are authored once.
- No new state or concept is introduced.
- Configuration diagnostics retain their existing source locations.

## 2. Carry Rendering Identity End To End

**Decision:** proceed. This is the next implementation workstream.

Transient operations should use the exact rendering attempt as their subject.
The page remains the owner for durable page dependencies, routes, and output
replacement.

Target identity use:

| Behavior | Identity |
| --- | --- |
| Body fill and layout render | Rendering attempt |
| Body and layout conversion/reference scans | Rendering attempt |
| Template failure location for transient work | Rendering attempt |
| Page route | Page |
| Dependency result | Page |
| Output producer/replacement | Page, unless a later design proves attempt ownership is preferable |
| Image source and rendition | Existing image identities |

Planned work:

- [x] Change body `Templating.fill` subjects from page to rendering attempt.
- [x] Change body `Converting.convert` subjects from page to rendering attempt.
- [x] Keep excerpt conversion keyed by page because it creates durable collection-card data.
- [x] Change body and layout `Referencing.scan` subjects from page to rendering
  attempt.
- [x] Change layout `Templating.render` subjects from page to rendering attempt.
- [x] Update context formers to accept a rendering identity and recover the page
  through `Rendering._attempt`.
- [x] Update template-tree dependency tracking to recover the page once from the
  exact attempt.
- [x] Update failure reactions to correlate through `_attempt`, removing
  `_latest` and phase-history joins where they only reconstruct identity.
- [x] Keep `Depending` and `Emitting` keyed by page unless explicit replacement
  and retry semantics justify changing ownership.
- [x] Add tests where a superseded attempt finishes late and prove that it
  cannot settle, emit, or diagnose the newer attempt.
- [x] Add inspection coverage grouping transient operations under the rendering
  identity.

Success criteria:

- Once the pipeline starts, no transient reaction uses `_latest` to discover
  which attempt produced an occurrence.
- A stale occurrence carries its stale attempt identity all the way through.
- Generated read-back exposes the attempt identity at every transient stage.

## 3. Keep Origin Policy Outside Rendering

**Decision:** defer structural changes until the context-former refactor is
complete. `Rendering` must remain independent of routing and site-origin policy.

The current originated/unoriginated split exists because `canonicalUrl` must be
omitted rather than represented as null. That is an output-shaping concern, not
rendering-attempt state.

- [-] Do not store route addresses or canonical URLs in `Rendering`.
- [-] Do not add `originate` or `unoriginate` actions merely to collapse two
  reactions; those actions would describe routing policy rather than a rendering
  lifecycle transition.
- [ ] First factor common context formers as described below.
- [ ] Reassess the remaining two branches after factoring.
- [ ] If omission still forces substantial duplication, investigate an engine
  improvement for conditional former fields or typed optional record splicing.
- [ ] Keep two short, explicit reactions if that is clearer than making the
  concept boundary less coherent.

## 4. Factor Common Context Formers

**Decision:** proceed.

The four page context formers repeat site, collection, layered-data, route, and
source-path reads. Name reusable fragments while preserving the exact context
shape and canonical-key omission.

Planned fragments:

- [ ] A site render facts former containing `site` and `collections`.
- [ ] A page facts former containing layered `data`, source `path`, and route
  `url`.
- [ ] A completed body fragment containing the finished body content.
- [ ] Originated and unoriginated page fragments that differ only in the
  canonical field they legitimately own.
- [ ] Root context formers that compose those fragments rather than restating
  their queries.
- [ ] Replace `as unknown as Record<string, unknown>` where the installed engine
  types permit it; record any remaining casts as an engine ergonomics issue.

Success criteria:

- Shared context fields and reads are declared once.
- Generated endpoint and template context shapes do not change.
- Originated values include `canonicalUrl`, while unoriginated values omit it
  exactly as before.

## 5. Keep Semantic Rendering Stage Actions

**Decision:** do not replace `settleBody` and `settleLayout` with a generic
`settle({ stage })` action at this time.

The engine's action guidance warns that generic verbs plus literal fields hide
the event's meaning from trigger source. These triggers are clearer:

```ts
when(Rendering.settleBody({ rendering }).responds({ transitioned: true }))
when(Rendering.settleLayout({ rendering }).responds({ transitioned: true }))
```

than:

```ts
when(Rendering.settle({ rendering, stage: "body" }).responds({ transitioned: true }))
```

The stages also have different preconditions. Body settlement accepts only a
started attempt; layout settlement requires a settled body. Their shared class
implementation is small and can use a private helper without weakening public
vocabulary.

- [-] Do not add a generic public `settle` action solely to reduce method count.
- [ ] Consider a private transition helper if implementation duplication grows.
- [ ] Revisit only if users understand both transitions as one familiar
  operation and the resulting reaction triggers remain semantic.

## 6. Consolidate Refusal Diagnostics Elegantly

**Decision:** use context-specific refusal funnels, not one unrestricted global
handler and not a diagnostic-context responsibility on `Rendering`.

The installed engine exposes a generic refusal channel:

```ts
refused({
  concept,
  action,
  input,
  refusal,
  message,
}, {
  except,
  exceptBy,
  by,
})
```

The channel can match `concept`, `action`, the whole action `input`, the whole
`refusal`, and the refusal code as `message`. This can eliminate repeated
action-specific shells, but a handler must have an explicit policy boundary.

Planned policy groups:

- Rendering-attempt operations whose input contains `subject: rendering` and
  whose ordinary refusal maps to the page source.
- Deployment-owner or producer operations whose refusal must reject/fail the
  matching deployment work before or while reporting.
- Configuration operations whose ordinary refusal maps to `site.yaml`.

Planned work:

- [ ] Complete rendering-identity propagation first so the generic channel has
  one reliable correlation key.
- [ ] Inventory refusal handlers and classify each as ordinary mapping,
  specialized location, related evidence, compensation, or durable-failure
  handling.
- [ ] Prototype one rendering refusal funnel using `refused(...)`, excluding
  `Diagnosing` and any concept needing specialized handling.
- [ ] Make the funnel's scope explicit with concept/action patterns or a narrow
  input identity convention; do not let future actions silently inherit policy.
- [ ] Use `exceptBy` where a diagnostic reaction could otherwise observe its own
  consequence chain.
- [ ] Retain dedicated Liquid source-location diagnostics.
- [ ] Retain route/output collision diagnostics with related producers.
- [ ] Retain deployment sequences where failure state must become durable before
  diagnostic reporting.
- [ ] Add tests proving no refusal is diagnosed twice and no diagnostic refusal
  loops back into the funnel.
- [ ] If a broad channel is too implicit, fall back to typed reaction factories
  that generate explicit action-specific reactions.

Success criteria:

- Ordinary refusal mapping is authored once per diagnostic context.
- Specialized failure semantics remain visible in dedicated reactions.
- No concept stores a peer's diagnostic source merely for reporting convenience.

## 7. Add Narrow Reaction Factories

**Decision:** proceed after identities and refusal groups are normalized.

Factories are source-authoring helpers, not runtime behavior. They must return
portable reaction definitions whose exported names still appear independently
in generated read-back.

Candidate helpers:

- [ ] Action-specific refusal to source diagnostic.
- [ ] Scan-completed or final-answer-completed adapter to one owner transition.
- [ ] Template-tree dependency tracking.
- [ ] Deployment artifact begin/intend/commit shells after the deployment
  protocol is normalized.

Rules for helpers:

- A helper may remove syntax but may not hide a domain branch or policy choice.
- The exported reaction name must describe the application decision.
- Generated read-back must still show the exact trigger, reads, and consequence.
- Avoid factories whose type parameters and binding bags are harder to
  understand than the repeated code.
- Keep a helper only after at least three genuinely identical uses, unless two
  copies have already drifted in a correctness-sensitive way.

## 8. Refactor Reference Policy Without A New Concept

**Decision:** do not introduce `Resolving` as a concept under the current
design. Use named views and shorter policy reactions instead.

Why the proposed concept currently fails review:

- Its principle would require `Referencing` to discover references, `Routing` to
  classify/retarget them, `Filing` to resolve files, and `Emitting` to stage
  assets. It could not complete its purpose using only its own actions.
- It would primarily represent a workflow, which the design docs place in
  reactions.
- `Referencing` already owns reference identity, answer validity, answer
  replacement, and source-completion state. A second resolution record would
  duplicate or shadow that lifecycle.
- Pass-through reactions from `Resolving.complete` to `Referencing.answer` would
  reassemble one answer operation without adding an independent decision.
- `Referencing` explicitly leaves URL meaning, resource lookup, and image policy
  to composition, which is where Syncpress-specific reference policy belongs.

Planned work:

- [ ] Keep `Referencing` as the sole owner of reference answers and completion.
- [ ] Inventory repeated joins in `references.ts` and `images.ts` by policy case:
  routed page, ordinary copied asset, non-raster image, responsive raster image,
  held nonlocal URL, and invalid local reference.
- [ ] Introduce higher-level views that expose complete facts for each policy
  case rather than making every reaction reconstruct them.
- [ ] Combine ordinary and non-raster copied-asset behavior where one named view
  proves their staging and answering policy is identical.
- [ ] Reuse one copied-asset answer reaction after bytes have been staged.
- [ ] Factor repeated unretargetable-reference diagnostics with a narrow helper
  or shared view.
- [ ] Keep responsive image state in `Transcoding` and `Embedding`.
- [ ] Use rendering identity as the scan subject so body/layout policy cannot
  confuse attempts.
- [ ] Split the source files as described in the organization workstream.

Reconsider a concept only if a future candidate has all of the following:

- A purpose independent of HTML parsing, URL routing, files, and output staging.
- A principle executable using only its own actions.
- State with an invariant not already owned by `Referencing.answer`.
- A lifecycle that another application could use without Syncpress's complete
  reference workflow.

## 9. Normalize Deployment's Worker Protocol

**Decision:** proceed, but review `Deploying` before adding more state or generic
actions.

`deployment.ts` is 537 lines with 56 reactions. `Deploying` already owns the
ordered queue, work identity, and terminal status. The first target is repeated
protocol plumbing, not work-specific preparation policy.

Design questions to settle first:

- Does `dispatch` represent a meaningful observable transition, or is it a
  pass-through action that should be folded into `start`, `complete`, `fail`,
  and rejection transitions?
- Should terminal queue actions atomically select the next work item because
  `Deploying` already owns queue order?
- Can prepared artifact kinds expose one common query shape without replacing
  semantic actions such as `redirect`, `sitemap`, and `feed` with a generic
  action plus kind literals?
- Which failures must mark work failed/rejected before diagnostics are attempted?

Planned work:

- [ ] Review the `Deploying` purpose, principle, state, and all action contracts
  against the reaction-pressure test.
- [ ] Map the queue lifecycle and identify one-to-one pass-through reactions.
- [ ] Decide whether next-work dispatch belongs inside each terminal owner
  action or remains a separately observable action.
- [ ] Define a common prepared-artifact read shape containing work, producer,
  path, content, and medium while retaining semantic preparation actions.
- [ ] Consolidate begin/intend/commit/complete plumbing for nojekyll, redirects,
  pagination pages, sitemap, and feed.
- [ ] Keep work-specific reactions for collection lookup, context formation,
  route claims, reference policy, and domain diagnostics.
- [ ] Preserve the rule that failure/rejection becomes durable before a
  diagnostic failure could leave work publishable.
- [ ] Add tests for queue order, partial failure, rejection, and commit failure
  before changing source organization.

Success criteria:

- Work-specific reactions prepare or validate work; generic reactions handle
  the common artifact protocol.
- Queue order remains owned and enforced by `Deploying`.
- Semantic action names remain visible in triggers.
- Deployment partial-failure behavior is unchanged and documented.

## 10. Split Composition By Domain Story

**Decision:** proceed after behavior-level refactors stabilize. File splitting
alone is not counted as semantic simplification.

Target organization:

```text
src/compositions/rendering/
  lifecycle.ts
  body.ts
  layout.ts
  diagnostics.ts
  index.ts

src/compositions/references/
  views.ts
  documents.ts
  assets.ts
  layouts.ts
  diagnostics.ts
  index.ts

src/compositions/deployment/
  lifecycle.ts
  redirects.ts
  pagination.ts
  sitemap.ts
  feed.ts
  diagnostics.ts
  index.ts
```

Planned work:

- [ ] Split rendering after rendering-identity and context changes settle.
- [ ] Split references after policy views are established.
- [ ] Split deployment after its common worker protocol is established.
- [ ] Keep each file focused on one readable trigger-to-effect story.
- [ ] Preserve stable exported reaction names and review generated read-back for
  accidental renames.
- [ ] Prefer files around 100-200 lines, but do not split one reaction or one
  coherent policy solely to satisfy a line target.

## Proposed Execution Order

1. Carry rendering identity end to end.
2. Factor context formers.
3. Reassess originated/unoriginated context duplication.
4. Normalize settings with views.
5. Prototype rendering refusal handling through the generic refusal channel.
6. Add narrow reaction factories for proven repeated shells.
7. Refactor reference policy with higher-level views, without a new concept.
8. Review and normalize the deployment worker protocol.
9. Split large composition files by domain story.
10. Re-measure source and generated read-back, then remove this tracker after
    durable decisions are documented elsewhere.

## Verification Checklist

Apply this checklist to every workstream:

- [ ] The concept purpose and principle still hold without peer concepts.
- [ ] New actions name semantic transitions rather than generic mutations plus
  literals.
- [ ] Once-only and ordering decisions remain inside their state owner.
- [ ] Reaction names state application decisions.
- [ ] No new reaction merely forwards one concept action to a second action
  without policy, adaptation, or a meaningful lifecycle boundary.
- [ ] Failure and partial-success behavior is explicit.
- [ ] Direct concept tests cover principle, refusals, idempotency, and ordering.
- [ ] Composition tests cover success, absence, refusal, and stale-attempt paths.
- [ ] `bun test` passes.
- [ ] `bun run check` passes.
- [ ] Generated artifacts are pinned and reviewed.
- [ ] Composition LoC, reaction count, and generated read-back size are recorded
  as secondary metrics.
