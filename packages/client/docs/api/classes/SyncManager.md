[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManager

# Class: SyncManager

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:55

Sync manager.

## Constructors

### Constructor

> **new SyncManager**(`config`): `SyncManager`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:93

#### Parameters

##### config

[`SyncManagerConfig`](../interfaces/SyncManagerConfig.md)

#### Returns

`SyncManager`

## Methods

### destroy()

> **destroy**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:219

Permanently destroy the sync manager. Not reversible.
Calls stop(), then destroys the connectivity manager.

#### Returns

`Promise`\<`void`\>

---

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:241

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:234

Get sync status for a collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

---

### getConnectivity()

> **getConnectivity**(): [`ConnectivityManager`](ConnectivityManager.md)

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:227

Get connectivity manager.

#### Returns

[`ConnectivityManager`](ConnectivityManager.md)

---

### setAuthenticated()

> **setAuthenticated**(`params`): `Promise`\<\{ `resumed`: `boolean`; \}\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:261

Signal that the user has been authenticated.
Delegates to SessionManager and returns whether the session was resumed.

#### Parameters

##### params

###### userId

`string`

#### Returns

`Promise`\<\{ `resumed`: `boolean`; \}\>

---

### setUnauthenticated()

> **setUnauthenticated**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:269

Signal that the user has logged out.
Delegates to SessionManager.

#### Returns

`Promise`\<`void`\>

---

### start()

> **start**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:128

Start the sync manager.
Begins connectivity monitoring and initial sync.

Offline-first startup contract: SessionManager.initialize() sets networkPaused=true,
so start() will not trigger sync until the consumer calls setAuthenticated().
This allows the app to render immediately from cached data while auth resolves.

#### Returns

`Promise`\<`void`\>

---

### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:183

Stop the sync manager. Reversible — can call start() again after.
Terminates subscriptions, aborts in-flight fetches, disconnects WebSocket.
Connectivity monitoring is paused but not destroyed.

#### Returns

`Promise`\<`void`\>

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:248

Force sync a specific collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
