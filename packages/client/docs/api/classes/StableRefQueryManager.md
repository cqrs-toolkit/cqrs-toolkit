[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / StableRefQueryManager

# Class: StableRefQueryManager\<TLink\>

Decorator around IQueryManager that preserves object references for
items whose (id, updatedAt) pair has not changed since the last query.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Implements

- [`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

## Constructors

### Constructor

> **new StableRefQueryManager**\<`TLink`\>(`inner`): `StableRefQueryManager`\<`TLink`\>

#### Parameters

##### inner

[`IQueryManager`](../interfaces/IQueryManager.md)\<`TLink`\>

#### Returns

`StableRefQueryManager`\<`TLink`\>

## Methods

### count()

> **count**(`collection`): `Promise`\<`number`\>

Get the count of entities in a collection.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Promise`\<`number`\>

Count

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`count`](../interfaces/IQueryManager.md#count)

---

### destroy()

> **destroy**(): `Promise`\<`void`\>

Destroy the query manager and release resources.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`destroy`](../interfaces/IQueryManager.md#destroy)

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Check if an entity exists.

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`boolean`\>

Whether the entity exists

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`exists`](../interfaces/IQueryManager.md#exists)

---

### getById()

> **getById**\<`T`\>(`params`): `Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>

Get a single entity by ID.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdParams`](../interfaces/GetByIdParams.md)\<`TLink`\>

#### Returns

`Promise`\<[`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>

Query result

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getById`](../interfaces/IQueryManager.md#getbyid)

---

### getByIds()

> **getByIds**\<`T`\>(`params`): `Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>\>

Get multiple entities by IDs.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdsParams`](../interfaces/GetByIdsParams.md)\<`TLink`\>

#### Returns

`Promise`\<`Map`\<`string`, [`QueryResult`](../interfaces/QueryResult.md)\<`TLink`, `T`\>\>\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getByIds`](../interfaces/IQueryManager.md#getbyids)

---

### getLocallyById()

> **getLocallyById**\<`T`\>(`collection`, `id`): `Promise`\<`T` \| `undefined`\>

Read a locally-cached read model by ID without triggering any client-side effects.

Unlike [IQueryManager.getById](../interfaces/IQueryManager.md#getbyid), this does not acquire a cache key,
register holds, emit events, or reconcile references.
It reads straight from the local read-model store and returns the data
if present, or `undefined` if the entity is not cached locally.

Use this for quick local lookups where a full query result
(with metadata and cache-key plumbing) is not needed.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`T` \| `undefined`\>

The cached data, or `undefined` if not present locally

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getLocallyById`](../interfaces/IQueryManager.md#getlocallybyid)

---

### getView()

> **getView**\<`T`, `TParams`\>(`params`): `Promise`\<[`PagedViewResult`](../interfaces/PagedViewResult.md)\<`TLink`, `T`\>\>

Execute a registered cross-collection view by name and return its
paged result. Pull form — one-shot read, no subscription state.

Dispatches between the view's `memory` and `sql` implementations based
on the active storage backend. The library does not validate
cross-mode shape parity; the consumer owns it.

Cache-key semantics: hold-agnostic. The library resolves the cache key
templates declared by the view to [CacheKeyIdentity](../type-aliases/CacheKeyIdentity.md)s and surfaces
them in `result.cacheKeys`, but does not acquire holds — `getView` is a
one-shot read and the caller knows whether the underlying data needs to
outlive the call. For subscription-style queries that should keep their
data pinned, use `watchView` via `createViewQuery`, which holds the
resolved identities for the subscription's lifetime.

#### Type Parameters

##### T

`T`

##### TParams

`TParams` = `unknown`

#### Parameters

##### params

[`GetViewParams`](../interfaces/GetViewParams.md)\<`TParams`\>

#### Returns

`Promise`\<[`PagedViewResult`](../interfaces/PagedViewResult.md)\<`TLink`, `T`\>\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`getView`](../interfaces/IQueryManager.md#getview)

---

### hold()

> **hold**(`cacheKey`): `Promise`\<`void`\>

Place a hold on a cache key.

#### Parameters

##### cacheKey

`string`

Cache key UUID string

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`hold`](../interfaces/IQueryManager.md#hold)

---

### list()

> **list**\<`T`\>(`params`): `Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`TLink`, `T`\>\>

List entities in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`ListParams`](../interfaces/ListParams.md)\<`TLink`\>

#### Returns

`Promise`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`TLink`, `T`\>\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`list`](../interfaces/IQueryManager.md#list)

---

### release()

> **release**(`cacheKey`): `Promise`\<`void`\>

Release a hold on a cache key.

#### Parameters

##### cacheKey

`string`

Cache key UUID string

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`release`](../interfaces/IQueryManager.md#release)

---

### releaseAll()

> **releaseAll**(): `Promise`\<`void`\>

Release all active holds.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`releaseAll`](../interfaces/IQueryManager.md#releaseall)

---

### touch()

> **touch**(`cacheKey`): `Promise`\<`void`\>

Touch a cache key to extend its lifetime.

#### Parameters

##### cacheKey

[`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`touch`](../interfaces/IQueryManager.md#touch)

---

### watchById()

> **watchById**\<`T`\>(`params`): `Observable`\<`T` \| `undefined`\>

Get an observable that emits when a specific entity changes.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`GetByIdParams`](../interfaces/GetByIdParams.md)\<`TLink`\>

