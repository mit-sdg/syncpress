---
title: Collections and excerpts
description: Select routed pages, filter publication cards, establish deterministic order, and render collection data.
group: guide
order: 5
topics: [collections, excerpts, site-building]
---

A collection is a named, ordered set of routed pages. Collection names are author-defined. Collection membership requires a route, so documents with `build.publish: false` remain outside collections.

## Define a collection

```yaml
collections:
  articles:
    match: "articles/**/*.md"
    where:
      field: data.status
      equals: published
    sort:
      by: data.date
      order: desc
```

`match` is required. `where` is optional and accepts one condition:

- `equals` compares the selected field with a configured value;
- `contains` tests membership in a sequence, or substring presence when both operands are strings;
- `exists: true` requires the field to exist.

`sort.by` selects a dotted card field. `sort.order` is `asc` or `desc` and defaults to ascending.

## Render cards

{% raw %}
```liquid
{% for article in collections.articles %}
  <article>
    <h2><a href="{{ article.url }}">{{ article.data.title }}</a></h2>
    {{ article.excerpt }}
  </article>
{% endfor %}
```
{% endraw %}

Each card exposes:

```text
data
url
excerpt
source.path
```

A card is a publication projection containing the fields above. Full rendered body content remains page-owned, which prevents recursive dependencies between collection layouts and page layouts.

## Ordering

Ordering is total and deterministic. Present sort values compare by established type and value rules. Missing sort values follow present values even for descending order. Equal values break by source path and then internal item identity.

Declare `sort` whenever publication order carries meaning. Source enumeration order has no authoring semantics.

## Excerpts

`markdown.excerptSeparator` defines the boundary in the authored body:

```md
The summary appears on collection cards.

<!--more-->

The remaining body appears only on the page.
```

The excerpt is taken before body Liquid evaluation and converted with the page's markup profile during the excerpt phase. If the separator is empty or absent from the body, the card's `excerpt` is null.

Rendered excerpts are the only collection-card field with a fixed trusted-HTML capability. Other card values remain escaped when interpolated.

## This documentation's collections

[`example/site.yaml`](https://github.com/mit-sdg/syncpress/blob/main/example/site.yaml) defines equality, sequence-containment, and existence filters. The introduction renders the `featured` and `posts` collections through literal-name card partials. The header uses the same `posts` order for recent design notes.
