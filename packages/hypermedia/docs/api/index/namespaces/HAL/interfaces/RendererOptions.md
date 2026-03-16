[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / RendererOptions

# Interface: RendererOptions

Optional renderer options for HAL emitters.

## Properties

### \_\_collectionContext?

> `optional` **\_\_collectionContext**: `object`

Internal context set by HAL.fromCollection when a collection chooses to make
members link back to the current surface (useSurfaceAsMemberCollection).

Only applies to direct collection members. Embedded resources MUST NOT inherit it.

#### memberCollectionHref

> **memberCollectionHref**: `string`

Base href for the current collection surface (no query/pagination).

---

### linkDensity?

> `optional` **linkDensity**: `"omit"` \| `"lean"` \| `"full"`

When 'lean', only emit self/collection/curies for each item.
