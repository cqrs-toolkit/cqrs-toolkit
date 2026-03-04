[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManager

# Class: SyncManager

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:55

Sync manager.

## Constructors

### Constructor

> **new SyncManager**(`config`): `SyncManager`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:84

#### Parameters

##### config

[`SyncManagerConfig`](../interfaces/SyncManagerConfig.md)

#### Returns

`SyncManager`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:194

Permanently destroy the sync manager. Not reversible.
Calls stop(), then destroys the connectivity manager.

#### Returns

`void`

---

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:216

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:209

Get sync status for a collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

---

### getConnectivity()

> **getConnectivity**(): [`ConnectivityManager`](ConnectivityManager.md)

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:202

Get connectivity manager.

#### Returns

[`ConnectivityManager`](ConnectivityManager.md)

---

### start()

> **start**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:115

Start the sync manager.
Begins connectivity monitoring and initial sync.

#### Returns

`Promise`\<`void`\>

---

### stop()

> **stop**(): `void`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:170

Stop the sync manager. Reversible — can call start() again after.
Terminates subscriptions, aborts in-flight fetches, disconnects WebSocket.
Connectivity monitoring is paused but not destroyed.

#### Returns

`void`

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:223

Force sync a specific collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
