# Deploying

## Purpose

Sequence configured static-deployment work and construct deterministic redirect,
pagination, feed, and sitemap documents from supplied current facts.

## Principle

Ada starts a deployment policy. Work is offered in policy order, one item at a
time. Completing the current item reveals the next item; stale or out-of-order
completion is refused. Dividing a pagination item replaces it atomically with
at least one ordered page. Document construction is deterministic and does not
read or change another behavior's state.

## State

```state
a set of Deployments with ordered Work and one current position
a set of Work belonging to one Deployment
```

## Actions

```actions
start (policy: Policy) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
dispatch (deployment: Deployment, work: Work) : return (deployment: Deployment, work: Work)
  where work is not the deployment's current item
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
complete (work: Work) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where work is not the deployment's current item
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
completeOwner (owner: Owner) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where the owner's work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
completeProducer (producer: Producer) : return (deployment: Deployment, work: OptionalWork, completed: Flag)
  where the producer's work is not current
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
divide (deployment: Deployment, work: Work, template: Template, entries: Entries) : return (deployment: Deployment, work: Work, pages: Number)
  where work is not the current pagination plan
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
redirect (work: Work, target: Url, canonical: Url) : return (content: Text)
  where work is not redirect work
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
context (work: Work, site: Value, collections: Value, canonicalUrl: OptionalUrl) : return (owner: Owner, template: Template, context: Value)
  where work is not pagination-page work
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
feed (work: Work, site: Value, entries: Entries) : return (path: Path, content: Text, invalid: Number, valid: Flag, origin: Flag)
  where work is not feed work
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
sitemap (work: Work, urls: Urls) : return (path: Path, content: Text)
  where work is not sitemap work
  then
    refuse WORK_NOT_CURRENT "Deployment work must be the current item."
outputFailure (path: Path, detail: Text) : return (path: Path, message: Text)
  then
    return the path-prefixed deployment output failure message
```

`dispatch`, `complete`, and `divide` refuse `WORK_NOT_CURRENT` when work is not
the deployment's current item. Document actions refuse the same code when work
has the wrong kind.

## Queries

```queries
_work (work: Work) : optional (deployment: Deployment, kind: Kind, values: Values)
_forOwner (owner: Owner) : optional (work: Work, deployment: Deployment, kind: Kind, values: Values)
_forProducer (producer: Producer) : optional (work: Work, deployment: Deployment, kind: Kind, values: Values)
_current () : many (work: Work, deployment: Deployment, kind: Kind, values: Values)
```

Work order is `.nojekyll`, redirects by validated policy order, pagination by
validated policy order and page number, sitemap, then feed. Queries return
copies.
