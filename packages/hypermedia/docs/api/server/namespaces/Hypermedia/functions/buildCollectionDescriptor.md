[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [server](../../../README.md) / [Hypermedia](../README.md) / buildCollectionDescriptor

# Function: buildCollectionDescriptor()

> **buildCollectionDescriptor**\<`T`, `Counts`\>(`params`): [`CollectionDescriptor`](../../../../index/namespaces/HypermediaTypes/interfaces/CollectionDescriptor.md)\<`T`, `Counts`\>

Builds a [HypermediaTypes.CollectionDescriptor](../../../../index/namespaces/HypermediaTypes/interfaces/CollectionDescriptor.md) from a
[CursorPagination.Connection](../../../../index/namespaces/CursorPagination/interfaces/Connection.md) and a [HypermediaTypes.PageView](../../../../index/namespaces/HypermediaTypes/interfaces/PageView.md).

This is the single canonical place where connection-level metadata is mapped
into the collection descriptor (e.g. `total`, `counts`, and future connection features).
Centralizing this prevents call sites from forgetting to propagate metadata.

## Type Parameters

### T

`T` _extends_ `object` = `any`

Entity payload type contained in `connection.entities`.

### Counts

`Counts` _extends_ `object` = `Record`\<`string`, `any`\>

Optional per-entity counts metadata copied to the descriptor when present.

## Parameters

### params

#### buildMember

(`data`, `idx`) => [`ResourceDescriptor`](../../../../index/namespaces/HypermediaTypes/interfaces/ResourceDescriptor.md)

Maps each entity into a [HypermediaTypes.ResourceDescriptor](../../../../index/namespaces/HypermediaTypes/interfaces/ResourceDescriptor.md).

#### connection

[`Connection`](../../../../index/namespaces/CursorPagination/interfaces/Connection.md)\<`T`, `Counts`\>

Cursor pagination connection containing entities and optional metadata.

#### context?

`Record`\<`string`, `any`\>

Optional context to resolve templated parameters in collection links.

#### page

[`PageView`](../../../../index/namespaces/HypermediaTypes/interfaces/PageView.md)

Hypermedia page/view links (self/first/prev/next/last).

## Returns

[`CollectionDescriptor`](../../../../index/namespaces/HypermediaTypes/interfaces/CollectionDescriptor.md)\<`T`, `Counts`\>

A [HypermediaTypes.CollectionDescriptor](../../../../index/namespaces/HypermediaTypes/interfaces/CollectionDescriptor.md) containing page metadata, members,
and any supported connection metadata (e.g. `counts`).
