[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ProcessorResult

# Interface: ProcessorResult\<T\>

Defined in: [packages/client/src/core/event-processor/types.ts:19](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L19)

Result of processing an event.

## Type Parameters

### T

`T` _extends_ `object` = `Record`\<`string`, `unknown`\>

## Properties

### collection

> **collection**: `string`

Defined in: [packages/client/src/core/event-processor/types.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L21)

Collection to update

---

### id

> **id**: `string`

Defined in: [packages/client/src/core/event-processor/types.ts:23](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L23)

Entity ID to update

---

### isServerUpdate

> **isServerUpdate**: `boolean`

Defined in: [packages/client/src/core/event-processor/types.ts:27](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L27)

Whether this is a server baseline update (vs optimistic)

---

### update

> **update**: [`UpdateOperation`](../type-aliases/UpdateOperation.md)\<`T`\>

Defined in: [packages/client/src/core/event-processor/types.ts:25](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/core/event-processor/types.ts#L25)

Update operation
