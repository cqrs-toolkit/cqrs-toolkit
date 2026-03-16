[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClientSyncManager

# Interface: CqrsClientSyncManager

Restricted view of SyncManager exposed to consumers.
Start/stop are managed internally by the client lifecycle.

## Properties

### connectivity

> `readonly` **connectivity**: [`IConnectivity`](IConnectivity.md)

Connectivity manager for network status observation.

## Methods

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](CollectionSyncStatus.md)[]

Get sync status for all collections.

#### Returns

[`CollectionSyncStatus`](CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](CollectionSyncStatus.md) \| `undefined`

Get sync status for a specific collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](CollectionSyncStatus.md) \| `undefined`

---

### setAuthenticated()

> **setAuthenticated**(`params`): `Promise`\<\{ `resumed`: `boolean`; \}\>

Signal that the user has been authenticated.

#### Parameters

##### params

###### userId

`string`

#### Returns

`Promise`\<\{ `resumed`: `boolean`; \}\>

---

### setUnauthenticated()

> **setUnauthenticated**(): `Promise`\<`void`\>

Signal that the user has logged out.

#### Returns

`Promise`\<`void`\>

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Force-sync a specific collection from the server.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
