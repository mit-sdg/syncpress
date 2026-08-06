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

## State

```state
an optional sole Deployment with
  an ordered sequence of Work
  one current position

each Work has
  a kind
  a status of pending, active, prepared, failed, or completed
  the configuration or card snapshot that gives the work its historical meaning
```

The deployment policy, pagination cards, and accepted preparation contexts are
snapshots. Their copies are authoritative for that deployment attempt and are
never refreshed from another concept. One concept instance owns exactly one
deployment attempt; a complete site-build retry uses a fresh application.

Redirect HTML, pagination body and context projection, Atom, sitemap, escaping,
URL projection, and date projection are pure application computations outside
this concept. Preparation actions validate the current work and record only its
state transition; generated artifacts are returned independently and are not
retained in queue state.

Every current work item is active before it is returned. Future items remain
pending. A successful preparation can happen once: repeating it is refused
because the work is no longer active. A refused preparation leaves work active
and may be corrected and repeated. An invalid or originless feed preparation
also leaves work active and may be repeated or rejected, but never completed.
Rejection and failure are terminal for exactly one item, never retry it, and
activate the next item so callers can discover later failures. Repeating a
terminal transition refers to stale work and is refused. A failed deployment is
never a completed outcome; retrying requires a fresh concept application after
the queue is exhausted.

## Actions

```actions
start (policy: Policy) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
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

complete (work: Work) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
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

reject (work: Work) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is active or prepared
  then
    make it failed, advance, and atomically activate and return the next work or completed true

rejectOwner (owner: Owner) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where the latest deployment has no current work for owner
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the owner's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the owner's work is active or prepared
  then
    reject it and atomically activate and return the next work or completed true

rejectProducer (producer: Producer) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where the latest deployment has no current work for producer
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the producer's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the producer's work is active or prepared
  then
    reject it and atomically activate and return the next work or completed true

divide (deployment: Deployment, work: Work, template: Template, entries: Entries) : return (deployment: Deployment, work: Work, pages: Number)
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

redirect (work: Work, target: Url, canonical: Url, content: Text) : return (content: Text)
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

context (work: Work, context: Value) : return (owner: Owner, template: Template, context: Value)
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

snapshotFeed (work: Work, site: Value, entries: Entries) : return (work: Work, path: Path, title: OptionalText, description: OptionalText, site: Value, entries: Entries)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active feed
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where entries are not a dense list of structured-cloneable identified cards or the snapshot cannot be copied
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

fail (producer: Producer, path: Path, code: Code, detail: Text) : return (deployment: Deployment, work: OptionalWork, completed: Flag, path: Path, code: Code, message: Text)
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
_work (work: Work) : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Value, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Value, next?: Value, cards?: Values, sourcePath?: Path, description?: Value)
_forOwner (owner: Owner) : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Value, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Value, next?: Value, cards?: Values, sourcePath?: Path, description?: Value)
_forProducer (producer: Producer) : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Value, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Value, next?: Value, cards?: Values, sourcePath?: Path, description?: Value)
_current () : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Value, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Value, next?: Value, cards?: Values, sourcePath?: Path, description?: Value)
_outcome () : one (state: State)
```

Work order is marker, redirects by validated policy order, pagination by
validated policy order and page number, sitemap, then feed. Owner and producer
lookup concerns the sole deployment. `_outcome` is `absent` before a deployment
starts, `active` while current work remains, `failed` when an exhausted queue
contains failed work, and `completed` otherwise. The `completed` action-result
flag means only that the queue is exhausted. Queries return copies.
