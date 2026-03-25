[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManager

# Class: SyncManager\<TLink, TSchema, TEvent\>

Sync manager.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)

## Constructors

### Constructor

> **new SyncManager**\<`TLink`, `TSchema`, `TEvent`\>(`config`): `SyncManager`\<`TLink`, `TSchema`, `TEvent`\>

#### Parameters

##### config

[`SyncManagerConfig`](../interfaces/SyncManagerConfig.md)\<`TLink`, `TSchema`, `TEvent`\>

#### Returns

`SyncManager`\<`TLink`, `TSchema`, `TEvent`\>

## Methods

### clearKnownRevisions()

> **clearKnownRevisions**(`streamIds`): `void`

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

Permanently destroy the sync manager. Not reversible.
Calls stop(), then destroys the connectivity manager.

#### Returns

`Promise`\<`void`\>

---

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

Get sync status for a collection.

#### Parameters

##### collection

`string`

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

---

### getConnectivity()

> **getConnectivity**(): [`ConnectivityManager`](ConnectivityManager.md)

Get connectivity manager.

#### Returns

[`ConnectivityManager`](ConnectivityManager.md)

---

### processResponseEvents()

> **processResponseEvents**(`events`): `Promise`\<`void`\>

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

Signal that the user has logged out.
Delegates to SessionManager after awaiting the data wipe.

#### Returns

`Promise`\<`void`\>

---

### start()

> **start**(): `Promise`\<`void`\>

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

Stop the sync manager. Reversible — can call start() again after.
Terminates subscriptions, aborts in-flight fetches, disconnects WebSocket.
Connectivity monitoring is paused but not destroyed.

#### Returns

`Promise`\<`void`\>

---

### syncCollection()

> **syncCollection**(`collection`): `Promise`\<`void`\>

Force sync a specific collection.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
