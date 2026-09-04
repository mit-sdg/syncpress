<!-- Generated from the Syncpress assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.0.0-beta.16; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.0.0-beta.16. -->

# Syncpress — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Cataloging

Defined in [Cataloging](../design/concepts/Cataloging.md), line 1.

#### Actions

- `declare(name: Name, selector: Pattern, direction: Direction, sort: Field | null, condition: Condition | null) : return (catalog: Catalog, changed: Flag)`
  - Refuses `INVALID_TEXT`: Names, selectors, identities, paths, and tiebreaks must be text.
  - Refuses `INVALID_SELECTOR`: A catalog selector must be a valid portable glob.
  - Refuses `INVALID_DIRECTION`: Direction must be asc or desc.
  - Refuses `INVALID_FIELD`: A configured field must use dotted ASCII segments.
  - Refuses `INVALID_CONDITION`: A condition must be null or one supported field predicate.
- `index(catalog: Catalog, item: Item, path: Path, tiebreak: Text, card: Values) : return (entry: Entry, included: Flag, changed: Flag)`
  - Refuses `INVALID_TEXT`: Names, selectors, identities, paths, and tiebreaks must be text.
  - Refuses `CATALOG_NOT_FOUND`: There is no such catalog.
  - Refuses `INVALID_CARD`: A card must be a record of supported values.
- `unindex(catalog: Catalog, item: Item) : return (entry: Entry)`
  - Refuses `INVALID_TEXT`: Names, selectors, identities, paths, and tiebreaks must be text.
  - Refuses `NOT_INCLUDED`: This item is not indexed in that catalog.
- `removeCatalog(name: Name) : return (catalog: Catalog, count: Number)`
  - Refuses `INVALID_TEXT`: Names, selectors, identities, paths, and tiebreaks must be text.
  - Refuses `CATALOG_NOT_FOUND`: There is no such catalog.
- `withdraw(item: Item) : return (item: Item, count: Number)`
  - Refuses `INVALID_TEXT`: Names, selectors, identities, paths, and tiebreaks must be text.
- `reset() : return (count: Number)`

#### Queries

- `_catalogs() : many (catalog: Catalog, name: Name, selector: Pattern, direction: Direction, sort: Field | null, condition: Condition | null)`
- `_named(name: Name) : optional (catalog: Catalog, selector: Pattern, direction: Direction, sort: Field | null, condition: Condition | null)`
- `_entries(catalog: Catalog) : many (entry: Entry, item: Item, card: Values)`
- `_membership(item: Item) : many (entry: Entry, catalog: Catalog, name: Name)`
- `_position(catalog: Catalog, item: Item) : optional (index: Number)`
- `_record() : one (catalogs: Values)`

#### Instances

- `Cataloging` — instance of `Cataloging` — [Syncpress application types and instances](../design/types.md), line 6.

### Commanding

Defined in [Commanding](../design/concepts/Commanding.md), line 1.

#### Actions

- `captureArguments(arguments: Arguments | null) : return (words: Arguments)`
  - Refuses `INVALID_ARGUMENTS`: Arguments must be an ordinary dense list of text values.
  - Refuses `INVOCATION_CAPTURED`: This command invocation already has different words.
- `writeLine(stream: Stream, text: Text) : return (stream: Stream, text: Text)`
  - Refuses `INVALID_STREAM`: A command stream must be output or error.
  - Refuses `INVALID_TEXT`: A command line must be well-formed text.
- `setExitStatus(code: ExitCode) : return (code: ExitCode, changed: Flag)`
  - Refuses `INVALID_EXIT_CODE`: A command exit code must be a safe integer from 0 through 255.
  - Refuses `EXIT_SELECTED`: This command invocation already has another exit status.

#### Queries

- `_invocation() : optional (words: Arguments)`
- `_outcome() : optional (code: ExitCode)`

#### Instances

- `Commanding` — instance of `Commanding` — [Syncpress application types and instances](../design/types.md), line 7.

### Converting

Defined in [Converting](../design/concepts/Converting.md), line 1.

#### Actions

- `declareProfile(name: Name, kind: Kind, extensions: Extensions, raw: Flag, separator: JavaScriptString) : return (profile: Profile, changed: Flag)`
  - Refuses `INVALID_PROFILE`: This rendering profile is malformed.
  - Refuses `UNSUPPORTED_PROFILE_KIND`: This rendering profile kind is not supported.
  - Refuses `UNSUPPORTED_EXTENSION`: This Markdown extension is not supported.
  - Refuses `INCOMPATIBLE_PROFILE`: A verbatim profile requires no extensions and raw true.
- `convert(subject: Subject, part: Part, profile: Profile, source: JavaScriptString) : return (conversion: Conversion, output: JavaScriptString)`
  - Refuses `PROFILE_NOT_FOUND`: There is no such current rendering profile.
  - Refuses `INVALID_CONVERSION_INPUT`: A conversion subject, part, and source must be text.
  - Refuses `CONVERSION_FAILED`: This text could not be converted.
- `removeConversions(subject: Subject) : return (subject: Subject, count: Number)`
  - Refuses `INVALID_SUBJECT`: A conversion subject must be text.

#### Queries

- `_profile(name: Name) : optional (profile: Profile, kind: Kind, extensions: Extensions, raw: Flag, separator: JavaScriptString)`
- `_conversion(conversion: Conversion) : optional (subject: Subject, part: Part, profile: Profile, digest: Digest, output: JavaScriptString)`
- `_for(subject: Subject, part: Part) : optional (conversion: Conversion, profile: Profile, digest: Digest, output: JavaScriptString)`
- `_excerpt(subject: Subject, part: Part) : optional (conversion: Conversion, excerpt: JavaScriptString)`

#### Instances

- `Converting` — instance of `Converting` — [Syncpress application types and instances](../design/types.md), line 8.

### DeliveryArbitration

Defined in [DeliveryArbitration](../design/concepts/DeliveryArbitration.md), line 1.

#### Actions

- `beginDelivery(task: Task) : return (task: Task, changed: Flag)`
  - Refuses `INVALID_TASK`: A delivery task must be a well-formed text identity.
- `recordInterruption(task: Task) : return (task: Task, changed: Flag)`
  - Refuses `INVALID_TASK`: A delivery task must be a well-formed text identity.
- `settle(task: Task) : return (task: Task, interrupted: Flag)`
  - Refuses `INVALID_TASK`: A delivery task must be a well-formed text identity.
  - Refuses `DELIVERY_NOT_ACTIVE`: This task has no active aggregate delivery.

#### Queries

- `_delivery(task: Task) : optional (active: Flag, interrupted: Flag)`

#### Instances

- `DeliveryArbitration` — instance of `DeliveryArbitration` — [Syncpress application types and instances](../design/types.md), line 10.

### DependencyTracking

Defined in [DependencyTracking](../design/concepts/DependencyTracking.md), line 1.

#### Actions

- `beginAttempt(subject: Subject) : return (result: Result, attempt: Number)`
  - Refuses `INVALID_TEXT`: Subjects and inputs must be well-formed text.
  - Refuses `ATTEMPT_EXHAUSTED`: No further computation attempt can be represented.
- `recordDependency(subject: Subject, attempt: Number, input: Input) : return (use: Use)`
  - Refuses `INVALID_TEXT`: Subjects and inputs must be well-formed text.
  - Refuses `NOT_BUILDING`: This result is not being computed.
  - Refuses `STALE_ATTEMPT`: This computation attempt is no longer active.
- `settleAttempt(subject: Subject, attempt: Number) : return (result: Result)`
  - Refuses `INVALID_TEXT`: Subjects and inputs must be well-formed text.
  - Refuses `NOT_BUILDING`: This result is not being computed.
  - Refuses `STALE_ATTEMPT`: This computation attempt is no longer active.
- `abandonAttempt(subject: Subject, attempt: Number) : return (result: Result)`
  - Refuses `INVALID_TEXT`: Subjects and inputs must be well-formed text.
  - Refuses `NOT_BUILDING`: This result is not being computed.
  - Refuses `STALE_ATTEMPT`: This computation attempt is no longer active.
- `invalidate(input: Input) : return (input: Input, count: Number)`
  - Refuses `INVALID_TEXT`: Subjects and inputs must be well-formed text.
- `removeResult(subject: Subject) : return (result: Result)`
  - Refuses `INVALID_TEXT`: Subjects and inputs must be well-formed text.

#### Queries

- `_state(subject: Subject) : one (state: State)`
- `_current(subject: Subject) : optional (result: Result)`
- `_attempt(subject: Subject) : optional (attempt: Number)`
- `_reason(subject: Subject) : optional (reason: Input)`
- `_stale() : many (subject: Subject, reason: Input)`
- `_uses(subject: Subject) : many (input: Input)`
- `_dependents(input: Input) : many (subject: Subject)`

#### Instances

- `DependencyTracking` — instance of `DependencyTracking` — [Syncpress application types and instances](../design/types.md), line 9.

### Deploying

Defined in [Deploying](../design/concepts/Deploying.md), line 1.

#### Actions

- `start(policy: Policy) : return (deployment: Deployment, work?: Work, completed: Flag)`
  - Refuses `INVALID_POLICY`: A deployment policy must have the supported publishing shape.
  - Refuses `DEPLOYMENT_ACTIVE`: A deployment was already started.
- `complete(work: Work) : return (deployment: Deployment, work?: Work, completed: Flag)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
  - Refuses `WORK_NOT_PREPARED`: Deployment work must be prepared before completion.
- `reject(work: Work) : return (deployment: Deployment, work?: Work, completed: Flag)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
- `rejectOwnerWork(owner: Owner) : return (deployment: Deployment, work?: Work, completed: Flag)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
- `rejectProducerWork(producer: Producer) : return (deployment: Deployment, work?: Work, completed: Flag)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
- `expandPagination(deployment: Deployment, work: Work, template: Template, entries: Entries) : return (deployment: Deployment, work: Work, pages: Number)`
  - Refuses `INVALID_ENTRIES`: Deployment entries must be a dense list of structured-cloneable identified cards.
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
- `prepareRedirect(work: Work, target: Url, canonical: Url, content: Text) : return (content: Text)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
  - Refuses `INVALID_REDIRECT`: Redirect preparation requires a valid projection of its configured target.
  - Refuses `INVALID_PREPARATION`: Deployment preparation must match the current work snapshot.
- `preparePageContext(work: Work, context: Value) : return (owner: Owner, template: Template, context: Value)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
  - Refuses `INVALID_CONTEXT`: Deployment context values must be structured-cloneable.
- `snapshotFeed(work: Work, site: Value, entries: Entries) : return (work: Work, path: Path, title: Text | null, description: Text | null, site: Value, entries: Entries)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
  - Refuses `INVALID_ENTRIES`: Deployment entries must be a dense list of structured-cloneable identified cards.
  - Refuses `INVALID_PREPARATION`: Deployment preparation must match the current work snapshot.
- `prepareFeed(work: Work, preparation: Value) : return (path: Path, content: Text, invalid: Number, valid: Flag, origin: Flag)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
  - Refuses `INVALID_PREPARATION`: Deployment preparation must match the current work snapshot.
