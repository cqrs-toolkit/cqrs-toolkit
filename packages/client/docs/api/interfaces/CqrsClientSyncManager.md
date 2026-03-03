[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / CqrsClientSyncManager

# Interface: CqrsClientSyncManager

Defined in: packages/client/src/createCqrsClient.ts:45

Restricted view of SyncManager exposed to consumers.
Start/stop are managed internally by the client lifecycle.

## Properties

### connectivity

> `readonly` **connectivity**: [`ConnectivityManager`](../classes/ConnectivityManager.md)

Defined in: packages/client/src/createCqrsClient.ts:53

Connectivity manager for network status observation.

## Methods

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](CollectionSyncStatus.md)[]

Defined in: packages/client/src/createCqrsClient.ts:49

Get sync status for all collections.

#### Returns

[`CollectionSyncStatus`](CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](CollectionSyncStatus.md) \| `null`

Defined in: packages/client/src/createCqrsClient.ts:47

Get sync status for a specific collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](CollectionSyncStatus.md) \| `null`

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/createCqrsClient.ts:51

Force-sync a specific collection from the server.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
