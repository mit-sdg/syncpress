# Embedding

## Purpose

Present one resource through the best rendition a reader's viewer can accept,
without asking the author to choose.

## Principle

Ada declares an embedding with alternative text, intrinsic dimensions, and the
number of rendition addresses it expects. Its markup is absent until all expected
offers arrive. Offers arriving out of order are grouped by their format order,
with widths ascending within each group; the final group becomes the `img`
fallback and carries the alternative text, dimensions, lazy loading, and async
decoding. Re-offering an address leaves the completed markup unchanged. An
embedding expecting no offers has markup immediately.

## State

```state
a set of Embeddings with
  a subject Subject
  an alternative Text
  a width Number
  a height Number
  an expects Number

a set of Offers with
  an embedding Embedding
  an address Address
  a format Format
  a width Number
  an order Number
```

At most one embedding exists per subject and one offer per embedding and
address.

## Actions

```actions
declare (subject: Subject, alternative: Text, width: Number, height: Number, expects: Number) : return (embedding: Embedding)
  then
    replace any embedding for subject, with its offers
    add an embedding with its supplied facts
    return embedding

offer (embedding: Embedding, address: Address, format: Format, width: Number, order: Number) : return (offer: Offer, embedding: Embedding, arrived: Number)
  where embedding not in embeddings
  then
    refuse EMBEDDING_NOT_FOUND "There is no such embedding."
  where embedding in embeddings
  then
    replace any offer for embedding and address
    return offer, embedding, and how many offers it now has

withdraw (subject: Subject) : return (embedding: Embedding)
  then
    remove its embedding and offers
```

## Queries

```queries
_embedding (embedding: Embedding) : one (subject: Subject, expects: Number, arrived: Number)
_for (subject: Subject) : optional (embedding: Embedding, expects: Number, arrived: Number)
_offers (embedding: Embedding) : many (address: Address, format: Format, width: Number, order: Number)
_markup (embedding: Embedding) : optional (markup: Text)
```

Embedding does not create renditions or decide where their addresses come from.