- `snapshotSitemap(work: Work, urls: Urls) : return (work: Work, path: Path, urls: Urls)`
  - Refuses `INVALID_URLS`: Sitemap URLs must be a dense list of absolute HTTP URL records.
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
- `prepareSitemap(work: Work, content: Text) : return (path: Path, content: Text)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.
  - Refuses `INVALID_PREPARATION`: Deployment preparation must match the current work snapshot.
- `failWork(producer: Producer, path: Path, code: Code, detail: Text) : return (deployment: Deployment, work?: Work, completed: Flag, path: Path, code: Code, message: Text)`
  - Refuses `WORK_NOT_CURRENT`: Deployment work must be the current item.
  - Refuses `WORK_NOT_ACTIVE`: Deployment work must be active before this transition.

#### Queries

- `_work(work: Work) : optional (work: Work, deployment: Deployment, status: WorkStatus, kind: Kind, producer?: Producer, path?: Path, owner?: Owner, from?: Address, to?: Address, name?: Name, collection?: Catalog, perPage?: Number, route?: Address, templateName?: TemplateName, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Cards, sourcePath?: Path, description?: Text)`
- `_forOwner(owner: Owner) : optional (work: Work, deployment: Deployment, status: WorkStatus, kind: Kind, producer?: Producer, path?: Path, owner?: Owner, from?: Address, to?: Address, name?: Name, collection?: Catalog, perPage?: Number, route?: Address, templateName?: TemplateName, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Cards, sourcePath?: Path, description?: Text)`
- `_forProducer(producer: Producer) : optional (work: Work, deployment: Deployment, status: WorkStatus, kind: Kind, producer?: Producer, path?: Path, owner?: Owner, from?: Address, to?: Address, name?: Name, collection?: Catalog, perPage?: Number, route?: Address, templateName?: TemplateName, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Cards, sourcePath?: Path, description?: Text)`
- `_current() : optional (work: Work, deployment: Deployment, status: WorkStatus, kind: Kind, producer?: Producer, path?: Path, owner?: Owner, from?: Address, to?: Address, name?: Name, collection?: Catalog, perPage?: Number, route?: Address, templateName?: TemplateName, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Cards, sourcePath?: Path, description?: Text)`
- `_outcome() : one (state: State)`

#### Instances

- `Deploying` — instance of `Deploying` — [Syncpress application types and instances](../design/types.md), line 13.

### Diagnosing

Defined in [Diagnosing](../design/concepts/Diagnosing.md), line 1.

#### Actions

- `report(scope?: Scope, severity: Severity, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position) : return (diagnostic: Diagnostic)`
  - Refuses `UNKNOWN_SEVERITY`: A diagnostic is an error or a warning.
  - Refuses `INVALID_TEXT`: Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text.
  - Refuses `INVALID_LOCATION`: A location needs a source; line and column must be positive safe integers, and a column needs a line.
- `addRelatedLocation(diagnostic: Diagnostic, source: DiagnosticSource, line?: Position, column?: Position, note: Text) : return (relation: Relation)`
  - Refuses `INVALID_TEXT`: Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text.
  - Refuses `DIAGNOSTIC_NOT_FOUND`: There is no such diagnostic.
  - Refuses `INVALID_LOCATION`: A location needs a source; line and column must be positive safe integers, and a column needs a line.
- `retractGroup(scope?: Scope, source?: DiagnosticSource) : return (scope?: Scope, source?: DiagnosticSource, count: Number)`
  - Refuses `INVALID_TEXT`: Scopes, codes, messages, sources, diagnostic identities, and notes must be well-formed text.
- `clear() : return (count: Number)`

#### Queries

- `_all() : many (diagnostic: Diagnostic, scope?: Scope, severity: Severity, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position)`
- `_errors() : many (diagnostic: Diagnostic, scope?: Scope, code: Code, message: Text, source?: DiagnosticSource, line?: Position, column?: Position)`
- `_for(source?: DiagnosticSource) : many (diagnostic: Diagnostic, scope?: Scope, severity: Severity, code: Code, message: Text, line?: Position, column?: Position)`
- `_related(diagnostic: Diagnostic) : many (source: DiagnosticSource, line?: Position, column?: Position, note: Text)`
- `_rendered() : one (text: Text)`
- `_clean() : one (clean: Flag)`

#### Instances

- `Diagnosing` — instance of `Diagnosing` — [Syncpress application types and instances](../design/types.md), line 11.

### DocumentParsing

Defined in [DocumentParsing](../design/concepts/DocumentParsing.md), line 1.

#### Actions

- `parseDocument(subject: Subject, text: Text) : return (document: Document, attributes: Values, body: Text)`
  - Refuses `MALFORMED_ATTRIBUTES`: The attributes at the top of this document cannot be parsed.
- `removeDocument(subject: Subject) : return (document: Document)`
  - Refuses `DOCUMENT_NOT_FOUND`: There is no document for this subject.

#### Queries

- `_document(subject: Subject) : optional (document: Document, attributes: Values, body: Text, bodyLine: Number)`
- `_all() : many (document: Document, subject: Subject)`

#### Instances

- `DocumentParsing` — instance of `DocumentParsing` — [Syncpress application types and instances](../design/types.md), line 12.

### Embedding

Defined in [Embedding](../design/concepts/Embedding.md), line 1.

#### Actions

- `declare(subject: Subject, alternative: Text, width: PositiveInteger, height: PositiveInteger, expects: NonnegativeInteger, original: Address, originalFormat: Format, attributes: Attributes) : return (embedding: Embedding, changed: Flag, completed: Flag)`
  - Refuses `INVALID_TEXT`: Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character.
  - Refuses `INVALID_DIMENSION`: Intrinsic width and height must be positive safe integers.
  - Refuses `INVALID_COUNT`: Expected offer count must be a nonnegative safe integer.
  - Refuses `INVALID_ADDRESS`: Image addresses must be safe site-absolute srcset addresses.
  - Refuses `INVALID_FORMAT`: Image format must be one of the canonical supported formats.
  - Refuses `INVALID_ATTRIBUTES`: Image attributes must be a plain record of text attributes.
- `provideCandidate(embedding: Embedding, address: Address, format: Format, width: PositiveInteger, order: NonnegativeInteger) : return (offer: Offer, embedding: Embedding, arrived: Number, changed: Flag, completed: Flag)`
  - Refuses `INVALID_TEXT`: Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character.
  - Refuses `EMBEDDING_NOT_FOUND`: There is no such embedding.
  - Refuses `INVALID_ADDRESS`: Image addresses must be safe site-absolute srcset addresses.
  - Refuses `INVALID_FORMAT`: Image format must be one of the canonical supported formats.
  - Refuses `INVALID_WIDTH`: Offer width must be a positive safe integer no greater than the intrinsic width.
  - Refuses `INVALID_ORDER`: Offer order must be a nonnegative safe integer.
  - Refuses `EMBEDDING_COMPLETE`: A completed embedding cannot accept a changed or additional offer.
  - Refuses `OFFER_CONFLICT`: An address or format-width candidate is already used by this embedding.
- `withdraw(subject: Subject) : return (embedding: Embedding, count: Number)`
  - Refuses `INVALID_TEXT`: Subjects, identities, and alternative text must be well-formed text; alternative text must contain no null character.
  - Refuses `EMBEDDING_NOT_FOUND`: There is no such embedding.

#### Queries

- `_embedding(embedding: Embedding) : optional (subject: Subject, original: Address, originalFormat: Format, expects: NonnegativeInteger, arrived: NonnegativeInteger, complete: Flag)`
- `_for(subject: Subject) : optional (embedding: Embedding, original: Address, originalFormat: Format, expects: NonnegativeInteger, arrived: NonnegativeInteger, complete: Flag)`
- `_offers(embedding: Embedding) : many (offer: Offer, address: Address, format: Format, width: PositiveInteger, order: NonnegativeInteger)`
- `_markup(embedding: Embedding) : optional (markup: Text)`

#### Instances

- `Embedding` — instance of `Embedding` — [Syncpress application types and instances](../design/types.md), line 14.

### Emitting

Defined in [Emitting](../design/concepts/Emitting.md), line 1.

#### Actions

- `configureDestination(destination: Root, prefix: Root) : return (destination: Root, existing: Number)`
  - Refuses `INVALID_DESTINATION`: A destination must name a directory other than the filesystem root.
  - Refuses `DESTINATION_UNAVAILABLE`: The destination could not be inspected.
- `beginAttempt(producer: Producer) : return (producer: Producer, attempt: Number)`
  - Refuses `INVALID_PRODUCER`: A producer identity must be well-formed text.
  - Refuses `ATTEMPT_EXHAUSTED`: This producer has no remaining safe attempt number.
- `intend(producer: Producer, attempt?: Number, path: Path, content: Content, medium: Medium, claim?: Text | null) : return (intent: Intent, path: Path, digest: Digest)`
  - Refuses `STALE_ATTEMPT`: This producer attempt is no longer active.
  - Refuses `INVALID_PRODUCER`: A producer identity must be well-formed text.
  - Refuses `INVALID_CLAIM`: An artifact claim identity must be well-formed text.
  - Refuses `PATH_LEAVES_DESTINATION`: An artifact path must stay inside the destination.
  - Refuses `INVALID_PATH`: An artifact path must use the canonical portable form.
  - Refuses `INVALID_CONTENT`: Artifact content must be bytes or well-formed text.
  - Refuses `INVALID_MEDIUM`: An artifact medium must be well-formed text.
  - Refuses `PATH_CONTESTED`: This artifact path conflicts with another intended artifact.
- `commitAttempt(producer: Producer, attempt: Number) : return (producer: Producer, dropped: Number)`
  - Refuses `INVALID_PRODUCER`: A producer identity must be well-formed text.
  - Refuses `NOT_BEGUN`: This producer has no open attempt.
  - Refuses `STALE_ATTEMPT`: This producer attempt is no longer active.
- `abortAttempt(producer: Producer, attempt: Number) : return (producer: Producer, discarded: Number)`
  - Refuses `INVALID_PRODUCER`: A producer identity must be well-formed text.
  - Refuses `NOT_BEGUN`: This producer has no open attempt.
  - Refuses `STALE_ATTEMPT`: This producer attempt is no longer active.
- `retractProducer(producer: Producer) : return (producer: Producer, count: Number)`
  - Refuses `INVALID_PRODUCER`: A producer identity must be well-formed text.
- `reconcile() : return (written: Number, replaced: Number, kept: Number, removed: Number)`
  - Refuses `DESTINATION_NOT_DIRECTED`: No destination has been directed.
  - Refuses `RECONCILIATION_FAILED`: The intended destination tree could not be installed.

#### Queries

- `_intent(path: Path) : optional (digest: Digest, medium: Medium)`
- `_producers(path: Path) : many (producer: Producer)`
- `_byProducer(producer: Producer) : many (path: Path, digest: Digest, medium: Medium)`
- `_attempt(producer: Producer) : optional (attempt: Number)`
- `_open(producer: Producer) : optional (attempt: Number)`
- `_pending() : many (path: Path, digest: Digest)`
- `_orphans() : many (path: ObservedPath)`

#### Instances

- `Emitting` — instance of `Emitting` — [Syncpress application types and instances](../design/types.md), line 15.

### Filing

Defined in [Filing](../design/concepts/Filing.md), line 1.

#### Actions

- `replaceTreeFromFile(name: Name, source: HostPath, path: Path) : return (status: Status, root?: Root, file?: File, digest?: Digest, count?: Number, changed?: Flag, code?: Code, detail?: Text)`
  - Refuses `INVALID_SOURCE`: A host load needs well-formed, non-empty name and source text.
  - Refuses `PATH_LEAVES_ROOT`: A file path must stay inside its root.
  - Refuses `INVALID_PATH`: A file path must use the canonical portable form.
- `replaceTreeFromDirectory(name: Name, directory: HostPath) : return (status: Status, root?: Root, count?: Number, changed?: Flag, code?: Code, detail?: Text)`
  - Refuses `INVALID_SOURCE`: A host load needs well-formed, non-empty name and source text.
- `ensureRoot(name: Name) : return (root: Root)`
- `putFile(root: Root, path: Path, content: Bytes) : return (file: File, digest: Digest, changed: Flag)`
  - Refuses `ROOT_NOT_FOUND`: There is no such root.
  - Refuses `PATH_LEAVES_ROOT`: A file path must stay inside its root.
  - Refuses `INVALID_PATH`: A file path must use the canonical portable form.
- `putBase64File(root: Root, path: Path, encoded: Text) : return (file: File, digest: Digest, changed: Flag)`
  - Refuses `INVALID_ENCODING`: Staged file content must use canonical Base64.
  - Refuses `ROOT_NOT_FOUND`: There is no such root.
  - Refuses `PATH_LEAVES_ROOT`: A file path must stay inside its root.
  - Refuses `INVALID_PATH`: A file path must use the canonical portable form.
- `discard(file: File) : return (root: Root, path: Path, name: Segment)`
  - Refuses `FILE_NOT_FOUND`: There is no such file.

#### Queries

- `_root(root: Root) : optional (name: Name)`
- `_named(name: Name) : optional (root: Root)`
- `_file(file: File) : optional (root: Root, path: Path, name: Segment, content: Bytes, digest: Digest)`
- `_text(file: File) : optional (text: Text)`
- `_at(root: Root, path: Path) : optional (file: File, digest: Digest)`
- `_files() : many (file: File, root: Root, path: Path)`
- `_under(root: Root, prefix: Directory) : many (file: File, path: Path, digest: Digest)`
- `_resolve(file: File, address: Address) : optional (target: File, path: Path)`
- `_resolution(file: File, address: Address) : one (status: ResolutionStatus)`

#### Instances

- `Filing` — instance of `Filing` — [Syncpress application types and instances](../design/types.md), line 16.

### Governing

Defined in [Governing](../design/concepts/Governing.md), line 1.

#### Actions

- `assess(source: Text) : return (policy: Policy, sources: Values)`
  - Refuses `INVALID_CONFIGURATION`: The assessed site configuration is invalid.

#### Queries

- `_policy() : optional (policy: Policy)`
- `_paths() : optional (content: Path, templates: Path, public: Path, assets: Path, output: Path)`
- `_sources() : many (name: Name, path: Path)`
- `_site() : optional (site: Values, base: Address)`
- `_origin() : optional (origin: Origin)`
- `_markdown() : optional (extensions: Values, raw: Flag, separator: Text)`
- `_images() : optional (widths: Values, formats: Values)`
- `_defaults() : many (index: Number, text: Text, values: Values)`
- `_collections() : many (name: Name, match: Text, direction: Direction, sort: Field | null, condition: Condition | null)`
- `_deployment() : optional (nojekyll: Flag, requireNotFound: Flag, sitemap: Flag)`
- `_publishing() : optional (policy: Policy)`
- `_problems() : many (code: Code, message: Text, line: Number, column: Number)`

#### Instances

- `Governing` — instance of `Governing` — [Syncpress application types and instances](../design/types.md), line 17.

### Holding

Defined in [Holding](../design/concepts/Holding.md), line 1.

#### Actions

- `awaitStop() : return (hold: Hold, reason: Reason)`

#### Queries

- `_hold(hold: Hold) : optional (state: State, reason: Reason | null)`
- `_holding() : one (holding: NonnegativeInteger)`

#### Instances

- `Holding` — instance of `Holding` — [Syncpress application types and instances](../design/types.md), line 18.

### Layering

Defined in [Layering](../design/concepts/Layering.md), line 1.

#### Actions

- `contribute(subject: Subject, rank: Number, values: Values) : return (layer: Layer)`
  - Refuses `INVALID_RANK`: A layer rank must be a finite number.
  - Refuses `INVALID_VALUES`: A layer contribution must be a finite JSON-like record.
  - Refuses `RANK_TAKEN`: This record already has a contribution at this rank.
- `withdraw(subject: Subject, rank: Number) : return (layer: Layer)`
  - Refuses `INVALID_RANK`: A layer rank must be a finite number.
  - Refuses `NO_SUCH_LAYER`: This record has no contribution at this rank.
- `clear(subject: Subject) : return (subject: Subject, count: Number)`

#### Queries

- `_resolved(subject: Subject) : one (values: Values)`
- `_value(subject: Subject, path: Keys) : optional (value: Value)`
- `_flag(subject: Subject, path: Keys, otherwise: Flag) : one (value: Flag)`
- `_equal(subject: Subject, path: Keys, value: Value) : one (present: Flag, equal: Flag)`
- `_origin(subject: Subject, path: Keys) : optional (rank: Number, layer: Layer)`
- `_leafOrigins(subject: Subject) : many (path: Keys, rank: Number, layer: Layer)`
- `_layers(subject: Subject) : many (layer: Layer, rank: Number, values: Values)`

#### Instances

- `Layering` — instance of `Layering` — [Syncpress application types and instances](../design/types.md), line 19.

### Locating

Defined in [Locating](../design/concepts/Locating.md), line 1.

#### Actions

- `recordRequest(name: Name, path: Text) : return (name: Name, path: Text)`
  - Refuses `INVALID_LOCATION`: A location must be well-formed, non-empty text.
- `establishBase(path: Text) : return (status: Status, path?: Path, real?: Path, code?: Code, detail?: Text)`
  - Refuses `INVALID_LOCATION`: A location must be well-formed, non-empty text.
- `inspectLocation(name: Name, path: Text) : return (status: Status, place?: Place, path?: Path, real?: Path, contained?: Flag, resolved?: Flag, code?: Code, detail?: Text)`
  - Refuses `NOT_GROUNDED`: No base directory has been grounded.
  - Refuses `INVALID_LOCATION`: A location must be well-formed, non-empty text.

#### Queries

- `_requested(name: Name) : optional (path: Text)`
- `_base() : optional (path: Path, real: Path)`
- `_place(place: Place) : optional (name: Name, path: Path, real: Path, contained: Flag, resolved: Flag)`
- `_named(name: Name) : optional (place: Place)`
- `_overlapping(place: Place, other: Place) : one (overlapping: Flag)`

#### Instances

- `Locating` — instance of `Locating` — [Syncpress application types and instances](../design/types.md), line 20.

### Phasing

Defined in [Phasing](../design/concepts/Phasing.md), line 1.

#### Actions

- `declare(name: Name, phases: Phases) : return (sequence: Sequence, changed: Flag)`
  - Refuses `INVALID_TEXT`: Sequence names and failure reasons must be well-formed text.
  - Refuses `INVALID_PHASES`: Phases must be an ordinary dense list of text values.
  - Refuses `NO_PHASES`: A sequence needs at least one phase.
  - Refuses `PHASE_REPEATED`: A phase may occur only once in a sequence.
- `start(sequence: Sequence) : return (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)`
  - Refuses `SEQUENCE_NOT_FOUND`: There is no such sequence.
  - Refuses `SEQUENCE_ACTIVE`: This sequence already has a running job.
- `completePhase(job: Job, attempt: PhaseAttempt) : return (job: Job, name: Name, phase: Phase | null, attempt: PhaseAttempt | null, transitioned: Flag)`
  - Refuses `JOB_NOT_RUNNING`: This job is not running.
  - Refuses `STALE_ATTEMPT`: This phase attempt is not current.
- `abandon(job: Job, attempt: PhaseAttempt, reason: Text) : return (job: Job, reason: Text)`
  - Refuses `JOB_NOT_RUNNING`: This job is not running.
  - Refuses `STALE_ATTEMPT`: This phase attempt is not current.
  - Refuses `INVALID_TEXT`: Sequence names and failure reasons must be well-formed text.

#### Queries

- `_job(job: Job) : optional (sequence: Sequence, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)`
- `_running(sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt)`
- `_latest(sequence: Sequence) : optional (job: Job, name: Name, phase: Phase, attempt: PhaseAttempt, state: State)`
- `_outcome(job: Job) : optional (state: State, reason?: Text)`

#### Instances

- `Phasing` — instance of `Phasing` — [Syncpress application types and instances](../design/types.md), line 21.

### Referencing

Defined in [Referencing](../design/concepts/Referencing.md), line 1.

#### Actions

- `scan(subject: Subject, part: Part, text: Text) : return (source: Source, count: Number, replaced: Flag, completed: Flag)`
  - Refuses `INVALID_TEXT`: Subjects, parts, identities, HTML, and answers must be well-formed text.
- `resolve(reference: Reference, form: Form, value: Text) : return (reference: Reference, source: Source, subject: Subject, part: Part, changed: Flag, completed: Flag)`
  - Refuses `INVALID_TEXT`: Subjects, parts, identities, HTML, and answers must be well-formed text.
  - Refuses `INVALID_FORM`: Answer form must be address or markup.
  - Refuses `REFERENCE_NOT_FOUND`: There is no such reference.
  - Refuses `SOURCE_FINISHED`: A finished source cannot accept a changed answer.
  - Refuses `UNREPRESENTABLE_ADDRESS`: This address cannot be represented as one HTML reference.
  - Refuses `OVERLAPPING_MARKUP`: A markup answer overlaps another markup answer.
- `drop(subject: Subject, part: Part) : return (source: Source, count: Number, dropped: Flag)`
  - Refuses `INVALID_TEXT`: Subjects, parts, identities, HTML, and answers must be well-formed text.

#### Queries

- `_source(source: Source) : optional (subject: Subject, part: Part)`
- `_reference(reference: Reference) : optional (reference: Reference, source: Source, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)`
- `_references(source: Source) : many (reference: Reference, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)`
- `_unanswered(source: Source) : many (reference: Reference, raw: Address, kind: Kind, role: Role, tag: Tag, attribute: Attribute, element: Element, slot: Slot, index: NonnegativeInteger, label: Text, line: PositiveInteger, column: PositiveInteger, attributes?: Attributes)`
- `_finished(subject: Subject, part: Part) : optional (source: Source, text: Text)`

#### Instances

- `Referencing` — instance of `Referencing` — [Syncpress application types and instances](../design/types.md), line 22.

### RenderTracking

Defined in [RenderTracking](../design/concepts/RenderTracking.md), line 1.

#### Actions

- `begin(subject: Subject, path: Path, profile: Profile, template: TemplateName, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger) : return (rendering: Rendering, subject: Subject, profile: Profile, template: TemplateName, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`
  - Refuses `INVALID_TEXT`: Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text.
  - Refuses `INVALID_ATTEMPT`: Rendering attempts require valid dependency and emission attempt identities.
  - Refuses `STALE_ATTEMPT`: This rendering owner-attempt pair is stale or inconsistent.
- `completeBody(rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)`
  - Refuses `RENDERING_NOT_FOUND`: There is no such rendering attempt.
- `completeLayout(rendering: Rendering) : return (rendering: Rendering, subject: Subject, transitioned: Flag)`
  - Refuses `RENDERING_NOT_FOUND`: There is no such rendering attempt.
  - Refuses `STAGE_NOT_READY`: The rendering attempt has not reached the required stage.
- `fail(rendering: Rendering, reason: Text) : return (rendering: Rendering, subject: Subject, transitioned: Flag)`
  - Refuses `RENDERING_NOT_FOUND`: There is no such rendering attempt.
  - Refuses `INVALID_TEXT`: Rendering subjects, paths, profile names, template names, and failure reasons must be well-formed text.

#### Queries

- `_attempt(rendering: Rendering) : optional (subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure?: Text, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`
- `_active(rendering: Rendering) : optional (subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure?: Text, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`
- `_latest(subject: Subject) : optional (rendering: Rendering, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure?: Text, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`
- `_all() : many (rendering: Rendering, subject: Subject, path: Path, profile: Profile, template: TemplateName, stage: Stage, failure?: Text, dependencyAttempt: PositiveInteger, emissionAttempt: PositiveInteger)`

#### Instances

- `RenderTracking` — instance of `RenderTracking` — [Syncpress application types and instances](../design/types.md), line 23.

### Routing

Defined in [Routing](../design/concepts/Routing.md), line 1.

#### Actions

- `claim(owner: Owner, address: Address) : return (claim: Claim, address: Address, changed: Flag)`
  - Refuses `INVALID_OWNER`: An owner must be a well-formed text identity.
  - Refuses `INVALID_ADDRESS`: An address must be a canonical site-absolute path.
  - Refuses `ADDRESS_TAKEN`: Another owner has already claimed this address.
- `release(owner: Owner) : return (claim: Claim, address: Address)`
  - Refuses `INVALID_OWNER`: An owner must be a well-formed text identity.
  - Refuses `NOT_CLAIMED`: This owner has claimed no address.

#### Queries

- `_address(owner: Owner) : optional (address: Address)`
- `_owner(address: Address) : optional (owner: Owner)`
- `_claims() : many (owner: Owner, address: Address)`

#### Instances

- `Routing` — instance of `Routing` — [Syncpress application types and instances](../design/types.md), line 24.

### Serving

Defined in [Serving](../design/concepts/Serving.md), line 1.

#### Actions

- `open(host: Text, port: Port) : return (server: Server, host: Text, port: Port)`
  - Refuses `INVALID_SERVER`: A server needs a host and a port between 0 and 65535.
  - Refuses `ADDRESS_UNAVAILABLE`: This address could not be listened on.
- `serveDirectory(server: Server, directory: Path) : return (server: Server, directory: Path, readers: Number)`
  - Refuses `SERVER_NOT_OPEN`: There is no such open server.
  - Refuses `INVALID_PUBLICATION`: A publication needs a well-formed, non-empty directory path.
  - Refuses `PUBLICATION_UNAVAILABLE`: This published directory could not be served.
- `close(server: Server) : return (server: Server)`
  - Refuses `SERVER_NOT_FOUND`: There is no such server.
  - Refuses `SERVER_CLOSE_FAILED`: This server could not be closed.

#### Queries

- `_server(server: Server) : optional (host: Text, port: Port, state: State, directory: Path | null)`
- `_readers(server: Server) : one (readers: Number)`

#### Instances

- `Serving` — instance of `Serving` — [Syncpress application types and instances](../design/types.md), line 25.

### Templating

Defined in [Templating](../design/concepts/Templating.md), line 1.

#### Actions

- `define(name: Name, source: JavaScriptString) : return (template: Template, changed: Flag)`
  - Refuses `TEMPLATE_NAME_TAKEN`: Another source already owns this template name.
  - Refuses `TEMPLATE_SYNTAX`: This Liquid template cannot be parsed.
  - Refuses `UNSUPPORTED_TEMPLATE`: This Liquid feature is unsupported because its dependencies or escaping cannot be determined.
- `register(name: Name, source: JavaScriptString, origin: Origin) : return (template: Template, changed: Flag)`
  - Refuses `INVALID_TEMPLATE_ORIGIN`: A template origin must be well-formed text.
  - Refuses `TEMPLATE_NAME_TAKEN`: Another source already owns this template name.
  - Refuses `TEMPLATE_SYNTAX`: This Liquid template cannot be parsed.
  - Refuses `UNSUPPORTED_TEMPLATE`: This Liquid feature is unsupported because its dependencies or escaping cannot be determined.
- `forget(name: Name) : return (template: Template)`
  - Refuses `TEMPLATE_NOT_FOUND`: There is no such template.
- `renderSource(subject: Subject, source: JavaScriptString, context: Values, trusted: Paths, sourceName?: Name, sourceLine?: PositiveInteger) : return (filling: Filling, output: JavaScriptString)`
  - Refuses `TEMPLATE_SYNTAX`: This Liquid template cannot be parsed.
  - Refuses `UNSUPPORTED_TEMPLATE`: This Liquid feature is unsupported because its dependencies or escaping cannot be determined.
  - Refuses `INVALID_TRUSTED_PATH`: A trusted path must contain one or more literal string segments.
  - Refuses `INVALID_TRUSTED_VALUE`: A trusted path must name a string in the supplied context.
  - Refuses `USED_TEMPLATE_NOT_FOUND`: A rendered template is not defined.
  - Refuses `RECURSIVE_TEMPLATE`: The template dependency tree is recursive.
  - Refuses `UNDEFINED_VARIABLE`: This Liquid template reads a context value that is not defined.
  - Refuses `TEMPLATE_FAILED`: This Liquid template could not be evaluated.
- `renderTemplate(template: Template, subject: Subject, context: Values, trusted: Paths) : return (rendering: Rendering, output: JavaScriptString)`
  - Refuses `TEMPLATE_NOT_FOUND`: There is no such template.
  - Refuses `INVALID_TRUSTED_PATH`: A trusted path must contain one or more literal string segments.
  - Refuses `INVALID_TRUSTED_VALUE`: A trusted path must name a string in the supplied context.
  - Refuses `USED_TEMPLATE_NOT_FOUND`: A rendered template is not defined.
  - Refuses `RECURSIVE_TEMPLATE`: The template dependency tree is recursive.
  - Refuses `UNDEFINED_VARIABLE`: This Liquid template reads a context value that is not defined.
  - Refuses `TEMPLATE_FAILED`: This Liquid template could not be evaluated.

#### Queries

- `_template(name: Name) : optional (template: Template, digest: Digest)`
- `_uses(owner: Owner) : many (used: Name)`
- `_tree(owner: Owner) : many (used: Name)`
- `_usedBy(name: Name) : many (owner: Owner)`
- `_reads(owner: Owner) : many (path: Keys)`
- `_failure(subject: Subject) : optional (code: Code, templateName?: Name, line?: PositiveInteger, column?: PositiveInteger)`
- `_failureLocation(subject: Subject, fallbackSource: DiagnosticSource) : optional (source: DiagnosticSource, line?: PositiveInteger, column?: PositiveInteger)`
- `_filling(subject: Subject) : optional (filling: Filling, output: JavaScriptString)`
- `_rendering(template: Template, subject: Subject) : optional (rendering: Rendering, output: JavaScriptString)`
- `_of(rendering: Rendering) : optional (template: Template, subject: Subject, output: JavaScriptString)`

#### Instances

- `Templating` — instance of `Templating` — [Syncpress application types and instances](../design/types.md), line 26.

### Transcoding

Defined in [Transcoding](../design/concepts/Transcoding.md), line 1.

#### Actions

- `ingest(subject: Subject, content: Bytes) : return (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag, changed: Flag)`
  - Refuses `INVALID_SUBJECT`: An image subject must be well-formed text.
  - Refuses `UNREADABLE_IMAGE`: These bytes are not a fully readable image.
  - Refuses `UNSUPPORTED_SOURCE_FORMAT`: The source image format is not supported.
- `generateRenditions(original: Original, widths: Widths, formats: Formats) : return (original: Original, count: Number, derived: Number, changed: Flag)`
  - Refuses `ORIGINAL_NOT_FOUND`: There is no such image.
  - Refuses `INVALID_WIDTHS`: Widths must be positive safe integers.
  - Refuses `UNSUPPORTED_FORMAT`: A rendition format is unsupported or unavailable.
  - Refuses `RENDITION_FAILED`: A requested image rendition could not be produced.
- `removeSource(subject: Subject) : return (subject: Subject, count: Number)`
  - Refuses `INVALID_SUBJECT`: An image subject must be well-formed text.

#### Queries

- `_original(subject: Subject) : optional (original: Original, digest: Digest, format: Format, width: Number, height: Number, animated: Flag)`
- `_renditions(original: Original) : many (rendition: Rendition, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag, content: Bytes)`
- `_rendition(rendition: Rendition) : optional (original: Original, width: Number, height: Number, format: Format, animated: Flag, order: Number, digest: Digest, extension: Extension, name: Name, mediaType: MediaType, fallback: Flag)`

#### Instances

- `Transcoding` — instance of `Transcoding` — [Syncpress application types and instances](../design/types.md), line 27.

### Watching

Defined in [Watching](../design/concepts/Watching.md), line 1.

#### Actions

- `open(directory: Path, settling: Duration, excluded: Path, prefix: Path) : return (watch: Watch)`
  - Refuses `INVALID_WATCH`: A watch needs a directory and a positive settling duration.
  - Refuses `DIRECTORY_MISSING`: This required directory is missing.
  - Refuses `DIRECTORY_UNSUPPORTED`: This required location must be a directory that is not a symbolic link.
  - Refuses `DIRECTORY_UNOBSERVABLE`: This directory could not be observed.
- `waitForChange(watch: Watch, within: Duration) : return (changed: Flag, watching: Flag)`
  - Refuses `WATCH_NOT_FOUND`: There is no such watch.
  - Refuses `INVALID_WATCH`: A watch needs a directory and a positive settling duration.
  - Refuses `WATCH_FAILED`: The host watch stopped unexpectedly.
- `close(watch: Watch) : return (watch: Watch)`
  - Refuses `WATCH_NOT_FOUND`: There is no such watch.

#### Queries

- `_watch(watch: Watch) : optional (directory: Path, settling: Duration, state: State)`
- `_excluded(watch: Watch) : many (path: Path)`
- `_open() : many (watch: Watch)`

#### Instances

- `Watching` — instance of `Watching` — [Syncpress application types and instances](../design/types.md), line 28.

## Computations

- `absoluteReferenceAddress(target: Value) : Value` — [Syncpress application composition](../design/application.md), line 259.
- `absoluteReferenceOutputPath(target: Value) : Value` — [Syncpress application composition](../design/application.md), line 262.
- `absoluteReferencePath(target: Value) : Value` — [Syncpress application composition](../design/application.md), line 265.
- `addressOutputPath(address: Value) : Value` — [Syncpress application composition](../design/application.md), line 268.
- `deploymentFeedPreparation(path: Value, title: Value, description: Value, site: Value, entries: Value) : Value` — [Syncpress application composition](../design/application.md), line 271.
- `deploymentPaginationContext(site: Value, collections: Value, address: Value, canonicalUrl: Value, sourcePath: Value, title: Value, collection: Value, number: Value, pages: Value, cards: Value, previous: Value, next: Value) : Value` — [Syncpress application composition](../design/application.md), line 274.
- `deploymentRedirectDocument(target: Value, canonical: Value) : Value` — [Syncpress application composition](../design/application.md), line 277.
- `deploymentSitemapDocument(urls: Value) : Value` — [Syncpress application composition](../design/application.md), line 280.
- `deploymentTransitionCompleted(action: Value, result: Value) : Value` — [Syncpress application composition](../design/application.md), line 283.
- `deploymentTransitionWork(action: Value, result: Value) : Value` — [Syncpress application composition](../design/application.md), line 286.
- `deriveAddress(path: Value) : Value` — [Syncpress application composition](../design/application.md), line 289.
- `directoryPath(path: Value) : Value` — [Syncpress application composition](../design/application.md), line 292.
- `isAbsentValue(value: Value) : Value` — [Syncpress application composition](../design/application.md), line 295.
- `isTextValue(value: Value) : Value` — [Syncpress application composition](../design/application.md), line 298.
- `joinPath(prefix: Value, name: Value) : Value` — [Syncpress application composition](../design/application.md), line 301.
- `outputPathAddress(path: Value) : Value` — [Syncpress application composition](../design/application.md), line 304.
- `pageRenderingError(path: Value, data: Value) : Value` — [Syncpress application composition](../design/application.md), line 307.
- `pageRenderingErrorDetail(path: Value, data: Value) : Value` — [Syncpress application composition](../design/application.md), line 310.
- `pageRenderingProfile(path: Value, data: Value) : Value` — [Syncpress application composition](../design/application.md), line 313.
- `pageRenderingSelectionHasValidity(path: Value, data: Value, valid: Value) : Value` — [Syncpress application composition](../design/application.md), line 316.
- `pageRenderingTemplate(path: Value, data: Value) : Value` — [Syncpress application composition](../design/application.md), line 319.
- `patternHasResult(pattern: Value, path: Value, matched: Value) : Value` — [Syncpress application composition](../design/application.md), line 322.
- `projectAbsoluteSiteUrl(base: Value, origin: Value, address: Value) : Value` — [Syncpress application composition](../design/application.md), line 325.
- `projectSiteUrl(base: Value, target: Value) : Value` — [Syncpress application composition](../design/application.md), line 328.
- `prospectiveLocalReferenceAddress(sourcePath: Value, target: Value) : Value` — [Syncpress application composition](../design/application.md), line 331.
- `publicationTransactionPrefix(destination: Value) : Value` — [Syncpress application composition](../design/application.md), line 334.
- `relativePath(path: Value, prefix: Value) : Value` — [Syncpress application composition](../design/application.md), line 337.
- `retargetReference(replacement: Value, original: Value) : Value` — [Syncpress application composition](../design/application.md), line 340.
- `syncpressCommandName(words: Value) : Value` — [Syncpress application composition](../design/application.md), line 343.
- `syncpressCommandOperands(words: Value) : Value` — [Syncpress application composition](../design/application.md), line 346.
- `syncpressCommandValid(words: Value) : Value` — [Syncpress application composition](../design/application.md), line 349.
- `syncpressMisuse() : Value` — [Syncpress application composition](../design/application.md), line 352.
- `syncpressUsage() : Value` — [Syncpress application composition](../design/application.md), line 355.
- `targetHasKind(target: Value, kind: Value) : Value` — [Syncpress application composition](../design/application.md), line 358.

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### absolute site URL of address (address)

Authored path: `fullSite.calculations.AbsoluteSiteUrl`.
- Covered by [Syncpress application composition](../design/application.md), line 200.

```view
absolute site URL of address (address) — inputs (address); outputs (url); bindings (base, origin) — answers at most one (url)
  where
    Governing._site () has (base)
    Governing._origin () has (origin)
    url is projectAbsoluteSiteUrl (address, base, origin)
    isTextValue (value: url)
```

### active deployment work returned by queue transition (action, result)

```view
active deployment work returned by queue transition (action, result) — inputs (action, result); outputs (work); bindings () — answers at most one (work)
  where
    work is deploymentTransitionWork (action, result)
    isTextValue (value: work)
    Deploying._work (work) has (status: "active")
```

### address of output path (path)

Authored path: `fullSite.calculations.OutputPathAddress`.
- Covered by [Syncpress application composition](../design/application.md), line 205.

```view
address of output path (path) — inputs (path); outputs (address); bindings () — answers at most one (address)
  where
    address is outputPathAddress (path)
    isTextValue (value: address)
```

### committable deployment work of producer (producer)

```view
committable deployment work of producer (producer) — inputs (producer); outputs (work); bindings () — answers at most one (work)
  where Deploying._forProducer (producer) has (kind: "nojekyll", status: "active", work)
  where Deploying._forProducer (producer) has (status: "prepared", work)
```

### content document file

Authored path: `fullSite.views.ContentDocumentFile`.
- Covered by [Syncpress application composition](../design/application.md), line 221.

```view
content document file — inputs (); outputs (file, text); bindings (root, path) — answers any number of (file, text)
  where
    Filing._named (name: "content") has (root)
    Filing._under (prefix: "", root) has (file, path)
    patternHasResult (matched: true, path, pattern: "**/*.md")
    Filing._text (file) has (text)
  where
    Filing._named (name: "content") has (root)
    Filing._under (prefix: "", root) has (file, path)
    patternHasResult (matched: true, path, pattern: "**/*.html")
    Filing._text (file) has (text)
```

### relative body reference of source (source)

Authored path: `fullSite.references.RelativeBodyReference`.
- Covered by [Syncpress application composition](../design/application.md), line 217.

```view
relative body reference of source (source) — inputs (source); outputs (rendering, page, reference, raw, role); bindings () — answers any number of (rendering, page, reference, raw, role)
  where
    Referencing._source (source) has (part: "body", subject: rendering)
    RenderTracking._active (rendering) has (subject: page)
    Referencing._references (source) has (raw, reference, role)
    targetHasKind (kind: "relative", target: raw)
```

### resolved local body reference of source (source)

Authored path: `fullSite.references.ResolvedLocalBodyReference`.
- Covered by [Syncpress application composition](../design/application.md), line 218.

```view
resolved local body reference of source (source) — inputs (source); outputs (rendering, page, reference, raw, role, target); bindings () — answers any number of (rendering, page, reference, raw, role, target)
  where
    view "relative body reference of source (source)" with (source) has (page, raw, reference, rendering, role)
    Filing._resolve (address: raw, file: page) has (target)
```

### unrouted content body asset of source (source)

Authored path: `fullSite.references.UnroutedContentBodyAsset`.
- Covered by [Syncpress application composition](../design/application.md), line 219.

```view
unrouted content body asset of source (source) — inputs (source); outputs (rendering, page, reference, raw, role, asset, sourcePath, content); bindings (root) — answers any number of (rendering, page, reference, raw, role, asset, sourcePath, content)
  where
    view "resolved local body reference of source (source)" with (source) has (page, raw, reference, rendering, role, target: asset)
    no Routing._address (owner: asset)
    no DocumentParsing._document (subject: asset)
    Filing._file (file: asset) has (content, path: sourcePath, root)
    Filing._root (root) has (name: "content")
```

### copyable body asset of source (source)

```view
copyable body asset of source (source) — inputs (source); outputs (rendering, page, reference, raw, asset, sourcePath, content); bindings () — answers any number of (rendering, page, reference, raw, asset, sourcePath, content)
  where view "unrouted content body asset of source (source)" with (source) has (asset, content, page, raw, reference, rendering, sourcePath) and not (role: "image")
  where
    view "unrouted content body asset of source (source)" with (source) has (asset, content, page, raw, reference, rendering, role: "image", sourcePath)
    patternHasResult (matched: false, path: sourcePath, pattern: "**/*.{avif,gif,jpeg,jpg,png,webp}")
```

### derived address of path (path)

Authored path: `fullSite.calculations.DerivedAddress`.
- Covered by [Syncpress application composition](../design/application.md), line 202.

```view
derived address of path (path) — inputs (path); outputs (address); bindings () — answers at most one (address)
  where
    address is deriveAddress (path)
    isTextValue (value: address)
```

### directory prefix of path (path)

Authored path: `fullSite.calculations.DirectoryPath`.
- Covered by [Syncpress application composition](../design/application.md), line 203.

```view
directory prefix of path (path) — inputs (path); outputs (prefix); bindings () — answers at most one (prefix)
  where
    prefix is directoryPath (path)
    isTextValue (value: prefix)
```

### held body reference of source (source)

```view
held body reference of source (source) — inputs (source); outputs (reference, raw); bindings () — answers any number of (reference, raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "absolute", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "external", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "fragment", target: raw)
```

### held deployment layout reference of source (source)

```view
held deployment layout reference of source (source) — inputs (source); outputs (reference, raw); bindings () — answers any number of (reference, raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "external", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "fragment", target: raw)
```

### held layout reference of source (source)

```view
held layout reference of source (source) — inputs (source); outputs (reference, raw); bindings () — answers any number of (reference, raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "external", target: raw)
  where
    Referencing._references (source) has (raw, reference)
    targetHasKind (kind: "fragment", target: raw)
```

### the settled site build of job (job)

Authored path: `fullSite.endpoints.SettledSiteBuild`.
- Covered by [Syncpress application composition](../design/application.md), line 212.

```view
the settled site build of job (job) — inputs (job); outputs (state); bindings () — answers at most one (state)
  where
    Phasing._job (job) has (name: "site-build")
    Phasing._outcome (job) has (state)
```

### unsettled route owner

Authored path: `fullSite.endpoints.UnsettledRouteOwners`.
- Covered by [Syncpress application composition](../design/application.md), line 213.

```view
unsettled route owner — inputs (); outputs (owner); bindings () — answers any number of (owner)
  where
    Routing._claims () has (owner)
    no DependencyTracking._current (subject: owner)
```

### job (job) is a publishable site build

Authored path: `fullSite.endpoints.PublishableSiteBuild`.
- Covered by [Syncpress application composition](../design/application.md), line 211.

```view
job (job) is a publishable site build — inputs (job); outputs (); bindings ()
  where
    view "the settled site build of job (job)" with (job) has (state: "finished")
    Diagnosing._clean () has (clean: true)
    Deploying._outcome () has (state: "completed")
    no view "unsettled route owner"
```

### output path of address (address)

Authored path: `fullSite.calculations.AddressOutputPath`.
- Covered by [Syncpress application composition](../design/application.md), line 201.

```view
output path of address (address) — inputs (address); outputs (path); bindings () — answers at most one (path)
  where
    path is addressOutputPath (address)
    isTextValue (value: path)
```

### path (path) relative to prefix (prefix)

Authored path: `fullSite.calculations.RelativePath`.
- Covered by [Syncpress application composition](../design/application.md), line 207.

```view
path (path) relative to prefix (prefix) — inputs (path, prefix); outputs (relative); bindings () — answers at most one (relative)
  where
    relative is relativePath (path, prefix)
    isTextValue (value: relative)
```

### path joining prefix (prefix) and name (name)

Authored path: `fullSite.calculations.JoinedPath`.
- Covered by [Syncpress application composition](../design/application.md), line 204.

```view
path joining prefix (prefix) and name (name) — inputs (prefix, name); outputs (path); bindings () — answers at most one (path)
  where
    path is joinPath (name, prefix)
    isTextValue (value: path)
```

### pending failed rendering cleanup

Authored path: `fullSite.render.PendingFailedRenderingCleanup`.
- Covered by [Syncpress application composition](../design/application.md), line 220.

```view
pending failed rendering cleanup — inputs (); outputs (page, rendering); bindings (dependencyAttempt, emissionAttempt) — answers any number of (page, rendering)
  where
    RenderTracking._all () has (emissionAttempt, rendering, stage: "failed", subject: page)
    RenderTracking._latest (subject: page) has (rendering)
    Emitting._open (producer: page) has (attempt: emissionAttempt)
  where
    RenderTracking._all () has (dependencyAttempt, rendering, stage: "failed", subject: page)
    RenderTracking._latest (subject: page) has (rendering)
    DependencyTracking._attempt (subject: page) has (attempt: dependencyAttempt)
    DependencyTracking._state (subject: page) has (state: "building")
```

### primary raster body asset reference of source (source)

Authored path: `fullSite.images.RasterBodyAssetReference`.
- Covered by [Syncpress application composition](../design/application.md), line 214.

```view
primary raster body asset reference of source (source) — inputs (source); outputs (rendering, page, reference, raw, image, sourcePath, content); bindings () — answers any number of (rendering, page, reference, raw, image, sourcePath, content)
  where
    view "unrouted content body asset of source (source)" with (source) has (asset: image, content, page, raw, reference, rendering, role: "image", sourcePath)
    patternHasResult (matched: true, path: sourcePath, pattern: "**/*.{avif,gif,jpeg,jpg,png,webp}")
```

### prospective URL for local reference (raw) from source path (sourcePath)

```view
prospective URL for local reference (raw) from source path (sourcePath) — inputs (raw, sourcePath); outputs (value, target); bindings () — answers at most one (value, target)
  where
    value is prospectiveLocalReferenceAddress (sourcePath, target: raw)
    isTextValue (value)
    target is absoluteReferencePath (target: value)
    isTextValue (value: target)
```

### responsive body image embedding (embedding)

Authored path: `fullSite.images.ResponsiveBodyImageEmbedding`.
- Covered by [Syncpress application composition](../design/application.md), line 215.

```view
responsive body image embedding (embedding) — inputs (embedding); outputs (rendering, page, original); bindings (source, reference, raw, image) — answers at most one (rendering, page, original)
  where
    Embedding._embedding (embedding) has (subject: reference)
    Referencing._reference (reference) has (raw, role: "image", source)
    Referencing._source (source) has (part: "body", subject: rendering)
    RenderTracking._active (rendering) has (subject: page)
    targetHasKind (kind: "relative", target: raw)
    Filing._resolve (address: raw, file: page) has (target: image)
    Transcoding._original (subject: image) has (original)
```

### retargeted reference from original (original) to replacement (replacement)

Authored path: `fullSite.calculations.RetargetedReference`.
- Covered by [Syncpress application composition](../design/application.md), line 208.

```view
retargeted reference from original (original) to replacement (replacement) — inputs (replacement, original); outputs (target); bindings () — answers at most one (target)
  where
    target is retargetReference (original, replacement)
    isTextValue (value: target)
```

### routed deployment work (work)

```view
routed deployment work (work) — inputs (work); outputs (owner, address); bindings () — answers at most one (owner, address)
  where Deploying._work (work) has (from: address, kind: "redirect", owner)
  where Deploying._work (work) has (address, kind: "pagination-page", owner)
```

### site URL of target (target)

Authored path: `fullSite.calculations.SiteUrl`.
- Covered by [Syncpress application composition](../design/application.md), line 209.

```view
site URL of target (target) — inputs (target); outputs (url); bindings (base) — answers at most one (url)
  where
    Governing._site () has (base)
    url is projectSiteUrl (base, target)
    isTextValue (value: url)
```

### site-absolute reference (raw) names a routed address

```view
site-absolute reference (raw) names a routed address — inputs (raw); outputs (); bindings (address)
  where
    address is absoluteReferenceAddress (target: raw)
    isTextValue (value: address)
    Routing._owner (address)
```

### site-absolute reference (raw) names an emitted path

```view
site-absolute reference (raw) names an emitted path — inputs (raw); outputs (); bindings (path)
  where
    path is absoluteReferenceOutputPath (target: raw)
    isTextValue (value: path)
    Emitting._intent (path)
```

### site-absolute reference in a completed page

```view
site-absolute reference in a completed page — inputs (); outputs (raw, sourcePath); bindings (source, rendering, page, owner) — answers any number of (raw, sourcePath)
  where
    RenderTracking._all () has (rendering, stage: "completed", subject: page)
    Referencing._finished (part: "layout", subject: rendering) has (source)
    Referencing._references (source) has (raw)
    targetHasKind (kind: "absolute", target: raw)
    Filing._file (file: page) has (path: sourcePath)
  where
    Routing._claims () has (owner)
    Deploying._forOwner (owner) has (kind: "pagination-page", sourcePath)
    Referencing._finished (part: "deployment-layout", subject: owner) has (source)
    Referencing._references (source) has (raw)
    targetHasKind (kind: "absolute", target: raw)
```

### site-absolute reference without a produced target

```view
site-absolute reference without a produced target — inputs (); outputs (raw, target, sourcePath); bindings () — answers any number of (raw, target, sourcePath)
  where
    view "site-absolute reference in a completed page" has (raw, sourcePath)
    target is absoluteReferencePath (target: raw)
    isTextValue (value: target)
    no view "site-absolute reference (raw) names a routed address" with (raw)
    no view "site-absolute reference (raw) names an emitted path" with (raw)
```

### sitemap page

```view
sitemap page — inputs (); outputs (owner, address, url); bindings () — answers any number of (owner, address, url)
  where
    Routing._claims () has (address, owner) and not (address: "/404.html")
    no Deploying._forOwner (owner) has (kind: "redirect")
    view "absolute site URL of address (address)" with (address) has (url)
```

### the Syncpress command represented by words (words)

Authored path: `fullSite.commanding.SyncpressCommand`.
- Covered by [Syncpress application composition](../design/application.md), line 210.

```view
the Syncpress command represented by words (words) — inputs (words); outputs (name, operands); bindings () — answers at most one (name, operands)
  where
    syncpressCommandValid (words)
    name is syncpressCommandName (words)
    operands is syncpressCommandOperands (words)
```

### the Syncpress misuse report

```view
the Syncpress misuse report — inputs (); outputs (text); bindings () — answers exactly one (text)
  where text is syncpressMisuse
```

### the Syncpress usage report

```view
the Syncpress usage report — inputs (); outputs (text); bindings () — answers exactly one (text)
  where text is syncpressUsage
```

### the inspection owner of target (target)

Authored path: `fullSite.inspection.InspectionOwner`.
- Covered by [Syncpress application composition](../design/application.md), line 216.

```view
the inspection owner of target (target) — inputs (target); outputs (owner); bindings (root) — answers at most one (owner)
  where Routing._owner (address: target) has (owner)
  where
    Filing._named (name: "content") has (root)
    Filing._at (path: target, root) has (file: owner)
```

### the invalid rendering selection for path (path) and data (data)

```view
the invalid rendering selection for path (path) and data (data) — inputs (path, data); outputs (error, detail); bindings () — answers at most one (error, detail)
  where
    pageRenderingSelectionHasValidity (data, path, valid: false)
    error is pageRenderingError (data, path)
    detail is pageRenderingErrorDetail (data, path)
```

### the publication place

Authored path: `fullSite.views.PublicationPlace`.
- Covered by [Syncpress application composition](../design/application.md), line 222.

```view
the publication place — inputs (); outputs (place, destination); bindings () — answers at most one (place, destination)
  where
    Locating._named (name: "destination") has (place)
    Locating._place (place) has (real: destination)
  where
    no Locating._named (name: "destination")
    Locating._named (name: "output") has (place)
    Locating._place (place) has (real: destination)
```

### the publication transaction prefix of destination (destination)

Authored path: `fullSite.calculations.PublicationTransactionPrefix`.
- Covered by [Syncpress application composition](../design/application.md), line 206.

```view
the publication transaction prefix of destination (destination) — inputs (destination); outputs (prefix); bindings () — answers at most one (prefix)
  where
    prefix is publicationTransactionPrefix (destination)
    isTextValue (value: prefix)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### the build diagnostics inspection

```former
Former "the build diagnostics inspection" — inputs (); bindings (diagnostic, severity, code, message, source, line, column, relatedSource, relatedLine, relatedColumn, note); promises exactly one record — forms:
  a record of
    diagnostics: each Diagnosing._all () has (code, column, diagnostic, line, message, severity, source)
      form a record of
        code
        column
        diagnostic
        line
        message
        related: each Diagnosing._related (diagnostic) has (column: relatedColumn, line: relatedLine, note, source: relatedSource)
          form a record of
            column: relatedColumn
            line: relatedLine
            note
            source: relatedSource
        severity
        source
```

### the catalog inspection of owner (owner)

```former
Former "the catalog inspection of owner (owner)" — inputs (owner); bindings (catalog, name, index); promises exactly one record — forms:
  a record of
    memberships: each Cataloging._membership (item: owner) has (catalog, name)
      where Cataloging._position (catalog, item: owner) has (index)
      form a record of
        collection: catalog
        index
        name
```

### the claim inspection of owner (owner)

```former
Former "the claim inspection of owner (owner)" — inputs (owner); bindings (address); promises exactly one record — forms:
  a record of
    claims: each Routing._claims () has (address, owner)
      form a record of
        address
        owner
```

### the completed body render facts of rendering (rendering)

```former
Former "the completed body render facts of rendering (rendering)" — inputs (rendering); bindings (content); promises exactly one record — forms:
  a record of
    where Referencing._finished (part: "body", subject: rendering) has (text: content)
    content
```

### the dependency inspection of owner (owner)

```former
Former "the dependency inspection of owner (owner)" — inputs (owner); bindings (state, reason, input); promises exactly one record — forms:
  a record of
    dependencies: a record of
      where DependencyTracking._state (subject: owner) has (state)
      where whether DependencyTracking._reason (subject: owner) has (reason)
      inputs: each DependencyTracking._uses (subject: owner) has (input)
        form a record of
          input
      reason
      state
```

### the deployment entries of catalog (catalog)

```former
Former "the deployment entries of catalog (catalog)" — inputs (catalog); bindings (item, card); promises exactly one record — forms:
  each Cataloging._entries (catalog) has (card, item)
    form a record of
      card
      item
```

### the diagnosed text

```former
Former "the diagnosed text" — inputs (); bindings (text); promises exactly one record — forms:
  a record of
    where Diagnosing._rendered () has (text)
    text
```

### the layer inspection of owner (owner)

```former
Former "the layer inspection of owner (owner)" — inputs (owner); bindings (layer, rank, values, path, originRank, originLayer); promises exactly one record — forms:
  a record of
    layers: each Layering._layers (subject: owner) has (layer, rank, values)
      form a record of
        layer
        rank
        values
    origins: each Layering._leafOrigins (subject: owner) has (layer: originLayer, path, rank: originRank)
      form a record of
        layer: originLayer
        path
        rank: originRank
```

### the originated page render facts of rendering (rendering)

```former
Former "the originated page render facts of rendering (rendering)" — inputs (rendering); bindings (page, address, canonicalUrl); promises exactly one record — forms:
  a record of
    where RenderTracking._active (rendering) has (subject: page)
    where Routing._address (owner: page) has (address)
    where view "absolute site URL of address (address)" with (address) has (url: canonicalUrl)
    canonicalUrl
```

### the page render facts of rendering (rendering)

```former
Former "the page render facts of rendering (rendering)" — inputs (rendering); bindings (page, data, address, path); promises exactly one record — forms:
  a record of
    where RenderTracking._active (rendering) has (subject: page)
    where Layering._resolved (subject: page) has (values: data)
    where Routing._address (owner: page) has (address)
    where Filing._file (file: page) has (path)
    data
    source: a record of
      path
    url: address
```

### the site render facts

```former
Former "the site render facts" — inputs (); bindings (site, collections); promises exactly one record — forms:
  a record of
    where Governing._site () has (site)
    where Cataloging._record () has (catalogs: collections)
    collections
    site
```

### the originated completed render context of rendering (rendering)

Authored path: `fullSite.views.CompletedOriginatedPageRenderContext`.
- Covered by [Syncpress application composition](../design/application.md), line 225.

```former
Former "the originated completed render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the originated page render facts of rendering (rendering)" with (rendering)
      … former "the completed body render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

### the originated render context of rendering (rendering)

Authored path: `fullSite.views.OriginatedPageRenderContext`.
- Covered by [Syncpress application composition](../design/application.md), line 227.

```former
Former "the originated render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the originated page render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

### the output inspection of owner (owner)

```former
Former "the output inspection of owner (owner)" — inputs (owner); bindings (path, digest, medium); promises exactly one record — forms:
  a record of
    outputs: each Emitting._byProducer (producer: owner) has (digest, medium, path)
      form a record of
        digest
        medium
        path
```

### the publication card of page (page)

Authored path: `fullSite.views.PublicationCard`.
- Covered by [Syncpress application composition](../design/application.md), line 228.

```former
Former "the publication card of page (page)" — inputs (page); bindings (data, address, excerpt, root, path); promises exactly one record — forms:
  a record of
    where Layering._resolved (subject: page) has (values: data)
    where Routing._address (owner: page) has (address)
    where whether Converting._excerpt (part: "excerpt", subject: page) has (excerpt)
    where Filing._named (name: "content") has (root)
    where Filing._file (file: page) has (path, root)
    data
    excerpt
    source: a record of
      path
    url: address
```

### the rendering inspection of owner (owner)

```former
Former "the rendering inspection of owner (owner)" — inputs (owner); bindings (rendering, path, profile, template, stage, bodySource, layoutSource, historicalRendering, historicalPath, historicalProfile, historicalTemplate, historicalStage); promises exactly one record — forms:
  a record of
    rendering: a record of
      where whether RenderTracking._latest (subject: owner) has (path, profile, rendering, stage, template)
      attempt: rendering
      body: a record of
        where whether Referencing._finished (part: "body", subject: rendering) has (source: bodySource)
        source: bodySource
      layout: a record of
        where whether Referencing._finished (part: "layout", subject: rendering) has (source: layoutSource)
        source: layoutSource
      path
      profile
      stage
      template
    renderings: each RenderTracking._all () has (path: historicalPath, profile: historicalProfile, rendering: historicalRendering, stage: historicalStage, subject: owner, template: historicalTemplate)
      form a record of
        attempt: historicalRendering
        path: historicalPath
        profile: historicalProfile
        stage: historicalStage
        template: historicalTemplate
```

### the route inspection of owner (owner)

```former
Former "the route inspection of owner (owner)" — inputs (owner); bindings (route); promises exactly one record — forms:
  a record of
    route: a record of
      where whether Routing._address (owner) has (address: route)
      address: route
```

### the site build summary

Authored path: `fullSite.views.SiteBuildSummary`.
- Covered by [Syncpress application composition](../design/application.md), line 229.

```former
Former "the site build summary" — inputs (); bindings (owner, file, policy, destination, severity, code, message, source, line, column); promises exactly one record — forms:
  a record of
    where whether Governing._policy () has (policy)
    where whether view "the publication place" has (destination)
    destination
    diagnosis: former "the diagnosed text"
    diagnostics: each Diagnosing._all () has (code, column, line, message, severity, source)
      form a record of
        code
        column
        line
        message
        severity
        source
    files: the count of Filing._files () has (file)
    pages: the count of Routing._claims () has (owner)
    policy
```

### the source inspection of owner (owner)

```former
Former "the source inspection of owner (owner)" — inputs (owner); bindings (path, digest); promises exactly one record — forms:
  a record of
    source: a record of
      where whether Filing._file (file: owner) has (digest, path)
      digest
      path
```

### the template inspection of owner (owner)

```former
Former "the template inspection of owner (owner)" — inputs (owner); bindings (name, template, digest, used); promises exactly one record — forms:
  a record of
    template: a record of
      where whether RenderTracking._latest (subject: owner) has (template: name)
      where whether Templating._template (name) has (digest, template)
      digest
      name
      tree: each Templating._tree (owner: template) has (used)
        form a record of
          used
```

### the site inspection of owner (owner)

Authored path: `fullSite.inspection.SiteInspection`.
- Covered by [Syncpress application composition](../design/application.md), line 224.

```former
Former "the site inspection of owner (owner)" — inputs (owner); bindings (); promises exactly one record — forms:
  a record of
    … former "the route inspection of owner (owner)" with (owner)
    … former "the source inspection of owner (owner)" with (owner)
    … former "the template inspection of owner (owner)" with (owner)
    … former "the layer inspection of owner (owner)" with (owner)
    … former "the rendering inspection of owner (owner)" with (owner)
    … former "the catalog inspection of owner (owner)" with (owner)
    … former "the dependency inspection of owner (owner)" with (owner)
    … former "the output inspection of owner (owner)" with (owner)
    … former "the claim inspection of owner (owner)" with (owner)
    … former "the build diagnostics inspection"
```

### the sitemap urls

```former
Former "the sitemap urls" — inputs (); bindings (owner, address, url); promises exactly one record — forms:
  each view "sitemap page" has (address, owner, url)
    form a record of
      url
```

### the unoriginated page render facts of rendering (rendering)

```former
Former "the unoriginated page render facts of rendering (rendering)" — inputs (rendering); bindings (page, address); promises exactly one record — forms:
  a record of
    where RenderTracking._active (rendering) has (subject: page)
    where Routing._address (owner: page) has (address)
    where no view "absolute site URL of address (address)" with (address)
```

### the unoriginated completed render context of rendering (rendering)

Authored path: `fullSite.views.CompletedUnoriginatedPageRenderContext`.
- Covered by [Syncpress application composition](../design/application.md), line 226.

```former
Former "the unoriginated completed render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the unoriginated page render facts of rendering (rendering)" with (rendering)
      … former "the completed body render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

### the unoriginated render context of rendering (rendering)

Authored path: `fullSite.views.UnoriginatedPageRenderContext`.
- Covered by [Syncpress application composition](../design/application.md), line 230.

```former
Former "the unoriginated render context of rendering (rendering)" — inputs (rendering); bindings (); promises exactly one record — forms:
  a record of
    page: a record of
      … former "the page render facts of rendering (rendering)" with (rendering)
      … former "the unoriginated page render facts of rendering (rendering)" with (rendering)
    … former "the site render facts"
```

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### fullSite.collections.CatalogIndexFailuresDiagnose

Authored path: `fullSite.collections.CatalogIndexFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 12.

```reaction
when refused Cataloging.index (item: page, path, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "collect", transitioned: true)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "collection-indexing", severity: "error", source: path)
```

### fullSite.collections.CollectPhaseIndexesPages

Authored path: `fullSite.collections.CollectPhaseIndexesPages`.
- Covered by [Syncpress application composition](../design/application.md), line 13.

```reaction
when Phasing.completePhase (name: "site-build", phase: "collect", transitioned: true)
where
  Routing._claims () has (owner: page)
  Filing._named (name: "content") has (root: content)
  Filing._file (file: page) has (path, root: content)
  Cataloging._catalogs () has (catalog)
then
  Cataloging.index (card: former "the publication card of page (page)" with (page), catalog, item: page, path, tiebreak: path)
```

### fullSite.commanding.AnnounceMisuse

Authored path: `fullSite.commanding.AnnounceMisuse`.
- Covered by [Syncpress application composition](../design/application.md), line 14.
- Covered by [Syncpress application composition](../design/application.md), line 236.

```reaction
when RequestBoundary.request (path: "/cli/misuse", requestId)
where
  view "the Syncpress misuse report" has (text)
then
  Commanding.writeLine (stream: "error", text)
```

### fullSite.commanding.AnnounceMisuse#2

Authored path: `fullSite.commanding.AnnounceMisuse`.
- Covered by [Syncpress application composition](../design/application.md), line 14.
- Covered by [Syncpress application composition](../design/application.md), line 236.

```reaction
when Commanding.writeLine (stream: "error", text), asked by fullSite.commanding.AnnounceMisuse
where
  earlier, RequestBoundary.request (path: "/cli/misuse", requestId)
then
  RequestBoundary.respond (requestId)
```

### fullSite.commanding.AnnounceUsage

Authored path: `fullSite.commanding.AnnounceUsage`.
- Covered by [Syncpress application composition](../design/application.md), line 15.
- Covered by [Syncpress application composition](../design/application.md), line 237.

```reaction
when RequestBoundary.request (path: "/cli/usage", requestId)
where
  view "the Syncpress usage report" has (text)
then
  Commanding.writeLine (stream: "output", text)
```

### fullSite.commanding.AnnounceUsage#2

Authored path: `fullSite.commanding.AnnounceUsage`.
- Covered by [Syncpress application composition](../design/application.md), line 15.
- Covered by [Syncpress application composition](../design/application.md), line 237.

```reaction
when Commanding.writeLine (stream: "output", text), asked by fullSite.commanding.AnnounceUsage
where
  earlier, RequestBoundary.request (path: "/cli/usage", requestId)
then
  RequestBoundary.respond (requestId)
```

### fullSite.commanding.HoldUntilStopped

Authored path: `fullSite.commanding.HoldUntilStopped`.
- Covered by [Syncpress application composition](../design/application.md), line 16.
- Covered by [Syncpress application composition](../design/application.md), line 238.

```reaction
when RequestBoundary.request (path: "/cli/hold", requestId)
then
  Holding.awaitStop ()
```

### fullSite.commanding.HoldUntilStopped#2

Authored path: `fullSite.commanding.HoldUntilStopped`.
- Covered by [Syncpress application composition](../design/application.md), line 16.
- Covered by [Syncpress application composition](../design/application.md), line 238.

```reaction
when Holding.awaitStop (reason), asked by fullSite.commanding.HoldUntilStopped
where
  earlier, RequestBoundary.request (path: "/cli/hold", requestId)
then
  RequestBoundary.respond (reason, requestId)
```

### fullSite.commanding.InterpretCommandLine

Authored path: `fullSite.commanding.InterpretCommandLine`.
- Covered by [Syncpress application composition](../design/application.md), line 17.
- Covered by [Syncpress application composition](../design/application.md), line 239.

```reaction
when RequestBoundary.request (arguments: supplied, path: "/cli/interpret", requestId)
then
  Commanding.captureArguments (arguments: supplied)
```

### fullSite.commanding.InterpretCommandLine:invalid#2

Authored path: `fullSite.commanding.InterpretCommandLine`.
- Covered by [Syncpress application composition](../design/application.md), line 17.
- Covered by [Syncpress application composition](../design/application.md), line 239.

```reaction
when Commanding.captureArguments (arguments: supplied, words), asked by fullSite.commanding.InterpretCommandLine
where
  no view "the Syncpress command represented by words (words)" with (words)
  earlier, RequestBoundary.request (arguments: supplied, path: "/cli/interpret", requestId)
then
  RequestBoundary.respond (error: "INVALID_USAGE", requestId)
```

### fullSite.commanding.InterpretCommandLine:recognized#2

Authored path: `fullSite.commanding.InterpretCommandLine`.
- Covered by [Syncpress application composition](../design/application.md), line 17.
- Covered by [Syncpress application composition](../design/application.md), line 239.

```reaction
when Commanding.captureArguments (arguments: supplied, words), asked by fullSite.commanding.InterpretCommandLine
where
  view "the Syncpress command represented by words (words)" with (words)
  earlier, RequestBoundary.request (arguments: supplied, path: "/cli/interpret", requestId)
then
  RequestBoundary.respond (requestId, words)
```

### fullSite.commanding.SetCommandLineExit

Authored path: `fullSite.commanding.SetCommandLineExit`.
- Covered by [Syncpress application composition](../design/application.md), line 18.
- Covered by [Syncpress application composition](../design/application.md), line 240.

```reaction
when RequestBoundary.request (code, path: "/cli/exit", requestId)
then
  Commanding.setExitStatus (code)
```

### fullSite.commanding.SetCommandLineExit#2

Authored path: `fullSite.commanding.SetCommandLineExit`.
- Covered by [Syncpress application composition](../design/application.md), line 18.
- Covered by [Syncpress application composition](../design/application.md), line 240.

```reaction
when Commanding.setExitStatus (code), asked by fullSite.commanding.SetCommandLineExit
where
  earlier, RequestBoundary.request (code, path: "/cli/exit", requestId)
then
  RequestBoundary.respond (requestId)
```

### fullSite.commanding.WriteCommandLine

Authored path: `fullSite.commanding.WriteCommandLine`.
- Covered by [Syncpress application composition](../design/application.md), line 19.
- Covered by [Syncpress application composition](../design/application.md), line 241.

```reaction
when RequestBoundary.request (path: "/cli/write", requestId, stream, text)
then
  Commanding.writeLine (stream, text)
```

### fullSite.commanding.WriteCommandLine#2

Authored path: `fullSite.commanding.WriteCommandLine`.
- Covered by [Syncpress application composition](../design/application.md), line 19.
- Covered by [Syncpress application composition](../design/application.md), line 241.

```reaction
when Commanding.writeLine (stream, text), asked by fullSite.commanding.WriteCommandLine
where
  earlier, RequestBoundary.request (path: "/cli/write", requestId, stream, text)
then
  RequestBoundary.respond (requestId)
```

### fullSite.deployment.AbsoluteDeploymentLayoutReferencesRebase

Authored path: `fullSite.deployment.AbsoluteDeploymentLayoutReferencesRebase`.
- Covered by [Syncpress application composition](../design/application.md), line 20.

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._references (source) has (raw, reference)
  targetHasKind (kind: "absolute", target: raw)
  view "site URL of target (target)" with (target: raw) has (url)
then
  Referencing.resolve (form: "address", reference, value: url)
```

### fullSite.deployment.ActivatedFeedWorkSnapshotsInputs

Authored path: `fullSite.deployment.ActivatedFeedWorkSnapshotsInputs`.
- Covered by [Syncpress application composition](../design/application.md), line 21.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "feed")
  Cataloging._named (name: collectionName) has (catalog)
  Governing._site () has (site)
then
  Deploying.snapshotFeed (entries: former "the deployment entries of catalog (catalog)" with (catalog), site, work)
```

### fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose:diagnose

Authored path: `fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 22.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "feed")
  no Cataloging._named (name: collectionName)
then
  Diagnosing.report (code: "FEED_COLLECTION_NOT_FOUND", message: "Feed names no configured collection.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose:reject

Authored path: `fullSite.deployment.ActivatedFeedsWithoutCollectionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 22.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "feed")
  no Cataloging._named (name: collectionName)
then
  Deploying.reject (work)
```

### fullSite.deployment.ActivatedNojekyllWorkBegins

Authored path: `fullSite.deployment.ActivatedNojekyllWorkBegins`.
- Covered by [Syncpress application composition](../design/application.md), line 23.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (kind: "nojekyll", producer)
then
  Emitting.beginAttempt (producer)
```

### fullSite.deployment.ActivatedPaginationPlansDivide

Authored path: `fullSite.deployment.ActivatedPaginationPlansDivide`.
- Covered by [Syncpress application composition](../design/application.md), line 24.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, deployment, kind: "pagination-plan", templateName)
  Cataloging._named (name: collectionName) has (catalog)
  Templating._template (name: templateName) has (template)
then
  Deploying.expandPagination (deployment, entries: former "the deployment entries of catalog (catalog)" with (catalog), template, work)
```

### fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose:diagnose

Authored path: `fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 25.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan")
  no Cataloging._named (name: collectionName)
then
  Diagnosing.report (code: "PAGINATION_COLLECTION_NOT_FOUND", message: "A pagination rule names no configured collection.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose:reject

Authored path: `fullSite.deployment.ActivatedPaginationPlansWithoutCollectionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 25.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan")
  no Cataloging._named (name: collectionName)
then
  Deploying.reject (work)
```

### fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose:diagnose

Authored path: `fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 26.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan", templateName)
  Cataloging._named (name: collectionName)
  no Templating._template (name: templateName)
then
  Diagnosing.report (code: "TEMPLATE_NOT_FOUND", message: "A pagination rule selects an undefined template.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose:reject

Authored path: `fullSite.deployment.ActivatedPaginationPlansWithoutTemplatesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 26.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (collection: collectionName, kind: "pagination-plan", templateName)
  Cataloging._named (name: collectionName)
  no Templating._template (name: templateName)
then
  Deploying.reject (work)
```

### fullSite.deployment.ActivatedRoutedDeploymentWorkClaims

Authored path: `fullSite.deployment.ActivatedRoutedDeploymentWorkClaims`.
- Covered by [Syncpress application composition](../design/application.md), line 27.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  view "routed deployment work (work)" with (work) has (address, owner)
then
  Routing.claim (address, owner)
```

### fullSite.deployment.ActivatedSitemapWorkSnapshotsUrls

Authored path: `fullSite.deployment.ActivatedSitemapWorkSnapshotsUrls`.
- Covered by [Syncpress application composition](../design/application.md), line 28.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  view "active deployment work returned by queue transition (action, result)" with (action, result) has (work)
  Deploying._work (work) has (kind: "sitemap")
then
  Deploying.snapshotSitemap (urls: former "the sitemap urls", work)
```

### fullSite.deployment.BegunFeedsIntend

Authored path: `fullSite.deployment.BegunFeedsIntend`.
- Covered by [Syncpress application composition](../design/application.md), line 29.

```reaction
when Emitting.beginAttempt (producer, attempt)
where
  Deploying._forProducer (producer) has (kind: "feed", work)
  earlier, Deploying.prepareFeed (work, content, origin: true, path)
then
  Emitting.intend (attempt, content, medium: "application/atom+xml", path, producer)
```

### fullSite.deployment.BegunNojekyllWorkIntends

Authored path: `fullSite.deployment.BegunNojekyllWorkIntends`.
- Covered by [Syncpress application composition](../design/application.md), line 30.

```reaction
when Emitting.beginAttempt (producer, attempt)
where
  Deploying._forProducer (producer) has (kind: "nojekyll", path)
then
  Emitting.intend (attempt, content: "", medium: "text/plain", path, producer)
```

### fullSite.deployment.BegunPaginationPagesIntend

Authored path: `fullSite.deployment.BegunPaginationPagesIntend`.
- Covered by [Syncpress application composition](../design/application.md), line 31.

```reaction
when Emitting.beginAttempt (producer, attempt)
where
  Deploying._forProducer (producer) has (address, kind: "pagination-page")
  view "output path of address (address)" with (address) has (path)
  Referencing._finished (part: "deployment-layout", subject: producer) has (text)
then
  Emitting.intend (attempt, content: text, medium: "text/html", path, producer)
```

### fullSite.deployment.BegunRedirectsIntend

Authored path: `fullSite.deployment.BegunRedirectsIntend`.
- Covered by [Syncpress application composition](../design/application.md), line 32.

```reaction
when Emitting.beginAttempt (producer, attempt)
where
  Deploying._forProducer (producer) has (from: address, kind: "redirect", work)
  view "output path of address (address)" with (address) has (path)
  earlier, Deploying.prepareRedirect (work, content)
then
  Emitting.intend (attempt, content, medium: "text/html", path, producer)
```

### fullSite.deployment.BegunSitemapsIntend

Authored path: `fullSite.deployment.BegunSitemapsIntend`.
- Covered by [Syncpress application composition](../design/application.md), line 33.

```reaction
when Emitting.beginAttempt (producer, attempt)
where
  Deploying._forProducer (producer) has (kind: "sitemap", work)
  earlier, Deploying.prepareSitemap (work, content, path)
then
  Emitting.intend (attempt, content, medium: "application/xml", path, producer)
```

### fullSite.deployment.ClaimedExternalRedirectsPrepare

Authored path: `fullSite.deployment.ClaimedExternalRedirectsPrepare`.
- Covered by [Syncpress application composition](../design/application.md), line 34.

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (kind: "redirect", to: target, work)
  targetHasKind (kind: "external", target)
  content is deploymentRedirectDocument (canonical: target, target)
then
  Deploying.prepareRedirect (canonical: target, content, target, work)
```

### fullSite.deployment.ClaimedLocalRedirectsPrepare

Authored path: `fullSite.deployment.ClaimedLocalRedirectsPrepare`.
- Covered by [Syncpress application composition](../design/application.md), line 35.

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (kind: "redirect", to: raw, work)
  view "site URL of target (target)" with (target: raw) has (url: target)
  view "absolute site URL of address (address)" with (address: raw) has (url: canonical)
  content is deploymentRedirectDocument (canonical, target)
then
  Deploying.prepareRedirect (canonical, content, target, work)
```

### fullSite.deployment.ClaimedPaginationPagesPrepareContext

Authored path: `fullSite.deployment.ClaimedPaginationPagesPrepareContext`.
- Covered by [Syncpress application composition](../design/application.md), line 36.

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (address, cards, collection, kind: "pagination-page", next, number, pages, previous, sourcePath, title, work)
  Governing._site () has (site)
  Cataloging._record () has (catalogs: collections)
  whether view "absolute site URL of address (address)" with (address) has (url: canonicalUrl)
  context is deploymentPaginationContext (address, canonicalUrl, cards, collection, collections, next, number, pages, previous, site, sourcePath, title)
then
  Deploying.preparePageContext (context, work)
```

### fullSite.deployment.ClaimedUnoriginatedRedirectsPrepare

Authored path: `fullSite.deployment.ClaimedUnoriginatedRedirectsPrepare`.
- Covered by [Syncpress application composition](../design/application.md), line 37.

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner) has (kind: "redirect", to: raw, work)
  view "site URL of target (target)" with (target: raw) has (url: target)
  no view "absolute site URL of address (address)" with (address: raw)
  content is deploymentRedirectDocument (canonical: target, target)
then
  Deploying.prepareRedirect (canonical: target, content, target, work)
```

### fullSite.deployment.CommittedDeploymentArtifactsComplete

Authored path: `fullSite.deployment.CommittedDeploymentArtifactsComplete`.
- Covered by [Syncpress application composition](../design/application.md), line 38.

```reaction
when Emitting.commitAttempt (attempt, producer)
where
  view "committable deployment work of producer (producer)" with (producer) has (work)
  Emitting._attempt (producer) has (attempt)
then
  Deploying.complete (work)
```

### fullSite.deployment.DeploymentBeginFailuresDiagnose

Authored path: `fullSite.deployment.DeploymentBeginFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 39.

```reaction
when refused Emitting.beginAttempt (producer, detail, error)
where
  view "committable deployment work of producer (producer)" with (producer) has (work)
then
  Deploying.reject (work)
```

### fullSite.deployment.DeploymentBeginFailuresDiagnose#2

Authored path: `fullSite.deployment.DeploymentBeginFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 39.

```reaction
when Deploying.reject (work), asked by fullSite.deployment.DeploymentBeginFailuresDiagnose
where
  earlier, refused Emitting.beginAttempt (producer, detail, error)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentCommitFailuresDiagnose

Authored path: `fullSite.deployment.DeploymentCommitFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 40.

```reaction
when refused Emitting.commitAttempt (attempt, producer, detail, error)
where
  view "committable deployment work of producer (producer)" with (producer) has (work)
  Emitting._open (producer) has (attempt)
then
  Deploying.reject (work)
```

### fullSite.deployment.DeploymentCommitFailuresDiagnose#2

Authored path: `fullSite.deployment.DeploymentCommitFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 40.

```reaction
when Deploying.reject (work), asked by fullSite.deployment.DeploymentCommitFailuresDiagnose
where
  earlier, refused Emitting.commitAttempt (attempt, producer, detail, error)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentIntentFailuresFailAndAbort

Authored path: `fullSite.deployment.DeploymentIntentFailuresFailAndAbort`.
- Covered by [Syncpress application composition](../design/application.md), line 41.

```reaction
when refused Emitting.intend (attempt, path, producer, detail, error)
where
  view "committable deployment work of producer (producer)" with (producer)
  Emitting._open (producer) has (attempt)
then
  Deploying.failWork (code: error, detail, path, producer)
```

### fullSite.deployment.DeploymentIntentFailuresFailAndAbort#2

Authored path: `fullSite.deployment.DeploymentIntentFailuresFailAndAbort`.
- Covered by [Syncpress application composition](../design/application.md), line 41.

```reaction
when Deploying.failWork (code: error, detail, path, producer), asked by fullSite.deployment.DeploymentIntentFailuresFailAndAbort
where
  earlier, refused Emitting.intend (attempt, path, producer, detail, error)
then
  Emitting.abortAttempt (attempt, producer)
```

### fullSite.deployment.DeploymentOutputFailuresRelateProducers

Authored path: `fullSite.deployment.DeploymentOutputFailuresRelateProducers`.
- Covered by [Syncpress application composition](../design/application.md), line 42.

```reaction
when Diagnosing.report (code: "PATH_CONTESTED", diagnostic)
where
  earlier, Deploying.failWork (path)
  Emitting._producers (path) has (producer)
then
  Diagnosing.addRelatedLocation (diagnostic, note: "Competing output producer.", source: producer)
```

### fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose:diagnose

Authored path: `fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 43.

```reaction
when refused Referencing.resolve (reference, detail, error)
where
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "deployment-layout", subject: owner)
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose:reject

Authored path: `fullSite.deployment.DeploymentReferenceAnswerFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 43.

```reaction
when refused Referencing.resolve (reference, detail, error)
where
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "deployment-layout", subject: owner)
  Deploying._forOwner (owner)
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.deployment.DeploymentReferenceScanFailuresDiagnose

Authored path: `fullSite.deployment.DeploymentReferenceScanFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 44.

```reaction
when refused Referencing.scan (part: "deployment-layout", subject: owner, detail, error)
where
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.DeploymentReferenceScanFailuresDiagnose#2

Authored path: `fullSite.deployment.DeploymentReferenceScanFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 44.

```reaction
when Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.DeploymentReferenceScanFailuresDiagnose
where
  earlier, refused Referencing.scan (part: "deployment-layout", subject: owner, detail, error)
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.deployment.DescribedDeploymentOutputFailuresDiagnose

Authored path: `fullSite.deployment.DescribedDeploymentOutputFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 45.

```reaction
when Deploying.failWork (path, code, message)
then
  Diagnosing.report (code, message, severity: "error", source: "site.yaml")
```

### fullSite.deployment.EmitPhaseStartsDeployment

Authored path: `fullSite.deployment.EmitPhaseStartsDeployment`.
- Covered by [Syncpress application composition](../design/application.md), line 46.

```reaction
when Phasing.completePhase (name: "site-build", phase: "emit", transitioned: true)
where
  Governing._publishing () has (policy)
then
  Deploying.start (policy)
```

### fullSite.deployment.EmptyPaginationLayoutScansBegin

Authored path: `fullSite.deployment.EmptyPaginationLayoutScansBegin`.
- Covered by [Syncpress application composition](../design/application.md), line 47.

```reaction
when Referencing.scan (part: "deployment-layout", subject: owner, completed: true)
where
  Deploying._forOwner (owner) has (producer)
then
  Emitting.beginAttempt (producer)
```

### fullSite.deployment.FinishedPaginationLayoutAnswersBegin

Authored path: `fullSite.deployment.FinishedPaginationLayoutAnswersBegin`.
- Covered by [Syncpress application composition](../design/application.md), line 48.

```reaction
when Referencing.resolve (completed: true, part: "deployment-layout", subject: owner)
where
  Deploying._forOwner (owner) has (producer)
then
  Emitting.beginAttempt (producer)
```

### fullSite.deployment.GeneratedClaimsBeginDependencies

Authored path: `fullSite.deployment.GeneratedClaimsBeginDependencies`.
- Covered by [Syncpress application composition](../design/application.md), line 49.

```reaction
when Routing.claim (owner)
where
  Deploying._forOwner (owner)
then
  DependencyTracking.beginAttempt (subject: owner)
```

### fullSite.deployment.GeneratedDependenciesSettle

Authored path: `fullSite.deployment.GeneratedDependenciesSettle`.
- Covered by [Syncpress application composition](../design/application.md), line 50.

```reaction
when DependencyTracking.recordDependency (attempt, input: "site.yaml", subject: owner)
where
  Deploying._forOwner (owner)
then
  DependencyTracking.settleAttempt (attempt, subject: owner)
```

### fullSite.deployment.GeneratedDependenciesTrackConfiguration

Authored path: `fullSite.deployment.GeneratedDependenciesTrackConfiguration`.
- Covered by [Syncpress application composition](../design/application.md), line 51.

```reaction
when DependencyTracking.beginAttempt (subject: owner, attempt)
where
  Deploying._forOwner (owner)
then
  DependencyTracking.recordDependency (attempt, input: "site.yaml", subject: owner)
```

### fullSite.deployment.GeneratedRouteCollisionsDiagnose

Authored path: `fullSite.deployment.GeneratedRouteCollisionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 52.

```reaction
when refused Routing.claim (owner, detail, error: "ADDRESS_TAKEN")
where
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: "ROUTE_COLLISION", message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.GeneratedRouteCollisionsDiagnose#2

Authored path: `fullSite.deployment.GeneratedRouteCollisionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 52.

```reaction
when Diagnosing.report (code: "ROUTE_COLLISION", message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.GeneratedRouteCollisionsDiagnose
where
  earlier, refused Routing.claim (owner, detail, error: "ADDRESS_TAKEN")
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.deployment.IntendedDeploymentArtifactsCommit

Authored path: `fullSite.deployment.IntendedDeploymentArtifactsCommit`.
- Covered by [Syncpress application composition](../design/application.md), line 53.

```reaction
when Emitting.intend (attempt, producer)
where
  view "committable deployment work of producer (producer)" with (producer)
  Emitting._open (producer) has (attempt)
then
  Emitting.commitAttempt (attempt, producer)
```

### fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose:diagnose

Authored path: `fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 54.

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "relative", target: raw)
then
  Diagnosing.report (code: "RELATIVE_LAYOUT_REFERENCE", message: "A generated layout reference must be site-absolute, external, or fragment-only.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose:reject

Authored path: `fullSite.deployment.InvalidDeploymentLayoutReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 54.

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "relative", target: raw)
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.deployment.InvalidFeedEntriesDiagnose

Authored path: `fullSite.deployment.InvalidFeedEntriesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 55.

```reaction
when Deploying.prepareFeed (work, origin: true, valid: false)
then
  Diagnosing.report (code: "INVALID_FEED_ENTRY", message: "Feed entries need a routed URL and a valid data.date.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.InvalidFeedEntriesDiagnose#2

Authored path: `fullSite.deployment.InvalidFeedEntriesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 55.

```reaction
when Diagnosing.report (code: "INVALID_FEED_ENTRY", message: "Feed entries need a routed URL and a valid data.date.", severity: "error", source: "site.yaml"), asked by fullSite.deployment.InvalidFeedEntriesDiagnose
where
  earlier, Deploying.prepareFeed (work, origin: true, valid: false)
then
  Deploying.reject (work)
```

### fullSite.deployment.InvalidGeneratedRoutesDiagnose

Authored path: `fullSite.deployment.InvalidGeneratedRoutesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 56.

```reaction
when refused Routing.claim (owner, detail, error: "INVALID_ADDRESS")
where
  Deploying._forOwner (owner)
then
  Diagnosing.report (code: "INVALID_ADDRESS", message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.InvalidGeneratedRoutesDiagnose#2

Authored path: `fullSite.deployment.InvalidGeneratedRoutesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 56.

```reaction
when Diagnosing.report (code: "INVALID_ADDRESS", message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.InvalidGeneratedRoutesDiagnose
where
  earlier, refused Routing.claim (owner, detail, error: "INVALID_ADDRESS")
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.deployment.MissingRequiredNotFoundPagesDiagnose

Authored path: `fullSite.deployment.MissingRequiredNotFoundPagesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 57.

```reaction
when Phasing.completePhase (name: "site-build", phase: "emit", transitioned: true)
where
  Governing._deployment () has (requireNotFound: true)
  no Routing._owner (address: "/404.html")
then
  Diagnosing.report (code: "MISSING_NOT_FOUND", message: "deploy.requireNotFound requires an authored /404.html page.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.NonlocalDeploymentLayoutReferencesHold

Authored path: `fullSite.deployment.NonlocalDeploymentLayoutReferencesHold`.
- Covered by [Syncpress application composition](../design/application.md), line 58.

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  view "held deployment layout reference of source (source)" with (source) has (raw, reference)
then
  Referencing.resolve (form: "address", reference, value: raw)
```

### fullSite.deployment.OriginlessFeedsDiagnose

Authored path: `fullSite.deployment.OriginlessFeedsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 59.

```reaction
when Deploying.prepareFeed (work, origin: false)
then
  Diagnosing.report (code: "ORIGIN_REQUIRED", message: "Feed generation requires a valid site.origin.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.OriginlessFeedsDiagnose#2

Authored path: `fullSite.deployment.OriginlessFeedsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 59.

```reaction
when Diagnosing.report (code: "ORIGIN_REQUIRED", message: "Feed generation requires a valid site.origin.", severity: "error", source: "site.yaml"), asked by fullSite.deployment.OriginlessFeedsDiagnose
where
  earlier, Deploying.prepareFeed (work, origin: false)
then
  Deploying.reject (work)
```

### fullSite.deployment.PaginationContextsRender

Authored path: `fullSite.deployment.PaginationContextsRender`.
- Covered by [Syncpress application composition](../design/application.md), line 60.

```reaction
when Deploying.preparePageContext (work, context, owner, template)
then
  Templating.renderTemplate (context, subject: owner, template, trusted: [["page", "content"], (wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.deployment.PaginationTemplateFailuresDiagnose

Authored path: `fullSite.deployment.PaginationTemplateFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 61.

```reaction
when refused Templating.renderTemplate (subject: owner, detail, error)
where
  Deploying._forOwner (owner) has (kind: "pagination-page")
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml")
```

### fullSite.deployment.PaginationTemplateFailuresDiagnose#2

Authored path: `fullSite.deployment.PaginationTemplateFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 61.

```reaction
when Diagnosing.report (code: error, message: detail, severity: "error", source: "site.yaml"), asked by fullSite.deployment.PaginationTemplateFailuresDiagnose
where
  earlier, refused Templating.renderTemplate (subject: owner, detail, error)
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.deployment.PreparedFeedsBegin

Authored path: `fullSite.deployment.PreparedFeedsBegin`.
- Covered by [Syncpress application composition](../design/application.md), line 62.

```reaction
when Deploying.prepareFeed (work, origin: true, valid: true)
where
  Deploying._work (work) has (producer)
then
  Emitting.beginAttempt (producer)
```

### fullSite.deployment.PreparedRedirectsBegin

Authored path: `fullSite.deployment.PreparedRedirectsBegin`.
- Covered by [Syncpress application composition](../design/application.md), line 63.

```reaction
when Deploying.prepareRedirect (work)
where
  Deploying._work (work) has (producer)
then
  Emitting.beginAttempt (producer)
```

### fullSite.deployment.PreparedSitemapsBegin

Authored path: `fullSite.deployment.PreparedSitemapsBegin`.
- Covered by [Syncpress application composition](../design/application.md), line 64.

```reaction
when Deploying.prepareSitemap (work)
where
  Deploying._work (work) has (producer)
then
  Emitting.beginAttempt (producer)
```

### fullSite.deployment.RenderedPaginationLayoutsScan

Authored path: `fullSite.deployment.RenderedPaginationLayoutsScan`.
- Covered by [Syncpress application composition](../design/application.md), line 65.

```reaction
when Templating.renderTemplate (subject: owner, output)
where
  Deploying._forOwner (owner) has (kind: "pagination-page")
then
  Referencing.scan (part: "deployment-layout", subject: owner, text: output)
```

### fullSite.deployment.SnapshottedFeedInputsPrepare

Authored path: `fullSite.deployment.SnapshottedFeedInputsPrepare`.
- Covered by [Syncpress application composition](../design/application.md), line 66.

```reaction
when Deploying.snapshotFeed (work, description, entries, path, site, title)
where
  preparation is deploymentFeedPreparation (description, entries, path, site, title)
then
  Deploying.prepareFeed (preparation, work)
```

### fullSite.deployment.SnapshottedSitemapUrlsPrepare

Authored path: `fullSite.deployment.SnapshottedSitemapUrlsPrepare`.
- Covered by [Syncpress application composition](../design/application.md), line 67.

```reaction
when Deploying.snapshotSitemap (work, urls)
where
  content is deploymentSitemapDocument (urls)
then
  Deploying.prepareSitemap (content, work)
```

### fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose:diagnose

Authored path: `fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 68.

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "absolute", target: raw)
  no view "site URL of target (target)" with (target: raw)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "A generated layout reference could not be projected.", severity: "error", source: "site.yaml")
```

### fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose:reject

Authored path: `fullSite.deployment.UnprojectableDeploymentLayoutReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 68.

```reaction
when Referencing.scan (part: "deployment-layout", source)
where
  Referencing._source (source) has (subject: owner)
  Deploying._forOwner (owner)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "absolute", target: raw)
  no view "site URL of target (target)" with (target: raw)
then
  Deploying.rejectOwnerWork (owner)
```

### fullSite.endpoints.AdvanceSiteBuild

Authored path: `fullSite.endpoints.AdvanceSiteBuild`.
- Covered by [Syncpress application composition](../design/application.md), line 69.

```reaction
when Phasing.completePhase (attempt, job, name: "site-build", transitioned: true)
at the flow's settlement frontier
where
  Phasing._job (job) has (attempt: nextAttempt, name: "site-build", state: "running")
  no view "pending failed rendering cleanup"
then
  Phasing.completePhase (attempt: nextAttempt, job)
```

### fullSite.endpoints.AdvanceStartedSiteBuild

Authored path: `fullSite.endpoints.AdvanceStartedSiteBuild`.
- Covered by [Syncpress application composition](../design/application.md), line 70.

```reaction
when Phasing.start (sequence, attempt, job, name: "site-build")
at the flow's settlement frontier
where
  Phasing._running (sequence) has (attempt, job, name: "site-build")
then
  Phasing.completePhase (attempt, job)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when RequestBoundary.request (destination, directory, path: "/site/build", requestId)
where
  isAbsentValue (value: destination)
then
  Locating.recordRequest (name: "site", path: directory)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput#2

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when Locating.recordRequest (name: "site", path: directory), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput
then
  Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"])
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput#3

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"], sequence), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#2
then
  Phasing.start (sequence)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput#4

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when Phasing.start (sequence, job), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#3
at the flow's settlement frontier
where
  view "the settled site build of job (job)" with (job)
then
  DeliveryArbitration.settle (task: job)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:errors#5

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: false)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_HAS_ERRORS", requestId)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:failed#5

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "the settled site build of job (job)" with (job) has (state: "failed")
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_FAILED", requestId)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:incomplete#5

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: true)
  no view "job (job) is a publishable site build" with (job)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_INCOMPLETE", requestId)
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:published#5

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput#4
where
  view "job (job) is a publishable site build" with (job)
then
  Emitting.reconcile ()
```

### fullSite.endpoints.BuildSiteAtConfiguredOutput:published#6

Authored path: `fullSite.endpoints.BuildSiteAtConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 71.
- Covered by [Syncpress application composition](../design/application.md), line 242.

```reaction
when Emitting.reconcile (kept, removed, replaced, written), asked by fullSite.endpoints.BuildSiteAtConfiguredOutput:published#5
where
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (kept, removed, replaced, requestId, summary: former "the site build summary", written)
```

### fullSite.endpoints.BuildSiteAtDestination

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when RequestBoundary.request (destination, directory, path: "/site/build", requestId)
where
  isTextValue (value: destination)
then
  Locating.recordRequest (name: "site", path: directory)
```

### fullSite.endpoints.BuildSiteAtDestination#2

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when Locating.recordRequest (name: "site", path: directory), asked by fullSite.endpoints.BuildSiteAtDestination
where
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  Locating.recordRequest (name: "destination", path: destination)
```

### fullSite.endpoints.BuildSiteAtDestination#3

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when Locating.recordRequest (name: "destination", path: destination), asked by fullSite.endpoints.BuildSiteAtDestination#2
then
  Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"])
```

### fullSite.endpoints.BuildSiteAtDestination#4

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"], sequence), asked by fullSite.endpoints.BuildSiteAtDestination#3
then
  Phasing.start (sequence)
```

### fullSite.endpoints.BuildSiteAtDestination#5

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when Phasing.start (sequence, job), asked by fullSite.endpoints.BuildSiteAtDestination#4
at the flow's settlement frontier
where
  view "the settled site build of job (job)" with (job)
then
  DeliveryArbitration.settle (task: job)
```

### fullSite.endpoints.BuildSiteAtDestination:errors#6

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: false)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_HAS_ERRORS", requestId)
```

### fullSite.endpoints.BuildSiteAtDestination:failed#6

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "the settled site build of job (job)" with (job) has (state: "failed")
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_FAILED", requestId)
```

### fullSite.endpoints.BuildSiteAtDestination:incomplete#6

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  Diagnosing._clean () has (clean: true)
  no view "job (job) is a publishable site build" with (job)
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (error: "BUILD_INCOMPLETE", requestId)
```

### fullSite.endpoints.BuildSiteAtDestination:published#6

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.BuildSiteAtDestination#5
where
  view "job (job) is a publishable site build" with (job)
then
  Emitting.reconcile ()
```

### fullSite.endpoints.BuildSiteAtDestination:published#7

Authored path: `fullSite.endpoints.BuildSiteAtDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 72.
- Covered by [Syncpress application composition](../design/application.md), line 243.

```reaction
when Emitting.reconcile (kept, removed, replaced, written), asked by fullSite.endpoints.BuildSiteAtDestination:published#6
where
  earlier, RequestBoundary.request (destination, directory, path: "/site/build", requestId)
then
  RequestBoundary.respond (kept, removed, replaced, requestId, summary: former "the site build summary", written)
```

### fullSite.endpoints.InspectSite

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
then
  Locating.recordRequest (name: "site", path: directory)
```

### fullSite.endpoints.InspectSite#2

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when Locating.recordRequest (name: "site", path: directory), asked by fullSite.endpoints.InspectSite
then
  Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"])
```

### fullSite.endpoints.InspectSite#3

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when Phasing.declare (name: "site-build", phases: ["locate", "stage", "settings", "read", "route", "excerpt", "collect", "render", "emit"], sequence), asked by fullSite.endpoints.InspectSite#2
then
  Phasing.start (sequence)
```

### fullSite.endpoints.InspectSite#4

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when Phasing.start (sequence, job), asked by fullSite.endpoints.InspectSite#3
at the flow's settlement frontier
where
  view "the settled site build of job (job)" with (job)
then
  DeliveryArbitration.settle (task: job)
```

### fullSite.endpoints.InspectSite:failed#5

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.InspectSite#4
where
  view "the settled site build of job (job)" with (job) has (state: "failed")
  earlier, RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
then
  RequestBoundary.respond (error: "BUILD_FAILED", requestId)
```

### fullSite.endpoints.InspectSite:found#5

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.InspectSite#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  earlier, RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
  view "the inspection owner of target (target)" with (target) has (owner)
then
  RequestBoundary.respond (inspection: former "the site inspection of owner (owner)" with (owner), owner, requestId)
```

### fullSite.endpoints.InspectSite:missing#5

Authored path: `fullSite.endpoints.InspectSite`.
- Covered by [Syncpress application composition](../design/application.md), line 73.
- Covered by [Syncpress application composition](../design/application.md), line 244.

```reaction
when DeliveryArbitration.settle (task: job, interrupted: false), asked by fullSite.endpoints.InspectSite#4
where
  view "the settled site build of job (job)" with (job) has (state: "finished")
  earlier, RequestBoundary.request (directory, path: "/site/inspect", requestId, target)
  no view "the inspection owner of target (target)" with (target)
then
  RequestBoundary.respond (error: "INSPECTION_TARGET_NOT_FOUND", requestId)
```

### fullSite.endpoints.ReadSiteSummary

Authored path: `fullSite.endpoints.ReadSiteSummary`.
- Covered by [Syncpress application composition](../design/application.md), line 74.
- Covered by [Syncpress application composition](../design/application.md), line 245.

```reaction
when RequestBoundary.request (path: "/site/summary", requestId)
then
  RequestBoundary.respond (requestId, summary: former "the site build summary")
```

### fullSite.endpoints.SiteBuildFaultsInterruptAggregateDelivery

Authored path: `fullSite.endpoints.SiteBuildFaultsInterruptAggregateDelivery`.
- Covered by [Syncpress application composition](../design/application.md), line 75.

```reaction
when any action is faulted
where
  earlier, Phasing.start (job, name: "site-build")
then
  DeliveryArbitration.recordInterruption (task: job)
```

### fullSite.endpoints.SiteBuildRefusalsInterruptAggregateDelivery

Authored path: `fullSite.endpoints.SiteBuildRefusalsInterruptAggregateDelivery`.
- Covered by [Syncpress application composition](../design/application.md), line 76.

```reaction
when any action is refused
where
  earlier, Phasing.start (job, name: "site-build")
then
  DeliveryArbitration.recordInterruption (task: job)
```

### fullSite.excerpts.ExcerptConversionFailuresDiagnose

Authored path: `fullSite.excerpts.ExcerptConversionFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 77.

```reaction
when refused Converting.convert (part: "excerpt", subject: page, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "excerpt", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: path)
```

### fullSite.excerpts.PageExcerptsConvert

Authored path: `fullSite.excerpts.PageExcerptsConvert`.
- Covered by [Syncpress application composition](../design/application.md), line 78.

```reaction
when Phasing.completePhase (name: "site-build", phase: "excerpt", transitioned: true)
where
  Routing._claims () has (owner: page)
  DocumentParsing._document (subject: page) has (body)
  RenderTracking._latest (subject: page) has (profile: profileName)
  Converting._profile (name: profileName) has (profile)
then
  Converting.convert (part: "excerpt", profile, source: body, subject: page)
```

### fullSite.images.AdmittedRasterImagesRender

Authored path: `fullSite.images.AdmittedRasterImagesRender`.
- Covered by [Syncpress application composition](../design/application.md), line 79.

```reaction
when Transcoding.ingest (original)
where
  Governing._images () has (formats, widths)
then
  Transcoding.generateRenditions (formats, original, widths)
```

### fullSite.images.CompletedEmbeddingsAnswer

Authored path: `fullSite.images.CompletedEmbeddingsAnswer`.
- Covered by [Syncpress application composition](../design/application.md), line 80.

```reaction
when Embedding.provideCandidate (embedding, completed: true)
where
  Embedding._embedding (embedding) has (subject: reference)
  Embedding._markup (embedding) has (markup)
then
  Referencing.resolve (form: "markup", reference, value: markup)
```

### fullSite.images.DeclaredEmbeddingsAnswer

Authored path: `fullSite.images.DeclaredEmbeddingsAnswer`.
- Covered by [Syncpress application composition](../design/application.md), line 81.

```reaction
when Embedding.declare (completed: true, embedding)
where
  Embedding._embedding (embedding) has (subject: reference)
  Embedding._markup (embedding) has (markup)
then
  Referencing.resolve (form: "markup", reference, value: markup)
```

### fullSite.images.PrimaryRasterImagesAdmit

Authored path: `fullSite.images.PrimaryRasterImagesAdmit`.
- Covered by [Syncpress application composition](../design/application.md), line 82.

```reaction
when Referencing.scan (part: "body", source)
where
  view "primary raster body asset reference of source (source)" with (source) has (content, image)
then
  Transcoding.ingest (content, subject: image)
```

### fullSite.images.RasterAdmissionsDiagnose

Authored path: `fullSite.images.RasterAdmissionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 83.

```reaction
when refused Transcoding.ingest (subject: image, detail, error)
where
  earlier, Referencing.scan (part: "body", source)
  view "resolved local body reference of source (source)" with (source) has (page, role: "image", target: image)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterEmbeddingDeclarationsDiagnose

Authored path: `fullSite.images.RasterEmbeddingDeclarationsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 84.

```reaction
when refused Embedding.declare (subject: reference, detail, error)
where
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "body", subject: rendering)
  RenderTracking._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterFallbacksDeclare

Authored path: `fullSite.images.RasterFallbacksDeclare`.
- Covered by [Syncpress application composition](../design/application.md), line 85.

```reaction
when Emitting.intend (attempt: emissionAttempt, path: sourcePath, producer: page)
where
  earlier, Transcoding.generateRenditions (original, derived)
  earlier, Referencing.scan (part: "body", subject: rendering, source)
  view "primary raster body asset reference of source (source)" with (source) has (image, page, raw, reference, rendering, sourcePath)
  RenderTracking._active (rendering) has (emissionAttempt)
  Referencing._reference (reference) has (attributes, label)
  Transcoding._original (subject: image) has (original)
  view "address of output path (path)" with (path: sourcePath) has (address)
  view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address) has (target: fallback)
  Transcoding._renditions (original) has (fallback: true, format, height, width)
then
  Embedding.declare (alternative: label, attributes, expects: derived, height, original: fallback, originalFormat: format, subject: reference, width)
```

### fullSite.images.RasterFallbacksStage

Authored path: `fullSite.images.RasterFallbacksStage`.
- Covered by [Syncpress application composition](../design/application.md), line 86.

```reaction
when Transcoding.generateRenditions (original)
where
  earlier, Referencing.scan (part: "body", source)
  view "primary raster body asset reference of source (source)" with (source) has (image, page, rendering, sourcePath)
  Transcoding._original (subject: image) has (original)
  RenderTracking._active (rendering) has (emissionAttempt)
  Transcoding._renditions (original) has (content, fallback: true, mediaType)
then
  Emitting.intend (attempt: emissionAttempt, claim: image, content, medium: mediaType, path: sourcePath, producer: page)
```

### fullSite.images.RasterOffersDiagnose

Authored path: `fullSite.images.RasterOffersDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 87.

```reaction
when refused Embedding.provideCandidate (embedding, detail, error)
where
  Embedding._embedding (embedding) has (subject: reference)
  Referencing._reference (reference) has (source)
  Referencing._source (source) has (part: "body", subject: rendering)
  RenderTracking._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterRendersDiagnose

Authored path: `fullSite.images.RasterRendersDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 88.

```reaction
when refused Transcoding.generateRenditions (original, detail, error)
where
  earlier, Referencing.scan (part: "body", source)
  view "resolved local body reference of source (source)" with (source) has (page, role: "image", target: image)
  Transcoding._original (subject: image) has (original)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.images.RasterRenditionsOffer

Authored path: `fullSite.images.RasterRenditionsOffer`.
- Covered by [Syncpress application composition](../design/application.md), line 89.

```reaction
when Emitting.intend (path, producer: page)
where
  earlier, Embedding.declare (embedding)
  view "responsive body image embedding (embedding)" with (embedding) has (original, page)
  Transcoding._renditions (original) has (fallback: false, format, name, order, width)
  Governing._paths () has (assets)
  view "path joining prefix (prefix) and name (name)" with (name, prefix: assets) has (path)
  view "address of output path (path)" with (path) has (address)
then
  Embedding.provideCandidate (address, embedding, format, order, width)
```

### fullSite.images.RasterRenditionsStage

Authored path: `fullSite.images.RasterRenditionsStage`.
- Covered by [Syncpress application composition](../design/application.md), line 90.

```reaction
when Embedding.declare (embedding)
where
  view "responsive body image embedding (embedding)" with (embedding) has (original, page, rendering)
  RenderTracking._active (rendering) has (emissionAttempt)
  Transcoding._renditions (original) has (content, fallback: false, mediaType, name, rendition)
  Governing._paths () has (assets)
  view "path joining prefix (prefix) and name (name)" with (name, prefix: assets) has (path)
then
  Emitting.intend (attempt: emissionAttempt, claim: rendition, content, medium: mediaType, path, producer: page)
```

### fullSite.images.UnretargetableRasterPrimaryImagesDiagnose

Authored path: `fullSite.images.UnretargetableRasterPrimaryImagesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 91.

```reaction
when Referencing.scan (part: "body", source)
where
  view "primary raster body asset reference of source (source)" with (source) has (page, raw, sourcePath: assetPath)
  view "address of output path (path)" with (path: assetPath) has (address)
  no view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address)
  Filing._file (file: page) has (path: pagePath)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference cannot be safely retargeted.", scope: "page-rendering", severity: "error", source: pagePath)
```

### fullSite.references.AbsoluteLayoutReferencesRebase

Authored path: `fullSite.references.AbsoluteLayoutReferencesRebase`.
- Covered by [Syncpress application composition](../design/application.md), line 92.

```reaction
when Referencing.scan (part: "layout", source)
where
  Referencing._references (source) has (raw, reference)
  targetHasKind (kind: "absolute", target: raw)
  view "site URL of target (target)" with (target: raw) has (url)
then
  Referencing.resolve (form: "address", reference, value: url)
```

### fullSite.references.ClaimedBodyReferencesRetarget

Authored path: `fullSite.references.ClaimedBodyReferencesRetarget`.
- Covered by [Syncpress application composition](../design/application.md), line 93.

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (raw, reference, target)
  Routing._address (owner: target) has (address)
  view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address) has (target: value)
then
  Referencing.resolve (form: "address", reference, value)
```

### fullSite.references.CopiedBodyAssetsAnswer

Authored path: `fullSite.references.CopiedBodyAssetsAnswer`.
- Covered by [Syncpress application composition](../design/application.md), line 94.

```reaction
when Emitting.intend (path: sourcePath, producer: page)
where
  earlier, Referencing.scan (part: "body", subject: rendering, source)
  view "copyable body asset of source (source)" with (source) has (page, raw, reference, rendering, sourcePath)
  view "address of output path (path)" with (path: sourcePath) has (address)
  view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address) has (target: value)
then
  Referencing.resolve (form: "address", reference, value)
```

### fullSite.references.CopyableBodyAssetsCopy

Authored path: `fullSite.references.CopyableBodyAssetsCopy`.
- Covered by [Syncpress application composition](../design/application.md), line 95.

```reaction
when Referencing.scan (part: "body", source)
where
  view "copyable body asset of source (source)" with (source) has (asset: target, content, page, rendering, sourcePath)
  RenderTracking._active (rendering) has (emissionAttempt)
then
  Emitting.intend (attempt: emissionAttempt, claim: target, content, medium: "application/octet-stream", path: sourcePath, producer: page)
```

### fullSite.references.InvalidBodyReferencesDiagnose

Authored path: `fullSite.references.InvalidBodyReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 96.

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw)
  Filing._resolution (address: raw, file: page) has (status: "invalid")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference has an invalid path spelling.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.MissingAbsoluteReferencesDiagnose

Authored path: `fullSite.references.MissingAbsoluteReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 97.

```reaction
when any action is returned (action, concept: "Deploying", result)
where
  deploymentTransitionCompleted (action, result)
  Deploying._outcome () has (state: "completed")
  view "site-absolute reference without a produced target" has (target)
then
  Diagnosing.report (code: "MISSING_OUTPUT_REFERENCE", message: "No generated route or output file matches this reference.", scope: "site-reference-checking", severity: "warning", source: target)
```

### fullSite.references.MissingBodyReferencesDiagnose

Authored path: `fullSite.references.MissingBodyReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 98.

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw)
  Filing._resolution (address: raw, file: page) has (status: "missing")
  Filing._file (file: page) has (path: pagePath)
  view "prospective URL for local reference (raw) from source path (sourcePath)" with (raw, sourcePath: pagePath) has (target: address)
then
  Diagnosing.report (code: "MISSING_OUTPUT_REFERENCE", message: "No generated route or output file matches this reference.", scope: "site-reference-checking", severity: "warning", source: address)
```

### fullSite.references.MissingBodyReferencesHold

Authored path: `fullSite.references.MissingBodyReferencesHold`.
- Covered by [Syncpress application composition](../design/application.md), line 99.

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw, reference)
  Filing._resolution (address: raw, file: page) has (status: "missing")
  Filing._file (file: page) has (path: pagePath)
  view "prospective URL for local reference (raw) from source path (sourcePath)" with (raw, sourcePath: pagePath) has (value)
then
  Referencing.resolve (form: "address", reference, value)
```

### fullSite.references.NonlocalBodyReferencesHold

Authored path: `fullSite.references.NonlocalBodyReferencesHold`.
- Covered by [Syncpress application composition](../design/application.md), line 100.

```reaction
when Referencing.scan (part: "body", source)
where
  view "held body reference of source (source)" with (source) has (raw, reference)
then
  Referencing.resolve (form: "address", reference, value: raw)
```

### fullSite.references.NonlocalLayoutReferencesHold

Authored path: `fullSite.references.NonlocalLayoutReferencesHold`.
- Covered by [Syncpress application composition](../design/application.md), line 101.

```reaction
when Referencing.scan (part: "layout", source)
where
  view "held layout reference of source (source)" with (source) has (raw, reference)
then
  Referencing.resolve (form: "address", reference, value: raw)
```

### fullSite.references.OutsideBodyReferencesDiagnose

Authored path: `fullSite.references.OutsideBodyReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 102.

```reaction
when Referencing.scan (part: "body", source)
where
  view "relative body reference of source (source)" with (source) has (page, raw)
  Filing._resolution (address: raw, file: page) has (status: "outside")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "OUTSIDE_LOCAL_REFERENCE", message: "This local reference leaves the content root.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.RelativeLayoutReferencesDiagnose

Authored path: `fullSite.references.RelativeLayoutReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 103.

```reaction
when Referencing.scan (part: "layout", source)
where
  Referencing._source (source) has (subject: rendering)
  RenderTracking._active (rendering) has (subject: page)
  Referencing._references (source) has (raw)
  targetHasKind (kind: "relative", target: raw)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "RELATIVE_LAYOUT_REFERENCE", message: "A layout reference must be site-absolute, external, or fragment-only.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.UnpublishedDocumentBodyReferencesDiagnose

Authored path: `fullSite.references.UnpublishedDocumentBodyReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 104.

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (page, raw, target)
  no Routing._address (owner: target)
  DocumentParsing._document (subject: target)
  Filing._file (file: target) has (root)
  Filing._root (root) has (name: "content")
  Filing._file (file: page) has (path: pagePath)
  view "prospective URL for local reference (raw) from source path (sourcePath)" with (raw, sourcePath: pagePath) has (target: address)
then
  Diagnosing.report (code: "MISSING_OUTPUT_REFERENCE", message: "No generated route or output file matches this reference.", scope: "site-reference-checking", severity: "warning", source: address)
```

### fullSite.references.UnpublishedDocumentBodyReferencesHold

Authored path: `fullSite.references.UnpublishedDocumentBodyReferencesHold`.
- Covered by [Syncpress application composition](../design/application.md), line 105.

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (page, raw, reference, target)
  no Routing._address (owner: target)
  DocumentParsing._document (subject: target)
  Filing._file (file: target) has (root)
  Filing._root (root) has (name: "content")
  Filing._file (file: page) has (path: pagePath)
  view "prospective URL for local reference (raw) from source path (sourcePath)" with (raw, sourcePath: pagePath) has (value)
then
  Referencing.resolve (form: "address", reference, value)
```

### fullSite.references.UnretargetableClaimedBodyReferencesDiagnose

Authored path: `fullSite.references.UnretargetableClaimedBodyReferencesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 106.

```reaction
when Referencing.scan (part: "body", source)
where
  view "resolved local body reference of source (source)" with (source) has (page, raw, target)
  Routing._address (owner: target) has (address)
  no view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference cannot be safely retargeted.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.references.UnretargetableCopiedBodyAssetsDiagnose

Authored path: `fullSite.references.UnretargetableCopiedBodyAssetsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 107.

```reaction
when Referencing.scan (part: "body", source)
where
  view "copyable body asset of source (source)" with (source) has (page, raw, sourcePath: assetPath)
  view "address of output path (path)" with (path: assetPath) has (address)
  no view "retargeted reference from original (original) to replacement (replacement)" with (original: raw, replacement: address)
  Filing._file (file: page) has (path: pagePath)
then
  Diagnosing.report (code: "INVALID_LOCAL_REFERENCE", message: "This local reference cannot be safely retargeted.", scope: "page-rendering", severity: "error", source: pagePath)
```

### fullSite.render.BodyConversionFailuresDiagnose

Authored path: `fullSite.render.BodyConversionFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 108.

```reaction
when refused Converting.convert (part: "body", subject: rendering, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.BodyTemplateFailuresDiagnose

Authored path: `fullSite.render.BodyTemplateFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 109.

```reaction
when refused Templating.renderSource (subject: rendering, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
  Templating._failureLocation (fallbackSource: path, subject: rendering) has (column, line, source)
then
  Diagnosing.report (code: error, column, line, message: detail, scope: "page-rendering", severity: "error", source)
```

### fullSite.render.BodyTemplateFailuresFailRendering

Authored path: `fullSite.render.BodyTemplateFailuresFailRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 110.

```reaction
when refused Templating.renderSource (subject: rendering, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._active (rendering)
then
  RenderTracking.fail (reason: error, rendering)
```

### fullSite.render.ClaimedRoutesBeginPageDependencies

Authored path: `fullSite.render.ClaimedRoutesBeginPageDependencies`.
- Covered by [Syncpress application composition](../design/application.md), line 111.

```reaction
when Routing.claim (owner: page)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
then
  DependencyTracking.beginAttempt (subject: page)
```

### fullSite.render.CommittedPageOutputsSettleDependencies

Authored path: `fullSite.render.CommittedPageOutputsSettleDependencies`.
- Covered by [Syncpress application composition](../design/application.md), line 112.

```reaction
when Emitting.commitAttempt (attempt: emissionAttempt, producer: page)
where
  earlier, RenderTracking.completeLayout (rendering, subject: page, transitioned: true)
  RenderTracking._latest (subject: page) has (dependencyAttempt, emissionAttempt, rendering, stage: "completed")
then
  DependencyTracking.settleAttempt (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.ConvertedBodiesScan

Authored path: `fullSite.render.ConvertedBodiesScan`.
- Covered by [Syncpress application composition](../design/application.md), line 113.

```reaction
when Converting.convert (part: "body", subject: rendering, output)
then
  Referencing.scan (part: "body", subject: rendering, text: output)
```

### fullSite.render.EmptyBodyScansSettleRendering

Authored path: `fullSite.render.EmptyBodyScansSettleRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 114.

```reaction
when Referencing.scan (part: "body", subject: rendering, completed: true)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
then
  RenderTracking.completeBody (rendering)
```

### fullSite.render.EmptyLayoutScansSettleRendering

Authored path: `fullSite.render.EmptyLayoutScansSettleRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 115.

```reaction
when Referencing.scan (part: "layout", subject: rendering, completed: true)
where
  RenderTracking._active (rendering)
then
  RenderTracking.completeLayout (rendering)
```

### fullSite.render.FailedRenderingsAbandonDependencies

Authored path: `fullSite.render.FailedRenderingsAbandonDependencies`.
- Covered by [Syncpress application composition](../design/application.md), line 116.

```reaction
when RenderTracking.fail (rendering, subject: page, transitioned: true)
at the flow's settlement frontier
where
  RenderTracking._latest (subject: page) has (dependencyAttempt, rendering, stage: "failed")
then
  DependencyTracking.abandonAttempt (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.FailedRenderingsAbortOutput

Authored path: `fullSite.render.FailedRenderingsAbortOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 117.

```reaction
when RenderTracking.fail (rendering, subject: page, transitioned: true)
at the flow's settlement frontier
where
  RenderTracking._latest (subject: page) has (emissionAttempt, rendering, stage: "failed")
then
  Emitting.abortAttempt (attempt: emissionAttempt, producer: page)
```

### fullSite.render.FilledBodiesConvert

Authored path: `fullSite.render.FilledBodiesConvert`.
- Covered by [Syncpress application composition](../design/application.md), line 118.

```reaction
when Templating.renderSource (subject: rendering, output)
where
  RenderTracking._active (rendering) has (profile: name)
  Converting._profile (name) has (profile)
then
  Converting.convert (part: "body", profile, source: output, subject: rendering)
```

### fullSite.render.FilledBodiesTrackTemplates

Authored path: `fullSite.render.FilledBodiesTrackTemplates`.
- Covered by [Syncpress application composition](../design/application.md), line 119.

```reaction
when Templating.renderSource (subject: rendering, filling)
where
  RenderTracking._active (rendering) has (dependencyAttempt, subject: page)
  Templating._tree (owner: filling) has (used)
  Templating._template (name: used) has (template)
then
  DependencyTracking.recordDependency (attempt: dependencyAttempt, input: template, subject: page)
```

### fullSite.render.FinishedBodyAnswersSettleRendering

Authored path: `fullSite.render.FinishedBodyAnswersSettleRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 120.

```reaction
when Referencing.resolve (completed: true, part: "body", subject: rendering)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
then
  RenderTracking.completeBody (rendering)
```

### fullSite.render.FinishedLayoutAnswersSettleRendering

Authored path: `fullSite.render.FinishedLayoutAnswersSettleRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 121.

```reaction
when Referencing.resolve (completed: true, part: "layout", subject: rendering)
where
  RenderTracking._active (rendering)
then
  RenderTracking.completeLayout (rendering)
```

### fullSite.render.IntendedPageOutputsCommit

Authored path: `fullSite.render.IntendedPageOutputsCommit`.
- Covered by [Syncpress application composition](../design/application.md), line 122.

```reaction
when Emitting.intend (attempt: emissionAttempt, producer: page)
where
  earlier, RenderTracking.completeLayout (rendering, subject: page, transitioned: true)
  RenderTracking._latest (subject: page) has (emissionAttempt, rendering, stage: "completed")
then
  Emitting.commitAttempt (attempt: emissionAttempt, producer: page)
```

### fullSite.render.InvalidPageRenderingSelectionsAbandonDependencies

Authored path: `fullSite.render.InvalidPageRenderingSelectionsAbandonDependencies`.
- Covered by [Syncpress application composition](../design/application.md), line 123.

```reaction
when Emitting.beginAttempt (producer: page, attempt: emissionAttempt)
where
  earlier, DependencyTracking.beginAttempt (subject: page, attempt: dependencyAttempt)
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  view "the invalid rendering selection for path (path) and data (data)" with (data, path)
then
  DependencyTracking.abandonAttempt (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.InvalidPageRenderingSelectionsAbortOutput

Authored path: `fullSite.render.InvalidPageRenderingSelectionsAbortOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 124.

```reaction
when Emitting.beginAttempt (producer: page, attempt: emissionAttempt)
where
  earlier, DependencyTracking.beginAttempt (subject: page)
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  view "the invalid rendering selection for path (path) and data (data)" with (data, path)
then
  Emitting.abortAttempt (attempt: emissionAttempt, producer: page)
```

### fullSite.render.InvalidPageRenderingSelectionsDiagnose

Authored path: `fullSite.render.InvalidPageRenderingSelectionsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 125.

```reaction
when Emitting.beginAttempt (producer: page, attempt: emissionAttempt)
where
  earlier, DependencyTracking.beginAttempt (subject: page)
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  view "the invalid rendering selection for path (path) and data (data)" with (data, path) has (detail, error)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.LayoutTemplateFailuresDiagnose

Authored path: `fullSite.render.LayoutTemplateFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 126.

```reaction
when refused Templating.renderTemplate (subject: rendering, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._active (rendering) has (subject: page)
  Filing._file (file: page) has (path)
  Templating._failureLocation (fallbackSource: path, subject: rendering) has (column, line, source)
then
  Diagnosing.report (code: error, column, line, message: detail, scope: "page-rendering", severity: "error", source)
```

### fullSite.render.LayoutTemplateFailuresFailRendering

Authored path: `fullSite.render.LayoutTemplateFailuresFailRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 127.

```reaction
when refused Templating.renderTemplate (subject: rendering, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._active (rendering)
then
  RenderTracking.fail (reason: error, rendering)
```

### fullSite.render.MissingRenderingProfilesDiagnose

Authored path: `fullSite.render.MissingRenderingProfilesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 128.

```reaction
when Templating.renderSource (subject: rendering)
where
  RenderTracking._active (rendering) has (profile: name, subject: page)
  no Converting._profile (name)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "PROFILE_NOT_FOUND", message: "The selected body conversion profile is not defined.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.MissingRenderingTemplatesDiagnose

Authored path: `fullSite.render.MissingRenderingTemplatesDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 129.

```reaction
when RenderTracking.completeBody (rendering, subject: page, transitioned: true)
where
  RenderTracking._active (rendering) has (template: name)
  no Templating._template (name)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: "TEMPLATE_NOT_FOUND", message: "The selected page template is not defined.", scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.PageAssetEmissionFailuresDiagnose

Authored path: `fullSite.render.PageAssetEmissionFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 130.

```reaction
when refused Emitting.intend (attempt: emissionAttempt, producer: page, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._latest (subject: page) has (emissionAttempt, rendering: pageRendering)
  RenderTracking._active (rendering: pageRendering)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.PageDependenciesOpenEmission

Authored path: `fullSite.render.PageDependenciesOpenEmission`.
- Covered by [Syncpress application composition](../design/application.md), line 131.

```reaction
when DependencyTracking.beginAttempt (subject: page)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  Filing._file (file: page)
then
  Emitting.beginAttempt (producer: page)
```

### fullSite.render.PageEmissionFailuresDiagnose

Authored path: `fullSite.render.PageEmissionFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 132.

```reaction
when refused Emitting.intend (attempt: emissionAttempt, producer: page, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._latest (subject: page) has (emissionAttempt, stage: "completed")
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.PageEmissionsBeginRendering

Authored path: `fullSite.render.PageEmissionsBeginRendering`.
- Covered by [Syncpress application composition](../design/application.md), line 133.

```reaction
when Emitting.beginAttempt (producer: page, attempt: emissionAttempt)
where
  earlier, DependencyTracking.beginAttempt (subject: page, attempt: dependencyAttempt)
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  DependencyTracking._attempt (subject: page) has (attempt: dependencyAttempt)
  Filing._file (file: page) has (path)
  Layering._resolved (subject: page) has (values: data)
  pageRenderingSelectionHasValidity (data, path, valid: true)
  profile is pageRenderingProfile (data, path)
  template is pageRenderingTemplate (data, path)
then
  RenderTracking.begin (dependencyAttempt, emissionAttempt, path, profile, subject: page, template)
```

### fullSite.render.RenderedLayoutsScan

Authored path: `fullSite.render.RenderedLayoutsScan`.
- Covered by [Syncpress application composition](../design/application.md), line 134.

```reaction
when Templating.renderTemplate (subject: rendering, output)
where
  RenderTracking._active (rendering)
then
  Referencing.scan (part: "layout", subject: rendering, text: output)
```

### fullSite.render.RenderedLayoutsTrackTemplates

Authored path: `fullSite.render.RenderedLayoutsTrackTemplates`.
- Covered by [Syncpress application composition](../design/application.md), line 135.

```reaction
when Templating.renderTemplate (subject: attempt, rendering)
where
  RenderTracking._active (rendering: attempt) has (dependencyAttempt: attemptDependency, subject: page)
  Templating._tree (owner: rendering) has (used)
  Templating._template (name: used) has (template)
then
  DependencyTracking.recordDependency (attempt: attemptDependency, input: template, subject: page)
```

### fullSite.render.RenderingAttemptsRetractDiagnostics

Authored path: `fullSite.render.RenderingAttemptsRetractDiagnostics`.
- Covered by [Syncpress application composition](../design/application.md), line 136.

```reaction
when Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
where
  Routing._claims () has (owner: page)
  RenderTracking._latest (subject: page) has (stage: "started")
  Filing._file (file: page) has (path)
then
  Diagnosing.retractGroup (scope: "page-rendering", source: path)
```

### fullSite.render.RenderingBeginningsAbandonDependencies

Authored path: `fullSite.render.RenderingBeginningsAbandonDependencies`.
- Covered by [Syncpress application composition](../design/application.md), line 137.

```reaction
when refused RenderTracking.begin (dependencyAttempt, subject: page, error)
where
  earlier, DependencyTracking.beginAttempt (subject: page, attempt: dependencyAttempt)
  DependencyTracking._attempt (subject: page) has (attempt: dependencyAttempt)
then
  DependencyTracking.abandonAttempt (attempt: dependencyAttempt, subject: page)
```

### fullSite.render.RenderingBeginningsAbortEmission

Authored path: `fullSite.render.RenderingBeginningsAbortEmission`.
- Covered by [Syncpress application composition](../design/application.md), line 138.

```reaction
when refused RenderTracking.begin (emissionAttempt, subject: page)
where
  earlier, Emitting.beginAttempt (producer: page, attempt: emissionAttempt)
  Emitting._open (producer: page) has (attempt: emissionAttempt)
then
  Emitting.abortAttempt (attempt: emissionAttempt, producer: page)
```

### fullSite.render.RenderingBeginningsDiagnose

Authored path: `fullSite.render.RenderingBeginningsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 139.

```reaction
when refused RenderTracking.begin (dependencyAttempt, emissionAttempt, subject: page, detail, error)
where
  DependencyTracking._attempt (subject: page) has (attempt: dependencyAttempt)
  Emitting._open (producer: page) has (attempt: emissionAttempt)
  Filing._file (file: page) has (path)
then
  Diagnosing.report (code: error, message: detail, scope: "page-rendering", severity: "error", source: path)
```

### fullSite.render.RenderingDiagnosticsFailActiveAttempts

Authored path: `fullSite.render.RenderingDiagnosticsFailActiveAttempts`.
- Covered by [Syncpress application composition](../design/application.md), line 140.

```reaction
when Diagnosing.report (code, scope: "page-rendering", severity: "error", source: path)
where
  Filing._named (name: "content") has (root)
  Filing._under (prefix: "", root) has (file: page, path)
  RenderTracking._latest (subject: page) has (rendering)
  RenderTracking._active (rendering)
then
  RenderTracking.fail (reason: code, rendering)
```

### fullSite.render.RetractedRenderingAttemptsTrackSource

Authored path: `fullSite.render.RetractedRenderingAttemptsTrackSource`.
- Covered by [Syncpress application composition](../design/application.md), line 141.

```reaction
when Diagnosing.retractGroup (scope: "page-rendering", source: path)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  Routing._claims () has (owner: page)
  RenderTracking._latest (subject: page) has (dependencyAttempt, stage: "started")
  Filing._file (file: page) has (path)
then
  DependencyTracking.recordDependency (attempt: dependencyAttempt, input: page, subject: page)
```

### fullSite.render.SettledBodiesRenderOriginatedPages

Authored path: `fullSite.render.SettledBodiesRenderOriginatedPages`.
- Covered by [Syncpress application composition](../design/application.md), line 142.

```reaction
when RenderTracking.completeBody (rendering, subject: page, transitioned: true)
where
  Routing._address (owner: page) has (address)
  view "absolute site URL of address (address)" with (address)
  RenderTracking._active (rendering) has (template: name)
  Templating._template (name) has (template)
then
  Templating.renderTemplate (context: former "the originated completed render context of rendering (rendering)" with (rendering), subject: rendering, template, trusted: [["page", "content"], (wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.render.SettledBodiesRenderUnoriginatedPages

Authored path: `fullSite.render.SettledBodiesRenderUnoriginatedPages`.
- Covered by [Syncpress application composition](../design/application.md), line 143.

```reaction
when RenderTracking.completeBody (rendering, subject: page, transitioned: true)
where
  Routing._address (owner: page) has (address)
  no view "absolute site URL of address (address)" with (address)
  RenderTracking._active (rendering) has (template: name)
  Templating._template (name) has (template)
then
  Templating.renderTemplate (context: former "the unoriginated completed render context of rendering (rendering)" with (rendering), subject: rendering, template, trusted: [["page", "content"], (wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.render.SettledLayoutsStagePageOutput

Authored path: `fullSite.render.SettledLayoutsStagePageOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 144.

```reaction
when RenderTracking.completeLayout (rendering, subject: page, transitioned: true)
where
  RenderTracking._latest (subject: page) has (emissionAttempt, rendering, stage: "completed")
  Referencing._finished (part: "layout", subject: rendering) has (text)
  Routing._address (owner: page) has (address)
  view "output path of address (address)" with (address) has (path)
then
  Emitting.intend (attempt: emissionAttempt, content: text, medium: "text/html", path, producer: page)
```

### fullSite.render.TrackedRenderingSourcesFillBodies:originated

Authored path: `fullSite.render.TrackedRenderingSourcesFillBodies`.
- Covered by [Syncpress application composition](../design/application.md), line 145.

```reaction
when DependencyTracking.recordDependency (attempt: dependencyAttempt, input: page, subject: page)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._latest (subject: page) has (dependencyAttempt, rendering, stage: "started")
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
  DocumentParsing._document (subject: page) has (body, bodyLine)
  Routing._address (owner: page) has (address)
  view "absolute site URL of address (address)" with (address)
then
  Templating.renderSource (context: former "the originated render context of rendering (rendering)" with (rendering), source: body, sourceLine: bodyLine, sourceName: path, subject: rendering, trusted: [(wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.render.TrackedRenderingSourcesFillBodies:unoriginated

Authored path: `fullSite.render.TrackedRenderingSourcesFillBodies`.
- Covered by [Syncpress application composition](../design/application.md), line 145.

```reaction
when DependencyTracking.recordDependency (attempt: dependencyAttempt, input: page, subject: page)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "render", transitioned: true)
  RenderTracking._latest (subject: page) has (dependencyAttempt, rendering, stage: "started")
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
  DocumentParsing._document (subject: page) has (body, bodyLine)
  Routing._address (owner: page) has (address)
  no view "absolute site URL of address (address)" with (address)
then
  Templating.renderSource (context: former "the unoriginated render context of rendering (rendering)" with (rendering), source: body, sourceLine: bodyLine, sourceName: path, subject: rendering, trusted: [(wildcard: ["collections", "*", "*", "excerpt"])])
```

### fullSite.routes.DerivedRoutesClaim

Authored path: `fullSite.routes.DerivedRoutesClaim`.
- Covered by [Syncpress application composition](../design/application.md), line 146.

```reaction
when Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
where
  DocumentParsing._all () has (subject: page)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
  Layering._flag (otherwise: true, path: ["build", "publish"], subject: page) has (value: true)
  no Layering._value (path: ["build", "route"], subject: page)
  view "derived address of path (path)" with (path) has (address)
then
  Routing.claim (address, owner: page)
```

### fullSite.routes.ExplicitRoutesClaim

Authored path: `fullSite.routes.ExplicitRoutesClaim`.
- Covered by [Syncpress application composition](../design/application.md), line 147.

```reaction
when Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
where
  DocumentParsing._all () has (subject: page)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (root)
  Layering._flag (otherwise: true, path: ["build", "publish"], subject: page) has (value: true)
  Layering._value (path: ["build", "route"], subject: page) has (value: address)
then
  Routing.claim (address, owner: page)
```

### fullSite.routes.InvalidRouteClaimsDiagnose

Authored path: `fullSite.routes.InvalidRouteClaimsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 148.

```reaction
when refused Routing.claim (owner: page, detail, error: "INVALID_ADDRESS")
where
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
then
  Diagnosing.report (code: "INVALID_ADDRESS", message: detail, severity: "error", source: path)
```

### fullSite.routes.RouteCollisionsReport

Authored path: `fullSite.routes.RouteCollisionsReport`.
- Covered by [Syncpress application composition](../design/application.md), line 149.

```reaction
when refused Routing.claim (owner: page, error: "ADDRESS_TAKEN")
where
  earlier, Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (path, root)
then
  Diagnosing.report (code: "ROUTE_COLLISION", message: "Two pages claim one address.", severity: "error", source: path)
```

### fullSite.routes.UnpublishedRoutesRelease

Authored path: `fullSite.routes.UnpublishedRoutesRelease`.
- Covered by [Syncpress application composition](../design/application.md), line 150.

```reaction
when Phasing.completePhase (name: "site-build", phase: "route", transitioned: true)
where
  DocumentParsing._all () has (subject: page)
  Filing._named (name: "content") has (root)
  Filing._file (file: page) has (root)
  Layering._flag (otherwise: true, path: ["build", "publish"], subject: page) has (value: false)
  Routing._address (owner: page)
then
  Routing.release (owner: page)
```

### fullSite.serving.CloseSiteServer

Authored path: `fullSite.serving.CloseSiteServer`.
- Covered by [Syncpress application composition](../design/application.md), line 151.
- Covered by [Syncpress application composition](../design/application.md), line 246.

```reaction
when RequestBoundary.request (path: "/serve/close", requestId, server)
then
  Serving.close (server)
```

### fullSite.serving.CloseSiteServer#2

Authored path: `fullSite.serving.CloseSiteServer`.
- Covered by [Syncpress application composition](../design/application.md), line 151.
- Covered by [Syncpress application composition](../design/application.md), line 246.

```reaction
when Serving.close (server), asked by fullSite.serving.CloseSiteServer
where
  earlier, RequestBoundary.request (path: "/serve/close", requestId, server)
then
  RequestBoundary.respond (requestId)
```

### fullSite.serving.OpenSiteServer

Authored path: `fullSite.serving.OpenSiteServer`.
- Covered by [Syncpress application composition](../design/application.md), line 152.
- Covered by [Syncpress application composition](../design/application.md), line 247.

```reaction
when RequestBoundary.request (host, path: "/serve/open", port, requestId)
then
  Serving.open (host, port)
```

### fullSite.serving.OpenSiteServer#2

Authored path: `fullSite.serving.OpenSiteServer`.
- Covered by [Syncpress application composition](../design/application.md), line 152.
- Covered by [Syncpress application composition](../design/application.md), line 247.

```reaction
when Serving.open (host, port, result.port: bound, server), asked by fullSite.serving.OpenSiteServer
where
  earlier, RequestBoundary.request (host, path: "/serve/open", port, requestId)
then
  RequestBoundary.respond (host, port: bound, requestId, server)
```

### fullSite.serving.PublishSiteOutput

Authored path: `fullSite.serving.PublishSiteOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 153.
- Covered by [Syncpress application composition](../design/application.md), line 248.

```reaction
when RequestBoundary.request (directory, path: "/serve/publish", requestId, server)
then
  Serving.serveDirectory (directory, server)
```

### fullSite.serving.PublishSiteOutput#2

Authored path: `fullSite.serving.PublishSiteOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 153.
- Covered by [Syncpress application composition](../design/application.md), line 248.

```reaction
when Serving.serveDirectory (directory, server, readers), asked by fullSite.serving.PublishSiteOutput
where
  earlier, RequestBoundary.request (directory, path: "/serve/publish", requestId, server)
then
  RequestBoundary.respond (readers, requestId)
```

### fullSite.settings.AssessedConfigurationProblemsDiagnose

Authored path: `fullSite.settings.AssessedConfigurationProblemsDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 154.

```reaction
when refused Governing.assess (error: "INVALID_CONFIGURATION")
where
  Governing._problems () has (code, column, line, message)
then
  Diagnosing.report (code, column, line, message, scope: "configuration-assessment", severity: "error", source: "site.yaml")
```

### fullSite.settings.ConfigurationAssessmentRetractsDiagnostics

Authored path: `fullSite.settings.ConfigurationAssessmentRetractsDiagnostics`.
- Covered by [Syncpress application composition](../design/application.md), line 155.

```reaction
when requested Governing.assess ()
then
  Diagnosing.retractGroup (scope: "configuration-assessment", source: "site.yaml")
```

### fullSite.settings.SettingsCollectionDeclarationFailuresDiagnose

Authored path: `fullSite.settings.SettingsCollectionDeclarationFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 156.

```reaction
when refused Cataloging.declare (detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
then
  Diagnosing.report (code: error, message: detail, scope: "configuration-settings", severity: "error", source: "site.yaml")
```

### fullSite.settings.SettingsDeclareCatalogs

Authored path: `fullSite.settings.SettingsDeclareCatalogs`.
- Covered by [Syncpress application composition](../design/application.md), line 157.

```reaction
when Cataloging.reset ()
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
  Governing._collections () has (condition, direction, match, name, sort)
then
  Cataloging.declare (condition, direction, name, selector: match, sort)
```

### fullSite.settings.SettingsDeclareMarkdownProfile

Authored path: `fullSite.settings.SettingsDeclareMarkdownProfile`.
- Covered by [Syncpress application composition](../design/application.md), line 158.

```reaction
when Diagnosing.retractGroup (scope: "configuration-settings", source: "site.yaml")
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (extensions, raw, separator)
then
  Converting.declareProfile (extensions, kind: "markdown", name: "markdown", raw, separator)
```

### fullSite.settings.SettingsDeclareVerbatimProfile

Authored path: `fullSite.settings.SettingsDeclareVerbatimProfile`.
- Covered by [Syncpress application composition](../design/application.md), line 159.

```reaction
when Diagnosing.retractGroup (scope: "configuration-settings", source: "site.yaml")
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (separator)
then
  Converting.declareProfile (extensions: [], kind: "verbatim", name: "verbatim", raw: true, separator)
```

### fullSite.settings.SettingsMarkdownProfileFailuresDiagnose

Authored path: `fullSite.settings.SettingsMarkdownProfileFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 160.

```reaction
when refused Converting.declareProfile (extensions, kind: "markdown", name: "markdown", raw, separator, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (extensions, raw, separator)
then
  Diagnosing.report (code: error, message: detail, scope: "configuration-settings", severity: "error", source: "site.yaml")
```

### fullSite.settings.SettingsPhaseRetractsDiagnostics

Authored path: `fullSite.settings.SettingsPhaseRetractsDiagnostics`.
- Covered by [Syncpress application composition](../design/application.md), line 161.

```reaction
when Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
then
  Diagnosing.retractGroup (scope: "configuration-settings", source: "site.yaml")
```

### fullSite.settings.SettingsResetCatalogs

Authored path: `fullSite.settings.SettingsResetCatalogs`.
- Covered by [Syncpress application composition](../design/application.md), line 162.

```reaction
when Diagnosing.retractGroup (scope: "configuration-settings", source: "site.yaml")
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
then
  Cataloging.reset ()
```

### fullSite.settings.SettingsVerbatimProfileFailuresDiagnose

Authored path: `fullSite.settings.SettingsVerbatimProfileFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 163.

```reaction
when refused Converting.declareProfile (extensions: [], kind: "verbatim", name: "verbatim", raw: true, separator, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
  Governing._markdown () has (separator)
then
  Diagnosing.report (code: error, message: detail, scope: "configuration-settings", severity: "error", source: "site.yaml")
```

### fullSite.sources.ClearedContentGetsAttributes

Authored path: `fullSite.sources.ClearedContentGetsAttributes`.
- Covered by [Syncpress application composition](../design/application.md), line 164.

```reaction
when Layering.clear (subject)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: subject) has (root)
  DocumentParsing._document (subject) has (attributes)
then
  Layering.contribute (rank: 9007199254740991, subject, values: attributes)
```

### fullSite.sources.ClearedContentGetsDefaults

Authored path: `fullSite.sources.ClearedContentGetsDefaults`.
- Covered by [Syncpress application composition](../design/application.md), line 165.

```reaction
when Layering.clear (subject)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root: content)
  Filing._file (file: subject) has (path, root: content)
  Governing._defaults () has (index, text, values)
  patternHasResult (matched: true, path, pattern: text)
then
  Layering.contribute (rank: index, subject, values)
```

### fullSite.sources.ContentDocumentsParse

Authored path: `fullSite.sources.ContentDocumentsParse`.
- Covered by [Syncpress application composition](../design/application.md), line 166.

```reaction
when Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
where
  view "content document file" has (file, text)
then
  DocumentParsing.parseDocument (subject: file, text)
```

### fullSite.sources.DocumentParseFailuresDiagnose

Authored path: `fullSite.sources.DocumentParseFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 167.

```reaction
when refused DocumentParsing.parseDocument (subject: file, detail, error: "MALFORMED_ATTRIBUTES")
where
  earlier, Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file) has (path, root)
then
  Diagnosing.report (code: "MALFORMED_ATTRIBUTES", message: detail, severity: "error", source: path)
```

### fullSite.sources.ParsedContentClearsLayers

Authored path: `fullSite.sources.ParsedContentClearsLayers`.
- Covered by [Syncpress application composition](../design/application.md), line 168.

```reaction
when DocumentParsing.parseDocument (subject)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "content") has (root)
  Filing._file (file: subject) has (root)
then
  Layering.clear (subject)
```

### fullSite.sources.PublicFilesIntendOutput

Authored path: `fullSite.sources.PublicFilesIntendOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 169.

```reaction
when Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
where
  Filing._named (name: "public") has (root)
  Filing._under (prefix: "", root) has (file, path)
  Filing._file (file) has (content)
then
  Emitting.intend (content, medium: "application/octet-stream", path, producer: file)
```

### fullSite.sources.TemplateDefinitionFailuresDiagnose

Authored path: `fullSite.sources.TemplateDefinitionFailuresDiagnose`.
- Covered by [Syncpress application composition](../design/application.md), line 170.

```reaction
when refused Templating.register (name: path, origin: file, source: text, detail, error)
where
  earlier, Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
  Filing._named (name: "templates") has (root)
  Filing._under (prefix: "", root) has (file, path)
  Filing._text (file) has (text)
then
  Diagnosing.report (code: error, message: detail, severity: "error", source: path)
```

### fullSite.sources.TemplatesDefine

Authored path: `fullSite.sources.TemplatesDefine`.
- Covered by [Syncpress application composition](../design/application.md), line 171.

```reaction
when Phasing.completePhase (name: "site-build", phase: "read", transitioned: true)
where
  Filing._named (name: "templates") has (root)
  Filing._under (prefix: "", root) has (file, path)
  Filing._text (file) has (text)
then
  Templating.register (name: path, origin: file, source: text)
```

### fullSite.staging.AdmittedConfigurationIsLoaded

Authored path: `fullSite.staging.AdmittedConfigurationIsLoaded`.
- Covered by [Syncpress application composition](../design/application.md), line 172.

```reaction
when Locating.inspectLocation (name: "settings", path, status: "admitted")
then
  Filing.replaceTreeFromFile (name: "project", path: "site.yaml", source: path)
```

### fullSite.staging.AdmittedSourceRootsAreLoaded

Authored path: `fullSite.staging.AdmittedSourceRootsAreLoaded`.
- Covered by [Syncpress application composition](../design/application.md), line 173.

```reaction
when Locating.inspectLocation (name: root, path: directory, contained: true, real, resolved: true, status: "admitted")
where
  Governing._sources () has (name: root, path: directory)
then
  Filing.replaceTreeFromDirectory (directory: real, name: root)
```

### fullSite.staging.BegunSiteBuildDeliveriesRetractStagingDiagnostics

Authored path: `fullSite.staging.BegunSiteBuildDeliveriesRetractStagingDiagnostics`.
- Covered by [Syncpress application composition](../design/application.md), line 174.

```reaction
when DeliveryArbitration.beginDelivery (task: job)
where
  earlier, Phasing.start (job, name: "site-build", phase: "locate")
then
  Diagnosing.retractGroup (scope: "project-staging", source: "site.yaml")
```

### fullSite.staging.ConfiguredOutputDirectsPublication

Authored path: `fullSite.staging.ConfiguredOutputDirectsPublication`.
- Covered by [Syncpress application composition](../design/application.md), line 175.

```reaction
when Locating.inspectLocation (name: "output", path: directory, contained: true, real, resolved: true, status: "admitted")
where
  view "the publication transaction prefix of destination (destination)" with (destination: real) has (prefix)
then
  Emitting.configureDestination (destination: real, prefix)
```

### fullSite.staging.DestinationDirectsPublication

Authored path: `fullSite.staging.DestinationDirectsPublication`.
- Covered by [Syncpress application composition](../design/application.md), line 176.

```reaction
when Locating.inspectLocation (name: "destination", path: directory, real, status: "admitted")
where
  view "the publication transaction prefix of destination (destination)" with (destination: real) has (prefix)
then
  Emitting.configureDestination (destination: real, prefix)
```

### fullSite.staging.EscapingConfiguredOutputDiagnoses

Authored path: `fullSite.staging.EscapingConfiguredOutputDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 177.

```reaction
when Locating.inspectLocation (name: "output", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "OUTPUT_OUTSIDE_SITE", message: "Configured paths.output must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.EscapingContentRootDiagnoses

Authored path: `fullSite.staging.EscapingContentRootDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 178.

```reaction
when Locating.inspectLocation (name: "content", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "SOURCE_OUTSIDE_SITE", message: "Configured paths.content must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.EscapingPublicRootDiagnoses

Authored path: `fullSite.staging.EscapingPublicRootDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 179.

```reaction
when Locating.inspectLocation (name: "public", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "SOURCE_OUTSIDE_SITE", message: "Configured paths.public must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.EscapingTemplateRootDiagnoses

Authored path: `fullSite.staging.EscapingTemplateRootDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 180.

```reaction
when Locating.inspectLocation (name: "templates", path: directory, place: admitted, status: "admitted")
where
  no Locating._place (place: admitted) has (contained: true, resolved: true)
then
  Diagnosing.report (code: "SOURCE_OUTSIDE_SITE", message: "Configured paths.templates must stay inside the site directory after resolving symbolic links.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.GroundedSiteAdmitsConfiguration

Authored path: `fullSite.staging.GroundedSiteAdmitsConfiguration`.
- Covered by [Syncpress application composition](../design/application.md), line 181.

```reaction
when Locating.establishBase (status: "grounded")
then
  Locating.inspectLocation (name: "settings", path: "site.yaml")
```

### fullSite.staging.LoadedConfigurationIsAssessed

Authored path: `fullSite.staging.LoadedConfigurationIsAssessed`.
- Covered by [Syncpress application composition](../design/application.md), line 182.

```reaction
when Filing.replaceTreeFromFile (name: "project", path: "site.yaml", file, root, status: "loaded")
where
  Filing._named (name: "project") has (root)
  Filing._text (file) has (text)
then
  Governing.assess (source: text)
```

### fullSite.staging.LocateGroundsSiteDirectory

Authored path: `fullSite.staging.LocateGroundsSiteDirectory`.
- Covered by [Syncpress application composition](../design/application.md), line 183.

```reaction
when Diagnosing.retractGroup (scope: "project-staging", source: "site.yaml")
where
  earlier, Phasing.start (name: "site-build", phase: "locate")
  Locating._requested (name: "site") has (path)
then
  Locating.establishBase (path)
```

### fullSite.staging.OutputOverlappingConfigurationDiagnoses

Authored path: `fullSite.staging.OutputOverlappingConfigurationDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 184.

```reaction
when Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
where
  view "the publication place" has (place: publication)
  Locating._named (name: "settings") has (place: settings)
  Locating._overlapping (other: settings, place: publication) has (overlapping: true)
then
  Diagnosing.report (code: "OUTPUT_OVERLAPS_CONFIGURATION", message: "The output directory must not contain the site configuration.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.OutputOverlappingSourceRootDiagnoses

Authored path: `fullSite.staging.OutputOverlappingSourceRootDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 185.

```reaction
when Phasing.completePhase (name: "site-build", phase: "settings", transitioned: true)
where
  view "the publication place" has (place: publication)
  Governing._sources () has (name: root)
  Locating._named (name: root) has (place: source)
  Locating._overlapping (other: source, place: publication) has (overlapping: true)
then
  Diagnosing.report (code: "OUTPUT_OVERLAPS_SOURCE", message: "The output directory must not overlap a configured source directory.", scope: "project-staging", severity: "error", source: root)
```

### fullSite.staging.StageAdmitsConfiguredOutput

Authored path: `fullSite.staging.StageAdmitsConfiguredOutput`.
- Covered by [Syncpress application composition](../design/application.md), line 186.

```reaction
when Phasing.completePhase (name: "site-build", phase: "stage", transitioned: true)
where
  Governing._paths () has (output: directory)
  no Locating._requested (name: "destination")
then
  Locating.inspectLocation (name: "output", path: directory)
```

### fullSite.staging.StageAdmitsRequestedDestination

Authored path: `fullSite.staging.StageAdmitsRequestedDestination`.
- Covered by [Syncpress application composition](../design/application.md), line 187.

```reaction
when Phasing.completePhase (name: "site-build", phase: "stage", transitioned: true)
where
  Locating._requested (name: "destination") has (path: directory)
then
  Locating.inspectLocation (name: "destination", path: directory)
```

### fullSite.staging.StageAdmitsSourceRoots

Authored path: `fullSite.staging.StageAdmitsSourceRoots`.
- Covered by [Syncpress application composition](../design/application.md), line 188.

```reaction
when Phasing.completePhase (name: "site-build", phase: "stage", transitioned: true)
where
  Governing._sources () has (name: root, path: directory)
then
  Locating.inspectLocation (name: root, path: directory)
```

### fullSite.staging.StartedSiteBuildsBeginAggregateDelivery

Authored path: `fullSite.staging.StartedSiteBuildsBeginAggregateDelivery`.
- Covered by [Syncpress application composition](../design/application.md), line 189.

```reaction
when Phasing.start (job, name: "site-build", phase: "locate")
then
  DeliveryArbitration.beginDelivery (task: job)
```

### fullSite.staging.UndecodableConfigurationDiagnoses

Authored path: `fullSite.staging.UndecodableConfigurationDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 190.

```reaction
when Filing.replaceTreeFromFile (name: "project", path: "site.yaml", file, root, status: "loaded")
where
  Filing._named (name: "project") has (root)
  no Filing._text (file)
then
  Diagnosing.report (code: "INVALID_TEXT", message: "The site configuration must be UTF-8 text.", scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UndirectablePublicationDiagnoses

Authored path: `fullSite.staging.UndirectablePublicationDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 191.

```reaction
when refused Emitting.configureDestination (destination, detail, error)
then
  Diagnosing.report (code: error, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UngroundableSiteDirectoryDiagnoses

Authored path: `fullSite.staging.UngroundableSiteDirectoryDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 192.

```reaction
when Locating.establishBase (path, code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UnloadableSourceRootDiagnoses

Authored path: `fullSite.staging.UnloadableSourceRootDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 193.

```reaction
when Filing.replaceTreeFromDirectory (name: root, code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: root)
```

### fullSite.staging.UnreadableConfigurationDiagnoses

Authored path: `fullSite.staging.UnreadableConfigurationDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 194.

```reaction
when Filing.replaceTreeFromFile (name: "project", path: "site.yaml", code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.staging.UnresolvableLocationDiagnoses

Authored path: `fullSite.staging.UnresolvableLocationDiagnoses`.
- Covered by [Syncpress application composition](../design/application.md), line 195.

```reaction
when Locating.inspectLocation (name, path, code, detail, status: "problem")
then
  Diagnosing.report (code, message: detail, scope: "project-staging", severity: "error", source: "site.yaml")
```

### fullSite.watching.AttendSiteWatch

Authored path: `fullSite.watching.AttendSiteWatch`.
- Covered by [Syncpress application composition](../design/application.md), line 196.
- Covered by [Syncpress application composition](../design/application.md), line 249.

```reaction
when RequestBoundary.request (path: "/watch/attend", requestId, watch, within)
then
  Watching.waitForChange (watch, within)
```

### fullSite.watching.AttendSiteWatch#2

Authored path: `fullSite.watching.AttendSiteWatch`.
- Covered by [Syncpress application composition](../design/application.md), line 196.
- Covered by [Syncpress application composition](../design/application.md), line 249.

```reaction
when Watching.waitForChange (watch, within, changed, watching), asked by fullSite.watching.AttendSiteWatch
where
  earlier, RequestBoundary.request (path: "/watch/attend", requestId, watch, within)
then
  RequestBoundary.respond (changed, requestId, watching)
```

### fullSite.watching.CloseSiteWatch

Authored path: `fullSite.watching.CloseSiteWatch`.
- Covered by [Syncpress application composition](../design/application.md), line 197.
- Covered by [Syncpress application composition](../design/application.md), line 250.

```reaction
when RequestBoundary.request (path: "/watch/close", requestId, watch)
then
  Watching.close (watch)
```

### fullSite.watching.CloseSiteWatch#2

Authored path: `fullSite.watching.CloseSiteWatch`.
- Covered by [Syncpress application composition](../design/application.md), line 197.
- Covered by [Syncpress application composition](../design/application.md), line 250.

```reaction
when Watching.close (watch), asked by fullSite.watching.CloseSiteWatch
where
  earlier, RequestBoundary.request (path: "/watch/close", requestId, watch)
then
  RequestBoundary.respond (requestId)
```

### fullSite.watching.OpenSiteWatch

Authored path: `fullSite.watching.OpenSiteWatch`.
- Covered by [Syncpress application composition](../design/application.md), line 198.
- Covered by [Syncpress application composition](../design/application.md), line 251.

```reaction
when RequestBoundary.request (directory, output, path: "/watch/open", requestId, settling)
where
  isTextValue (value: output)
  view "the publication transaction prefix of destination (destination)" with (destination: output) has (prefix)
then
  Watching.open (directory, excluded: output, prefix, settling)
```

### fullSite.watching.OpenSiteWatch#2

Authored path: `fullSite.watching.OpenSiteWatch`.
- Covered by [Syncpress application composition](../design/application.md), line 198.
- Covered by [Syncpress application composition](../design/application.md), line 251.

```reaction
when Watching.open (directory, excluded: output, prefix, settling, watch), asked by fullSite.watching.OpenSiteWatch
where
  earlier, RequestBoundary.request (directory, output, path: "/watch/open", requestId, settling)
then
  RequestBoundary.respond (requestId, watch)
```

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/cli/exit` — requires `code`
- `/cli/interpret` — requires `arguments`
- `/cli/write` — requires `stream`, `text`
- `/serve/close` — requires `server`
- `/serve/open` — requires `host`, `port`
- `/serve/publish` — requires `directory`, `server`
- `/site/build` — requires `directory`; fills `destination` with null when absent
- `/site/inspect` — requires `directory`, `target`
- `/watch/attend` — requires `watch`, `within`
- `/watch/close` — requires `watch`
- `/watch/open` — requires `directory`, `output`, `settling`