#### Returns

`Observable`\<`T` \| `undefined`\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchById`](../interfaces/IQueryManager.md#watchbyid)

---

### watchCollection()

> **watchCollection**(`collection`): `Observable`\<[`CollectionSignal`](../type-aliases/CollectionSignal.md)\>

Get an observable of collection lifecycle signals.
Emits for data updates, seed completion, and sync failures.

#### Parameters

##### collection

`string`

Collection name

#### Returns

`Observable`\<[`CollectionSignal`](../type-aliases/CollectionSignal.md)\>

Observable of collection signals

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchCollection`](../interfaces/IQueryManager.md#watchcollection)

---

### watchList()

> **watchList**\<`T`\>(`params`): `Observable`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`TLink`, `T`\>\>

Get a paged-subscription observable over a collection.

Emits an initial [ListQueryResult](../interfaces/ListQueryResult.md) and re-emits whenever an event
affects the visible page. Three gates filter incoming events without
re-running the underlying query:

- **Cache-key gate** — events must touch the subscription's resolved
  cache key. Cross-key updates (e.g. another workspace's projects)
  are discarded with no per-row work.
- **ID gate** — `updated` rows must intersect the current page's
  primary-source IDs. Off-page updates are suppressed.
- **Page-shift gate** — any `created` / `deleted` rows in the watched
  collection trigger a re-run, since the page composition may have
  changed. (V1 is coarse — future versions add a sort-boundary
  fast-path to skip re-runs for creates that land outside the page.)

Bulk re-fetch triggers: `sync:seed-completed` for the collection,
`session:destroyed`, and `cache:evicted` for the watched key all
bypass the gates and force a re-run.

Hold lifecycle is consumer-managed via [IQueryManager.hold](../interfaces/IQueryManager.md#hold) /
[IQueryManager.release](../interfaces/IQueryManager.md#release) — `watchList` does not auto-acquire or
auto-release. See `params.hold` on the initial fetch.

#### Type Parameters

##### T

`T`

#### Parameters

##### params

[`ListParams`](../interfaces/ListParams.md)\<`TLink`\>

#### Returns

`Observable`\<[`ListQueryResult`](../interfaces/ListQueryResult.md)\<`TLink`, `T`\>\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchList`](../interfaces/IQueryManager.md#watchlist)

---

### watchView()

> **watchView**\<`T`, `TParams`\>(`params`): `Observable`\<[`PagedViewResult`](../interfaces/PagedViewResult.md)\<`TLink`, `T`\>\>

Paged-subscription observable over a registered cross-collection view.

Mirrors [IQueryManager.watchList](../interfaces/IQueryManager.md#watchlist)'s three-gate model with a
cross-source extension:

- **Cache-key gate** — event must touch one of the view's resolved keys.
- **ID gate** — for events on the view's `primarySource`, `updated`
  intersect `pageIds`; for events on a `joinSources[].collection`,
  `updated`/`deleted` intersect that collection's tracked `referencedIds`
  (FK values extracted from the visible rows via `referencedIdPath`).
- **Page-shift gate** — only triggered by creates / deletes in
  `primarySource` within a watched key. Join-source creates / deletes
  never shift the page composition (LEFT JOIN returns null embeds).

Subscription state is per-call (per window). Each emission is a fresh
[PagedViewResult](../interfaces/PagedViewResult.md) — `pageIds` and `referencedIds` rebuild from each
re-run. The watchView observable itself is hold-agnostic; `createViewQuery`
(in `@cqrs-toolkit/client-solid`) wraps it and manages holds on the
emitted identities for the subscription's lifetime.

Page identity: each row's `id` property is treated as the primary
source id. If `T` doesn't carry `id`, structure the row shape (or the
SQL projection) so it does, or the engine can't gate effectively.

#### Type Parameters

##### T

`T`

##### TParams

`TParams` = `unknown`

#### Parameters

##### params

[`GetViewParams`](../interfaces/GetViewParams.md)\<`TParams`\>

#### Returns

`Observable`\<[`PagedViewResult`](../interfaces/PagedViewResult.md)\<`TLink`, `T`\>\>

#### Implementation of

[`IQueryManager`](../interfaces/IQueryManager.md).[`watchView`](../interfaces/IQueryManager.md#watchview)
