[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [CursorPagination](../README.md) / Connection

# Interface: Connection\<T, Counts\>

## Type Parameters

### T

`T`

### Counts

`Counts` _extends_ `object` = `Record`\<`string`, `any`\>

## Properties

### counts?

> `optional` **counts**: `Counts`

---

### entities

> **entities**: `T`[]

---

### nextCursor

> **nextCursor**: `string` \| `null`

---

### prevCursor?

> `optional` **prevCursor**: `string` \| `null`

---

### total?

> `optional` **total**: `number` \| `null`
