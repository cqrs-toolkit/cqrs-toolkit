[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorResult

# Interface: ProcessorResult\<T\>

Result of processing an event.

## Type Parameters

### T

`T` _extends_ `object` = `Record`\<`string`, `unknown`\>

## Properties

### collection

> **collection**: `string`

Collection to update

---

### id

> **id**: [`EntityId`](../type-aliases/EntityId.md)

Entity ID to update

---

### isServerUpdate

> **isServerUpdate**: `boolean`

Whether this is a server baseline update (vs optimistic)

---

### update

> **update**: [`UpdateOperation`](../type-aliases/UpdateOperation.md)\<`T`\>

Update operation
