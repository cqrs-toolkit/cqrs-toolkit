[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [server](../../../README.md) / [Hypermedia](../README.md) / pageViewFromCursor

# Function: pageViewFromCursor()

> **pageViewFromCursor**\<`T`, `Counts`\>(`connection`, `opts`): [`PageView`](../../../../index/namespaces/HypermediaTypes/interfaces/PageView.md)

## Type Parameters

### T

`T` _extends_ `object` = `any`

### Counts

`Counts` _extends_ `object` = `Record`\<`string`, `any`\>

## Parameters

### connection

[`Connection`](../../../../index/namespaces/CursorPagination/interfaces/Connection.md)\<`T`, `Counts`\>

### opts

#### path

`string`

#### query

[`Querystring`](../../../../index/type-aliases/Querystring.md)

## Returns

[`PageView`](../../../../index/namespaces/HypermediaTypes/interfaces/PageView.md)
