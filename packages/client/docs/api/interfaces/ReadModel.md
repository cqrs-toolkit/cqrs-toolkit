[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / ReadModel

# Interface: ReadModel\<T\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:24

Read model with metadata.

## Type Parameters

### T

`T` = `unknown`

## Properties

### collection

> **collection**: `string`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:28

Collection name

---

### data

> **data**: `T`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:30

Effective data (server + local changes)

---

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:32

Whether there are uncommitted local changes

---

### id

> **id**: `string`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:26

Entity ID

---

### serverData

> **serverData**: `T` \| `null`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:34

Server baseline data (null if only local)

---

### updatedAt

> **updatedAt**: `number`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:36

Last update timestamp
