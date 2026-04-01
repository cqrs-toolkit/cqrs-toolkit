[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestStorage

# Function: createTestStorage()

> **createTestStorage**\<`TLink`, `TCommand`\>(`options?`): `Promise`\<[`IStorage`](../../../../interfaces/IStorage.md)\<`TLink`, `TCommand`\>\>

Create a test storage instance with optional pre-populated data.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../../../../interfaces/EnqueueCommand.md)\<`unknown`\>

## Parameters

### options?

[`CreateTestStorageOptions`](../interfaces/CreateTestStorageOptions.md)\<`TLink`, `TCommand`\> = `{}`

Data to pre-populate

## Returns

`Promise`\<[`IStorage`](../../../../interfaces/IStorage.md)\<`TLink`, `TCommand`\>\>

Initialized storage instance
