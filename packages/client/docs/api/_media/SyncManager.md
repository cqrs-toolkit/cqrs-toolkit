[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManager

# Class: SyncManager

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:57](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L57)

Sync manager.

## Constructors

### Constructor

> **new SyncManager**(`config`): `SyncManager`

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L99)

#### Parameters

##### config

[`SyncManagerConfig`](../interfaces/SyncManagerConfig.md)

#### Returns

`SyncManager`

## Methods

### clearKnownRevisions()

> **clearKnownRevisions**(`streamIds`): `void`

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:968](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L968)

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

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:231](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L231)

Permanently destroy the sync manager. Not reversible.
Calls stop(), then destroys the connectivity manager.

#### Returns

`Promise`\<`void`\>

---

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:253](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L253)

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:246](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L246)

Get sync status for a collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

---

### getConnectivity()

> **getConnectivity**(): [`ConnectivityManager`](ConnectivityManager.md)

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:239](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L239)

Get connectivity manager.

#### Returns

[`ConnectivityManager`](ConnectivityManager.md)

---

### processResponseEvents()

> **processResponseEvents**(`events`): `Promise`\<`void`\>

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:980](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L980)

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

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:277](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L277)

Signal that the user has been authenticated.
Delegates to SessionManager and returns whether the session was resumed.

When the userId differs from the cached session, the data wipe is awaited
inline before SessionManager creates the new session. This prevents the
fire-and-forget event subscription from racing with the new session's sync.

#### Parameters

##### params

###### userId

`string`

#### Returns

`Promise`\<\{ `resumed`: `boolean`; \}\>

---

### setUnauthenticated()

> **setUnauthenticated**(): `Promise`\<`void`\>

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:297](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L297)

Signal that the user has logged out.
Delegates to SessionManager after awaiting the data wipe.

#### Returns

`Promise`\<`void`\>

---

### start()

> **start**(): `Promise`\<`void`\>

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:135](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L135)

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

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:195](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L195)

Stop the sync manager. Reversible — can call start() again after.
Terminates subscriptions, aborts in-flight fetches, disconnects WebSocket.
Connectivity monitoring is paused but not destroyed.

#### Returns

`Promise`\<`void`\>

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Defined in: [packages/client/src/core/sync-manager/SyncManager.ts:260](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/core/sync-manager/SyncManager.ts#L260)

Force sync a specific collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
