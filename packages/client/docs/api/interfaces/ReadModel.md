[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / ReadModel

# Interface: ReadModel\<T\>

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:22

Read model with metadata.

## Type Parameters

### T

`T` = `unknown`

## Properties

### collection

> **collection**: `string`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:26

Collection name

***

### data

> **data**: `T`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:28

Effective data (server + local changes)

***

### hasLocalChanges

> **hasLocalChanges**: `boolean`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:30

Whether there are uncommitted local changes

***

### id

> **id**: `string`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:24

Entity ID

***

### serverData?

> `optional` **serverData**: `T`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:32

Server baseline data (undefined if only local)

***

### updatedAt

> **updatedAt**: `number`

Defined in: packages/client/src/core/read-model-store/ReadModelStore.ts:34

Last update timestamp
