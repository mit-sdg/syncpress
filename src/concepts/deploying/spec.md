# Deploying

## Purpose

Own the ordered lifecycle of one static deployment,
so later work cannot begin before every earlier item reaches a terminal outcome.

## Principle

Ada starts one policy containing a marker, a redirect, pagination, a sitemap,
and a feed. Only the marker is pending. She activates and completes it, then
activates and prepares the redirect. Activating that redirect twice is refused.
The pagination plan expands atomically into numbered pending pages, including a
first page for an empty collection. Each page becomes current in number order.
After every page completes, the sitemap and feed are prepared from the facts Ada
supplies and the deployment finishes. Starting another deployment in the same
concept instance, completing pending work, and completing stale work are refused. The final
outcome distinguishes a wholly completed queue from one containing failed work.

## State

```state
an optional sole Deployment with
  an ordered sequence of Work
  one current position

each Work has
  a kind
  a status of pending, active, prepared, failed, or completed
  the configuration snapshot that gives the work its historical meaning
```

The deployment policy and cards supplied to this concept are snapshots. Their
copies are authoritative for that deployment attempt and are never refreshed
from another concept. One concept instance owns exactly one deployment attempt;
a complete site-build retry uses a fresh application so routes, dependencies,
and output producers cannot leak from prior work.
Preparation actions return independent values without retaining duplicate
rendering contexts or complete generated artifacts in queue state.
Rejection and failure are terminal for one work item and do not retry it; the
queue continues so callers can discover later failures. A failed deployment is
never a completed outcome. Retrying requires a fresh concept application after
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
    return the first pending work, or completed true when policy produces none

dispatch (deployment: Deployment, work: Work) : return (deployment: Deployment, work: Work)
  where work is not the deployment's current item
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where current work is not pending
  then
    refuse WORK_NOT_PENDING "Current deployment work has already been activated."
  where current work is pending
  then
    make it active and return it

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
    make it completed, advance, and return the next pending work or completed true

reject (work: Work) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is active or prepared
  then
    make it failed, advance, and return the next result

rejectOwner (owner: Owner) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where the latest deployment has no current work for owner
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the owner's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the owner's work is active or prepared
  then
    reject it and return the next result

rejectProducer (producer: Producer) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where the latest deployment has no current work for producer
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the producer's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the producer's work is active or prepared
  then
    reject it and return the next result

divide (deployment: Deployment, work: Work, template: Template, entries: Entries) : return (deployment: Deployment, work: Work, pages: Number)
  where entries are not a dense list of structured-cloneable identified cards
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
    replace it atomically with at least one ordered pending page and return the first

redirect (work: Work, target: Url, canonical: Url) : return (content: Text)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active redirect
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where target and canonical are not a valid local or external projection of the configured target
  then
    refuse INVALID_REDIRECT "Redirect preparation requires a valid projection of its configured target."
  where work is the active redirect
  then
    make it prepared and return its escaped redirect document

context (work: Work, site: Value, collections: Value, canonicalUrl: OptionalUrl) : return (owner: Owner, template: Template, context: Value)
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active pagination page
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the supplied context values cannot be copied
  then
    refuse INVALID_CONTEXT "Deployment context values must be structured-cloneable."
  where work is the active pagination page
  then
    make it prepared and return its complete rendering context

feed (work: Work, site: Value, entries: Entries) : return (path: Path, content: Text, invalid: Number, valid: Flag, origin: Flag)
  where entries are not a dense list of structured-cloneable identified cards
  then
    refuse INVALID_ENTRIES "Deployment entries must be a dense list of structured-cloneable identified cards."
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active feed
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is the active feed
  then
    make it prepared and return its deterministic Atom document

sitemap (work: Work, urls: Urls) : return (path: Path, content: Text)
  where urls are not a dense list of absolute HTTP URL records
  then
    refuse INVALID_URLS "Sitemap URLs must be a dense list of absolute HTTP URL records."
  where work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where work is not the current active sitemap
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where work is the active sitemap
  then
    make it prepared and return its deterministic XML document

fail (producer: Producer, path: Path, code: Code, detail: Text) : return (deployment: Deployment, work: OptionalWork, completed: Flag, path: Path, code: Code, message: Text)
  where the latest deployment has no current work for producer
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
  where the producer's work is not active or prepared
  then
    refuse WORK_NOT_ACTIVE "Deployment work must be active before this transition."
  where the producer's work is active or prepared
  then
    mark it failed, advance, and return the next result and path-prefixed message
```

## Queries

```queries
_work (work: Work) : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Values, content?: Text, sourcePath?: Path, description?: Text)
_forOwner (owner: Owner) : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Values, content?: Text, sourcePath?: Path, description?: Text)
_forProducer (producer: Producer) : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Values, content?: Text, sourcePath?: Path, description?: Text)
_current () : optional (work: Work, deployment: Deployment, kind: Kind, status: Status, owner?: Owner, producer?: Producer, path?: Path, from?: Address, to?: Url, name?: Name, collection?: Collection, perPage?: Number, route?: Address, templateName?: Name, title?: Text, template?: Template, number?: Number, pages?: Number, address?: Address, previous?: Address, next?: Address, cards?: Values, content?: Text, sourcePath?: Path, description?: Text)
_outcome () : one (state: State)
```

Work order is marker, redirects by validated policy order, pagination by
validated policy order and page number, sitemap, then feed. Owner and producer
lookup concerns the sole deployment. `_outcome` is `absent` before a
deployment starts, `active` while current work remains, `failed` when an
exhausted queue contains failed work, and `completed` otherwise. The `completed`
action-result flag means only that the queue is exhausted. Queries return copies.
