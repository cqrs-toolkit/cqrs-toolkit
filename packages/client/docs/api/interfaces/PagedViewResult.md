[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / PagedViewResult

# Interface: PagedViewResult\<TLink, T\>

Result of [IQueryManager.getView](IQueryManager.md#getview).

`data` carries the rows in their public shape `T`; `cacheKeys` lists the
resolved cache key identities the view declared. `total` is present when
the view registration provides a count callback ([ViewRegistration.memoryCount](ViewRegistration.md#memorycount)
on the memory path; [ViewRegistration.sql](ViewRegistration.md#sql).count on the SQL path).

The count callback runs independently of the data query — works for
`LIMIT/OFFSET`, cursor pagination, or no pagination at all. Consumers
that don't need a total simply omit the callbacks.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### T

`T`

## Properties

### cacheKeys

> **cacheKeys**: readonly [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>[]

---

### data

> **data**: `T`[]

---

### total?

> `optional` **total**: `number`

Total row count for the query, independent of the requested page.
Populated when the view registration supplies a count callback for the
active backend. Undefined when no count callback is configured.
