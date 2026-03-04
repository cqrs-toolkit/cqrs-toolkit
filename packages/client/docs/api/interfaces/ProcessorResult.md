[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorResult

# Interface: ProcessorResult\<T\>

Defined in: packages/client/src/core/event-processor/types.ts:19

Result of processing an event.

## Type Parameters

### T

`T` _extends_ `object` = `Record`\<`string`, `unknown`\>

## Properties

### collection

> **collection**: `string`

Defined in: packages/client/src/core/event-processor/types.ts:21

Collection to update

---

### id

> **id**: `string`

Defined in: packages/client/src/core/event-processor/types.ts:23

Entity ID to update

---

### isServerUpdate

> **isServerUpdate**: `boolean`

Defined in: packages/client/src/core/event-processor/types.ts:27

Whether this is a server baseline update (vs optimistic)

---

### update

> **update**: [`UpdateOperation`](../type-aliases/UpdateOperation.md)\<`T`\>

Defined in: packages/client/src/core/event-processor/types.ts:25

Update operation
