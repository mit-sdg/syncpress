# Deploying

## Purpose

Own the ordered queue, historical snapshots, and preparation state of one
static deployment, so every returned current item is already active and later
work cannot begin before earlier work reaches a terminal outcome.

## Principle

Ada starts one policy containing a marker, redirects, pagination, a sitemap,
and a feed. Starting atomically activates and returns the marker. Completing,
rejecting, rejecting by owner or producer, and failing each current item
atomically activate the next item they return. Dividing an active pagination
plan atomically replaces it with numbered pages and activates the first page,
including one page for an empty collection. Preparation records independently
computed redirect documents, pagination contexts, sitemap documents, and feed
results without generating them. An invalid or originless feed result remains
active, cannot complete, and can be diagnosed and rejected so the queue
continues. The final outcome distinguishes a wholly completed queue from one
containing failed work.

## Types

```types
Policy = external
  A publishing policy record in the supported deployment shape.

Owner = Text
Producer = Text
Template = Text
Name = Text
Collection = Text
Path = Text
Address = Text
Url = Text
Code = Text

Value = external
  A value accepted by the host structured-clone operation.

Values = List<Value>

Entries = external
  A dense list of structured-cloneable identified-card records.

Urls = external
  A dense list of records containing absolute HTTP URLs.

Kind = "nojekyll" | "redirect" | "pagination-plan" | "pagination-page" | "sitemap" | "feed"
Status = "pending" | "active" | "prepared" | "failed" | "completed"
State = "absent" | "active" | "failed" | "completed"

WorkRow = record
  work: Work
  deployment: Deployment
  kind: Kind
  status: Status
  owner?: Owner
  producer?: Producer
  path?: Path
  from?: Address
  to?: Url
  name?: Name
  collection?: Collection
  perPage?: Number
  route?: Address
  templateName?: Name
  title?: Value
  template?: Template
  number?: Number
  pages?: Number
  address?: Address
  previous?: Value
  next?: Value
  cards?: Values
  sourcePath?: Path
  description?: Value
```

## State

```state
a set of Deployments with
  a works seq of Work
  a position NonnegativeInteger

a set of Work with
  a Deployment
  a kind Kind
  a status Status
  a snapshot Value
```

## Actions

