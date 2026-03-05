[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsClientSyncManager

# Interface: CqrsClientSyncManager

Defined in: packages/client/src/createCqrsClient.ts:62

Restricted view of SyncManager exposed to consumers.
Start/stop are managed internally by the client lifecycle.

## Properties

### connectivity

> `readonly` **connectivity**: [`IConnectivity`](IConnectivity.md)

Defined in: packages/client/src/createCqrsClient.ts:74

Connectivity manager for network status observation.

## Methods

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](CollectionSyncStatus.md)[]

Defined in: packages/client/src/createCqrsClient.ts:66

Get sync status for all collections.

#### Returns

[`CollectionSyncStatus`](CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](CollectionSyncStatus.md) \| `undefined`

Defined in: packages/client/src/createCqrsClient.ts:64

Get sync status for a specific collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](CollectionSyncStatus.md) \| `undefined`

---

### setAuthenticated()

> **setAuthenticated**(`params`): `Promise`\<\{ `resumed`: `boolean`; \}\>

Defined in: packages/client/src/createCqrsClient.ts:70

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

Defined in: packages/client/src/createCqrsClient.ts:72

Signal that the user has logged out.

#### Returns

`Promise`\<`void`\>

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/createCqrsClient.ts:68

Force-sync a specific collection from the server.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
