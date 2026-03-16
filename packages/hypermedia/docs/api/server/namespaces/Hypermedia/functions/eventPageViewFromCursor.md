[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [server](../../../README.md) / [Hypermedia](../README.md) / eventPageViewFromCursor

# Function: eventPageViewFromCursor()

> **eventPageViewFromCursor**\<`T`\>(`connection`, `opts`): [`PageView`](../../../../index/namespaces/HypermediaTypes/interfaces/PageView.md)

## Type Parameters

### T

`T` = `any`

## Parameters

### connection

[`Connection`](../../../../index/namespaces/EventCursorPagination/interfaces/Connection.md)\<`T`\>

### opts

#### path

`string`

#### query

[`Querystring`](../../../../index/type-aliases/Querystring.md)

#### revision?

`boolean`

If true, use afterRevision; otherwise use afterPosition

## Returns

[`PageView`](../../../../index/namespaces/HypermediaTypes/interfaces/PageView.md)