```actions
start (policy: Policy) : return (deployment: Deployment, work?: Work, completed: Flag)
  where policy does not have the supported deployment shape, contains an invalid or cyclic redirect, pagination route, or feed path, or repeats a redirect source or pagination name
  then
    refuse INVALID_POLICY "A deployment policy must have the supported publishing shape."
  where a deployment was already started
  then
    refuse DEPLOYMENT_ACTIVE "A deployment was already started."
  where no deployment was started
  then
    add work in declared precedence
    activate and return the first work, or completed true when policy produces none

complete (work: Work) : return (deployment: Deployment, work?: Work, completed: Flag)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is pending, failed, or completed
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is active but is not marker work
  then
    refuse WORK_NOT_PREPARED "Deployment work must be prepared before completion."
  where work is an active marker or is prepared
  then
    make it completed, advance, and atomically activate and return the next work or completed true

reject (work: Work) : return (deployment: Deployment, work?: Work, completed: Flag)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is active or prepared
  then
    make it failed, advance, and atomically activate and return the next work or completed true

rejectOwnerWork (owner: Owner) : return (deployment: Deployment, work?: Work, completed: Flag)
  where the latest deployment has no current work for owner
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the owner's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the owner's work is active or prepared
  then
    reject it and atomically activate and return the next work or completed true

rejectProducerWork (producer: Producer) : return (deployment: Deployment, work?: Work, completed: Flag)
  where the latest deployment has no current work for producer
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the producer's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the producer's work is active or prepared
  then
    reject it and atomically activate and return the next work or completed true

expandPagination (deployment: Deployment, work: Work, template: Template, entries: Entries) : return (deployment: Deployment, work: Work, pages: Number)
  where entries are not a dense list of structured-cloneable identified cards with routed URLs
  then
    refuse INVALID_ENTRIES "Deployment entries must be a dense list of structured-cloneable identified cards."
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active pagination plan
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is the active pagination plan
  then
    replace it atomically with at least one ordered pending page, activate the first page, and return it

prepareRedirect (work: Work, target: Url, canonical: Url, content: Text) : return (content: Text)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active redirect
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where target and canonical are not a valid local or external projection of the configured target
  then
    refuse INVALID_REDIRECT "Redirect preparation requires a valid projection of its configured target."
  where content is not well-formed text
  then
    refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
  where work and preparation are valid
  then
    make it prepared and return the independently computed content

preparePageContext (work: Work, context: Value) : return (owner: Owner, template: Template, context: Value)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active pagination page
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where context cannot be copied
  then
    refuse INVALID_CONTEXT "Deployment context values must be structured-cloneable."
  where work and context are valid
  then
    make it prepared and return an independent context with the work's owner and template

snapshotFeed (work: Work, site: Value, entries: Entries) : return (work: Work, path: Path, title: Text | null, description: Text | null, site: Value, entries: Entries)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active feed
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where entries are not a dense list of structured-cloneable identified cards
  then
    refuse INVALID_ENTRIES "Deployment entries must be a dense list of structured-cloneable identified cards."
  where the snapshot cannot be copied
  then
    refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
  then
    return independent copies of the feed policy, site, and entries without changing work state

prepareFeed (work: Work, preparation: Value) : return (path: Path, content: Text, invalid: Number, valid: Flag, origin: Flag)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active feed
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where preparation does not contain the configured path, well-formed content, a nonnegative invalid count, and consistent validity and origin flags
  then
    refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
  where preparation has an origin and no invalid entries
  then
    make work prepared and return the independent preparation
  where preparation is originless or has invalid entries
  then
    leave work active and return the independent preparation for diagnosis

snapshotSitemap (work: Work, urls: Urls) : return (work: Work, path: Path, urls: Urls)
  where urls are not a dense list of absolute HTTP URL records
  then
    refuse INVALID_URLS "Sitemap URLs must be a dense list of absolute HTTP URL records."
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active sitemap
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  then
    return an independent URL snapshot without changing work state

prepareSitemap (work: Work, content: Text) : return (path: Path, content: Text)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active sitemap
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where content is not well-formed text
  then
    refuse INVALID_PREPARATION "Deployment preparation must match the current work snapshot."
  where work and preparation are valid
  then
    make it prepared and return its path and independently computed content

failWork (producer: Producer, path: Path, code: Code, detail: Text) : return (deployment: Deployment, work?: Work, completed: Flag, path: Path, code: Code, message: Text)
  where the latest deployment has no current work for producer
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the producer's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the producer's work is active or prepared
  then
    mark it failed, advance, atomically activate and return the next work or completed true, and return a path-prefixed message
```

## Queries

```queries
_work (work: Work) : optional WorkRow
  Returns no row for unknown work. Every work query includes only the fields
  defined for the work's kind; all other fields are absent. All query results
  are copies.

_forOwner (owner: Owner) : optional WorkRow
  Looks only in the sole deployment and uses `_work`'s kind-specific projection.
  Returns no row when that deployment has no work for the owner.

_forProducer (producer: Producer) : optional WorkRow
  Looks only in the sole deployment and uses `_work`'s kind-specific projection.
  Returns no row when that deployment has no work for the producer.

_current () : optional WorkRow
  Uses `_work`'s kind-specific projection and returns no row before a deployment
  starts or after its queue is exhausted. Queue order is marker, redirects by
  validated policy order, pagination by validated policy order and page number,
  sitemap, then feed.

_outcome () : one (state: State)
  Reports `absent` before a deployment starts, `active` while current work
  remains, `failed` when an exhausted queue contains failed work, and `completed`
  otherwise. A true `completed` flag returned by an action means only that the
  queue is exhausted; it does not imply a `completed` outcome.
```

## Contracts

```contracts
contract deployment-snapshots on start, divide, context, snapshotFeed, snapshotSitemap
  A Deployment retains independent Policy and pagination-card snapshots.
  Context and snapshot actions return independent copies. Preparation results
  are returned rather than retained; only their declared Work transitions remain.
```
