---
title: Collections and excerpts
description: Select routed pages, filter publication cards, establish deterministic order, and render collection data.
topics: [collections, excerpts, site-building]
---

A collection is a named, ordered set of routed pages. Collection names have no built-in semantics. A document with no route, including a document with `build.publish: false`, cannot become a collection member.

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

The card is a publication projection, not a page object. It does not contain full rendered body content. This prevents a collection layout from depending recursively on pages whose layouts depend on that collection.

## Ordering

Ordering is total and deterministic. Present sort values compare by established type and value rules. Missing sort values follow present values even for descending order. Equal values break by source path and then internal item identity.

Do not use source enumeration order as an implied publication order. Declare `sort` whenever order carries meaning.

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
