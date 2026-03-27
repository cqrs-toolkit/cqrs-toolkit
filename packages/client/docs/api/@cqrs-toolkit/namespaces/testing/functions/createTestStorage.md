[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [testing](../README.md) / createTestStorage

# Function: createTestStorage()

> **createTestStorage**\<`TLink`\>(`options?`): `Promise`\<[`IStorage`](../../../../interfaces/IStorage.md)\<`TLink`\>\>

Create a test storage instance with optional pre-populated data.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

## Parameters

### options?

[`CreateTestStorageOptions`](../interfaces/CreateTestStorageOptions.md)\<`TLink`\> = `{}`

Data to pre-populate

## Returns

`Promise`\<[`IStorage`](../../../../interfaces/IStorage.md)\<`TLink`\>\>

Initialized storage instance
