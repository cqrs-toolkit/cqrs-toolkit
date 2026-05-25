[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / GetViewParams

# Interface: GetViewParams\<TParams\>

Parameters for [IQueryManager.getView](IQueryManager.md#getview).

## Type Parameters

### TParams

`TParams` = `unknown`

## Properties

### page?

> `optional` **page**: [`PageRange`](../type-aliases/PageRange.md)

Optional pagination request. The view's SQL inlines LIMIT/OFFSET.

---

### params

> **params**: `TParams`

Params bag passed to the view's `memory` / `sql.query` / `cacheKeys`.

---

### view

> **view**: `string`

View name as registered in `CqrsConfig.views`.
