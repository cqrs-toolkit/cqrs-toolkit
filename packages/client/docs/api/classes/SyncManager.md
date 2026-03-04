[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManager

# Class: SyncManager

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:57

Sync manager.

## Constructors

### Constructor

> **new SyncManager**(`config`): `SyncManager`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:96

#### Parameters

##### config

[`SyncManagerConfig`](../interfaces/SyncManagerConfig.md)

#### Returns

`SyncManager`

## Methods

### clearKnownRevisions()

> **clearKnownRevisions**(`streamIds`): `void`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:854

Clear known revisions for specific streams.
Used when a cache key is evicted and the associated stream state is no longer valid.

#### Parameters

##### streamIds

`string`[]

#### Returns

`void`

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:225

Permanently destroy the sync manager. Not reversible.
Calls stop(), then destroys the connectivity manager.

#### Returns

`Promise`\<`void`\>

---

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:247

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:240

Get sync status for a collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

---

### getConnectivity()

> **getConnectivity**(): [`ConnectivityManager`](ConnectivityManager.md)

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:233

Get connectivity manager.

#### Returns

[`ConnectivityManager`](ConnectivityManager.md)

---

### processResponseEvents()

> **processResponseEvents**(`events`): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:866

Process command response events.
Events are processed immediately for fast UI feedback. If a gap is detected
(response revision > expected), a collection refetch is scheduled to fill in
missing events asynchronously.

#### Parameters

##### events

[`ParsedEvent`](../interfaces/ParsedEvent.md)[]

#### Returns

`Promise`\<`void`\>

---

### setAuthenticated()

> **setAuthenticated**(`params`): `Promise`\<\{ `resumed`: `boolean`; \}\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:267

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

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:275

Signal that the user has logged out.
Delegates to SessionManager.

#### Returns

`Promise`\<`void`\>

---

### start()

> **start**(): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:132

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

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:189

Stop the sync manager. Reversible — can call start() again after.
Terminates subscriptions, aborts in-flight fetches, disconnects WebSocket.
Connectivity monitoring is paused but not destroyed.

#### Returns

`Promise`\<`void`\>

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: packages/client/src/core/sync-manager/SyncManager.ts:254

Force sync a specific collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
