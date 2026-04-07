[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SyncManager

# Class: SyncManager\<TLink, TCommand, TSchema, TEvent\>

Sync manager.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)

## Constructors

### Constructor

> **new SyncManager**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`eventBus`, `sessionManager`, `commandQueue`, `eventCache`, `cacheManager`, `eventProcessor`, `readModelStore`, `queryManager`, `writeQueue`, `connectivity`, `networkConfig`, `auth`, `collections`): `SyncManager`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### sessionManager

[`SessionManager`](SessionManager.md)\<`TLink`, `TCommand`\>

##### commandQueue

[`CommandQueue`](CommandQueue.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

##### eventCache

[`EventCache`](EventCache.md)\<`TLink`, `TCommand`\>

##### cacheManager

[`CacheManager`](CacheManager.md)\<`TLink`, `TCommand`\>

##### eventProcessor

[`EventProcessorRunner`](EventProcessorRunner.md)\<`TLink`, `TCommand`\>

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)\<`TLink`, `TCommand`\>

##### queryManager

[`QueryManager`](QueryManager.md)\<`TLink`, `TCommand`\>

##### writeQueue

`IWriteQueue`\<`TLink`\>

##### connectivity

`IConnectivityManager`\<`TLink`\>

##### networkConfig

[`NetworkConfig`](../interfaces/NetworkConfig.md)

##### auth

[`AuthStrategy`](../interfaces/AuthStrategy.md)

##### collections

[`Collection`](../interfaces/Collection.md)\<`TLink`\>[]

#### Returns

`SyncManager`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

## Properties

### invalidationScheduler

> `protected` `readonly` **invalidationScheduler**: `InvalidationScheduler`\<`TLink`, `TCommand`\>

---

### knownRevisions

> `protected` `readonly` **knownRevisions**: `Map`\<`string`, `bigint`\>

Highest applied revision per stream. Initialized during seeding, advanced on happy-path processing.

## Methods

### buildFetchContext()

> `protected` **buildFetchContext**(): `Promise`\<[`FetchContext`](../interfaces/FetchContext.md)\>

Build network context for collection fetch methods.
Merges static headers from NetworkConfig with dynamic auth headers
from the AuthStrategy. For cookie-based auth, this is a no-op —
the browser sends cookies automatically with fetch().

#### Returns

`Promise`\<[`FetchContext`](../interfaces/FetchContext.md)\>

---

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

> **getConnectivity**(): `IConnectivityManager`\<`TLink`\>

Get connectivity manager.

#### Returns

`IConnectivityManager`\<`TLink`\>

---

### getSeedStatus()

> **getSeedStatus**(`cacheKey`): `"seeded"` \| `"seeding"` \| `"unseeded"`

Get the aggregate seed status for a cache key identity.
Checks all collections whose keyTypes match the identity.

- 'seeded': all matching collections are seeded for this key
- 'seeding': at least one matching collection is currently syncing
- 'unseeded': no status entries or some not yet started

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`"seeded"` \| `"seeding"` \| `"unseeded"`

---

### onApplyWsEventOp()

> `protected` **onApplyWsEventOp**(`op`): `Promise`\<`void`\>

Handle a WebSocket event with pre-resolved cache keys.
Per-stream gap detection: check AFTER caching, repair inline when gaps exist.

#### Parameters

##### op

`ApplyWsEventOp`\<`TLink`\>

#### Returns

`Promise`\<`void`\>

---

### onSessionDestroyed()

> `protected` **onSessionDestroyed**(): `Promise`\<`void`\>

Handle session destroyed (logout).
Cleans up sync state while keeping connectivity monitoring alive
so we're ready when a new session starts.

#### Returns

`Promise`\<`void`\>

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

### resolveCacheKeysFromTopics()

> `protected` **resolveCacheKeysFromTopics**(`streamId`, `topics`): [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>[]

Resolve cache key identities from WS message topics.
Finds matching collections by streamId, then calls each collection's
`cacheKeysFromTopics` to derive the cache keys deterministically.

#### Parameters

##### streamId

`string`

##### topics

readonly `string`[]

#### Returns

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>[]

---

### seed()

> **seed**(`cacheKey`): `Promise`\<`void`\>

Seed all collections whose keyTypes match the given cache key identity.

Full lifecycle:

- If already seeded → returns immediately
- If unseeded → acquires the key (triggering seeding via events), then waits for settlement
- If seeding is in progress → waits for settlement
- If settlement fails → throws

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity to seed for

#### Returns

`Promise`\<`void`\>

---

### seedForKey()

> **seedForKey**(`cacheKey`): `Promise`\<`void`\>

Internal: seed all matching collections for a cache key identity.
Assumes the key is already acquired in storage.
Called by event handlers (onCacheKeyAdded, onCacheKeyAccessed) and by seed().
Emits cache:seed-settled when all matching collections have settled.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity to seed for

#### Returns

`Promise`\<`void`\>

---

### seedOneCollection()

> `protected` **seedOneCollection**(`params`): `Promise`\<`Result`\<\{ `recordCount`: `number`; `seeded`: `boolean`; \}, `WriteQueueException`\>\>

Seed one collection for one cache key.
Shared core logic used by both seedOnInit and seedOnDemand paths.
Handles seed status, idempotency, fetching, topic subscription, and event emission.
Does NOT handle collection matching or settlement.

#### Parameters

##### params

###### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity to seed under

###### collection

[`Collection`](../interfaces/Collection.md)\<`TLink`\>

Collection to seed

###### ctx

[`FetchContext`](../interfaces/FetchContext.md)

Fetch context with base URL, headers, and abort signal

###### topics

readonly `string`[]

Pre-resolved WS topic patterns to subscribe to for this key

#### Returns

`Promise`\<`Result`\<\{ `recordCount`: `number`; `seeded`: `boolean`; \}, `WriteQueueException`\>\>

`{ seeded: true, recordCount }` if data was seeded, `{ seeded: false, recordCount: 0 }` if skipped or failed

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

Force-sync a specific collection from the server.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`void`\>
