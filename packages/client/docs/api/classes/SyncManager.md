[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / SyncManager

# Class: SyncManager

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:50

Sync manager.

## Constructors

### Constructor

> **new SyncManager**(`config`): `SyncManager`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:67

#### Parameters

##### config

[`SyncManagerConfig`](../interfaces/SyncManagerConfig.md)

#### Returns

`SyncManager`

## Methods

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:165

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `null`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:158

Get sync status for a collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `null`

---

### getConnectivity()

> **getConnectivity**(): [`ConnectivityManager`](ConnectivityManager.md)

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:151

Get connectivity manager.

#### Returns

[`ConnectivityManager`](ConnectivityManager.md)

---

### start()

> **start**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:99

Start the sync manager.
Begins connectivity monitoring and initial sync.

#### Returns

`Promise`\<`void`\>

---

### stop()

> **stop**(): `void`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:135

Stop the sync manager.

#### Returns

`void`

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:172

Force sync a specific collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
