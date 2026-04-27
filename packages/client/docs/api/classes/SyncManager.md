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

> **new SyncManager**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`eventBus`, `storage`, `sessionManager`, `anticipatedEventHandler`, `commandQueue`, `eventCache`, `cacheManager`, `eventProcessorRegistry`, `readModelStore`, `queryManager`, `writeQueue`, `connectivity`, `networkConfig`, `auth`, `collections`, `clientAggregates`, `domainExecutor`, `commandStore`, `mappingStore`): `SyncManager`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### sessionManager

[`SessionManager`](SessionManager.md)\<`TLink`, `TCommand`\>

##### anticipatedEventHandler

`IAnticipatedEventHandler`\<`TLink`, `TCommand`\>

##### commandQueue

[`CommandQueue`](CommandQueue.md)\<`TLink`, `TCommand`, `any`, `any`\>

##### eventCache

[`EventCache`](EventCache.md)\<`TLink`, `TCommand`\>

##### cacheManager

`ICacheManagerInternal`\<`TLink`\>

##### eventProcessorRegistry

[`EventProcessorRegistry`](EventProcessorRegistry.md)

##### readModelStore

[`ReadModelStore`](ReadModelStore.md)\<`TLink`, `TCommand`\>

##### queryManager

`IQueryManagerInternal`\<`TLink`\>

##### writeQueue

`IWriteQueue`\<`TLink`, `TCommand`\>

##### connectivity

`IConnectivityManager`\<`TLink`\>

##### networkConfig

[`NetworkConfig`](../interfaces/NetworkConfig.md)

##### auth

[`AuthStrategy`](../interfaces/AuthStrategy.md)

##### collections

[`Collection`](../interfaces/Collection.md)\<`TLink`\>[]

##### clientAggregates

`IClientAggregates`\<`TLink`\>

##### domainExecutor

[`IDomainExecutor`](../interfaces/IDomainExecutor.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\> | `undefined`

##### commandStore

[`ICommandStore`](../interfaces/ICommandStore.md)\<`TLink`, `TCommand`\>

##### mappingStore

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md)

#### Returns

`SyncManager`\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

## Properties

### knownRevisions

> `protected` `readonly` **knownRevisions**: `Map`\<`string`, `bigint`\>

Highest applied revision per stream. Initialized during seeding, advanced on happy-path processing.

---

### pendingWsEvents

> `protected` **pendingWsEvents**: `PendingWsEventEntry`\<`TLink`\>[] = `[]`

In-memory queue of incoming WS events awaiting batched reconcile.
Drained by `onReconcileWsEventsOp` via a reference swap: the op handler
captures the current array by reference and installs a fresh empty array
in one synchronous step, so new events arriving during the async drain
accumulate into the next batch without touching the in-flight one.

Protected so test subclasses can push directly and bypass the WriteQueue
scheduling race that happens when `handleNewWsEvent` is called in a
test that also wants to drive the drain synchronously. Production code
should go through `handleNewWsEvent`.

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

### evaluateCoverageForBatch()

> `protected` **evaluateCoverageForBatch**(`succeededCommands`): `object`

Evaluate the `'succeeded' → 'applied'` transition for every in-scope
succeeded command in this batch.

Detection rules (all based on server-authoritative state):

- **Cache key evicted** — `cacheManager.existsSync(command.cacheKey.key)`
  returns false → applied. The read-model entries that would have
  carried this command's revision are gone, so we can't prove coverage
  any other way; slipping is preferable to leaving the command
  `'succeeded'` forever.
- **Primary-aggregate revision covers** — for the command's primary
  aggregate (from `registration.aggregate`), compare post-batch
  `knownRevisions[primaryStreamId]` to `response.nextExpectedRevision`.
  `>=` means every revision up to and including the command's own
  events has been seen by the read model. Secondary aggregates are
  intentionally ignored — the contract is "primary aggregate applied."

Commands without a registration are skipped here — they were slipped to
`'applied'` at succeed time in `CommandQueue` via its escape hatch.

Returns only the set of commands transitioning to `'applied'`; commands
not yet covered stay `'succeeded'` and are re-evaluated next batch when
more state advances.

#### Parameters

##### succeededCommands

readonly [`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]

#### Returns

`object`

##### applied

> **applied**: [`CommandRecord`](../interfaces/CommandRecord.md)\<`TLink`, `TCommand`, `unknown`\>[]

---

### getAllStatus()

> **getAllStatus**(): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

Get all collection statuses.

#### Returns

[`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md)[]

---

### getCollectionStatus()

> **getCollectionStatus**(`collection`, `cacheKey`): [`CollectionSyncStatus`](../interfaces/CollectionSyncStatus.md) \| `undefined`

Get sync status for a specific (collection, cacheKey) pair.

#### Parameters

##### collection

`string`

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

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

### handleCommandResponseEvents()

> **handleCommandResponseEvents**(`events`, `cacheKey`): `void`

Network boundary: events arriving via a command response envelope.

Fire-and-forget: pushes each event into the same `pendingWsEvents`
queue the WS path uses and schedules the `reconcile-ws-events` op.
Does NOT return a promise tied to event processing — command
lifecycle resolution is driven by `response.id` and
`response.nextExpectedRevision` in `CommandQueue`, not by whether
these events have been applied.

Drop rule: if the command's cacheKey is no longer registered in
`CacheManager` (UI released it between send and response), drop
the batch entirely. The WS path has an implicit version of this
drop because topic subscriptions are managed per held cacheKey —
the response path needs an explicit check because the command's
cacheKey was captured at enqueue time, not at response time.

Gap detection inside the drain handles the "events ahead of
`knownRevisions`" case (e.g. the response is the first thing the
client sees for this stream after a session restart) — the gap
pass kicks repair, which eventually fills the missing revisions.

#### Parameters

##### events

readonly [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)[]

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`void`

---

### handleNewWsEvent()

> `protected` **handleNewWsEvent**(`event`, `cacheKeys`): `void`

Network boundary: WebSocket event arrival.

Synchronous capture + deferred process. Called for every incoming WS event
(once the WS message has been parsed and cache keys resolved). Pushes the
event into the in-memory `pendingWsEvents` queue and schedules a single
`reconcile-ws-events` op via the WriteQueue — subsequent events arriving
before the op runs accumulate into the same batch without re-enqueueing.

No async work is done here: everything the drain needs must be present
on `event` and `cacheKeys` at call time.

#### Parameters

##### event

[`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

##### cacheKeys

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>[]

#### Returns

`void`

---

### onReconcileWsEventsOp()

> `protected` **onReconcileWsEventsOp**(`_op`): `Promise`\<`void`\>

Drain handler for `reconcile-ws-events`.

Runs inside the WriteQueue's serialized processing loop. Snapshots the
pending events into a local batch and clears the in-memory queue so new
events can accumulate into the next batch independently.

Split into two blocks with distinct responsibilities:

SETUP — dedup against EventCache, then bulk-load read model records
for every event target in the filtered batch and lazily populate
`knownRevisions` for any stream whose baseline revision is not yet
in memory. Must run before gap detection so the gap check reads a
correct baseline. Gap repair MUST NOT fire from this block.

HANDLE UPDATES — gap detection (may schedule gap repair or
invalidation), reconcile (applies server events, re-runs dirtied
commands, persists read model mutations), post-reconcile
bookkeeping (seed status positions, markProcessed, debug emits).
All side effects that react to the batch's contents live here.

#### Parameters

##### \_op

`ReconcileWsEventsOp`

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

### resolveCacheKeysFromTopics()

> `protected` **resolveCacheKeysFromTopics**(`streamId`, `topics`): [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>[]

Resolve cache key identities from WS message topics.
Finds matching collections by streamId, then calls each collection's
`cacheKeysFromTopics` to derive the cache keys.
Templates (without `.key`) are resolved via registerCacheKeySync.

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
