[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ReadModelStore

# Class: ReadModelStore\<TLink, TCommand\>

Read model store implementation.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

## Constructors

### Constructor

> **new ReadModelStore**\<`TLink`, `TCommand`\>(`eventBus`, `storage`, `mappingStore`): `ReadModelStore`\<`TLink`, `TCommand`\>

#### Parameters

##### eventBus

[`EventBus`](EventBus.md)\<`TLink`\>

##### storage

[`IStorage`](../interfaces/IStorage.md)\<`TLink`, `TCommand`\>

##### mappingStore

[`ICommandIdMappingStore`](../interfaces/ICommandIdMappingStore.md)

#### Returns

`ReadModelStore`\<`TLink`, `TCommand`\>

## Methods

### applyLocalChanges()

> **applyLocalChanges**\<`T`\>(`collection`, `id`, `changes`, `cacheKey`): `Promise`\<`boolean`\>

Apply local changes to a read model (optimistic update).

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### changes

`Partial`\<`T`\>

Partial changes to apply

##### cacheKey

`string`

Cache key to associate with (required if creating new)

#### Returns

`Promise`\<`boolean`\>

---

### clearLocalChanges()

> **clearLocalChanges**(`collection`, `id`): `Promise`\<`void`\>

Clear local changes for a read model (revert to server baseline).

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`void`\>

---

### commit()

> **commit**(`mutations`, `preloaded?`): `Promise`\<`void`\>

Batched pipeline write entry point.

Takes an ordered list of read-model mutations (set/merge/delete variants,
in-place id migrations, and `_clientMetadata` stamps), folds them per row
against a single batched baseline read, and commits the minimal set of
storage writes. Preserves every side effect of the per-setter path:

- `setServer` / `mergeServer`: three-way merge of local overlay against
  the old server baseline, then reapplied over the new one (local
  changes survive server updates).
- `setLocal` / `applyLocal`: overwrite / spread into `effectiveData`
  with `hasLocalChanges: true`; preserve `serverData`, `revision`,
  `position`.
- `delete`: tombstones the row; no-op when baseline absent.
- `setClientMetadata`: overwrites `_clientMetadata` on the folded record.
- `migrateId`: renames the row in-place via
  [ReadModelStore.migrateEntityIds](#migrateentityids) (runs FIRST). Subsequent
  mutations targeting the migrated tempId are remapped to the serverId.
- No-op short-circuit: rows whose fold ends deep-equal to the original
  baseline (with no new cache-key associations) skip the save — matches
  the legacy per-setter behavior of avoiding spurious `updatedAt` bumps.
- Cache-key preservation: saved record's `cacheKeys` come from the
  baseline (or `[firstOpCacheKey]` for fresh rows); any additional
  cache keys observed in the batch are associated via a follow-up
  `addCacheKeysToReadModel` call (one per row).

Reads are batched via [IStorage.getReadModels](../interfaces/IStorage.md#getreadmodels); writes are batched
via [IStorage.saveReadModels](../interfaces/IStorage.md#savereadmodels) + [IStorage.migrateReadModelIds](../interfaces/IStorage.md#migratereadmodelids).
Deletes and cache-key associations loop individually until bulk primitives
land in `IStorage` (see `TODO(batch)` markers at the call sites).

#### Parameters

##### mutations

readonly `ReadModelMutation`[]

##### preloaded?

`ReadonlyMap`\<`string`, [`ReadModelRecord`](../interfaces/ReadModelRecord.md)\>

#### Returns

`Promise`\<`void`\>

---

### count()

> **count**(`collection`, `cacheKey?`): `Promise`\<`number`\>

Get the count of read models in a collection.

#### Parameters

##### collection

`string`

Collection name

##### cacheKey?

`string`

#### Returns

`Promise`\<`number`\>

Count of read models

---

### delete()

> **delete**(`collection`, `id`): `Promise`\<`boolean`\>

Delete a read model.

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`boolean`\>

---

### exists()

> **exists**(`collection`, `id`): `Promise`\<`boolean`\>

Check if a read model exists.

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

#### Returns

`Promise`\<`boolean`\>

Whether the read model exists

---

### getById()

> **getById**\<`T`\>(`collection`, `id`): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\> \| `undefined`\>

Get a read model by ID.

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

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\> \| `undefined`\>

Read model or undefined

---

### getByIds()

> **getByIds**\<`T`\>(`collection`, `ids`): `Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

Get multiple read models by IDs.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### ids

[`EntityId`](../type-aliases/EntityId.md)[]

Entity IDs

#### Returns

`Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

Map of ID to read model

---

### getLocalChanges()

> **getLocalChanges**\<`T`\>(): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

Get all read models with local changes.

#### Type Parameters

##### T

`T`

#### Returns

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

Array of read models with uncommitted changes

---

### getManyByCollectionIds()

> **getManyByCollectionIds**\<`T`\>(`pairs`): `Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

Get multiple read models across collections by `(collection, id)` pairs.

Returns a `Map` keyed by `"${collection}:${id}"` (the same format the
event processor uses for its `updatedIds` result and the reconcile
workflow uses for its working-state keys). Missing entries are absent
from the returned map — callers can distinguish "not loaded" from
"loaded empty" by checking `.has(key)`.

This is the preload primitive for reconciliation. A single call
replaces N per-entity `getById` hits inside the reconcile setup phase.

Intentionally does **not** do the client→server id mapping fallback
that `getById` does. Reconciliation callers already hold server ids
by the time they preload, and the extra lookup per id would defeat
the point of batching.

TODO(storage-batching): the current implementation loops into
`storage.getReadModel` once per pair. A real batched version should
group the pairs by collection and run one SQL query per collection
using a batch executor — `WHERE collection = ? AND id IN (?, ?, ...)`
— then flatten the per-collection result arrays back into the shared
Map keyed by `${collection}:${id}`. The InMemoryStorage version can
stay as a simple filter over its in-memory map. Move the grouping
logic into the storage layer (new `IStorage.getReadModels` method)
once the SQL side lands.

#### Type Parameters

##### T

`T`

#### Parameters

##### pairs

`Iterable`\<\{ `collection`: `string`; `id`: `string`; \}\>

#### Returns

`Promise`\<`Map`\<`string`, [`ReadModel`](../interfaces/ReadModel.md)\<`T`\>\>\>

---

### getRevisionMap()

> **getRevisionMap**(`collection`): `Promise`\<`object`[]\>

Get all (id, revision) pairs for entities in a collection that have a persisted revision.
Used by SyncManager to restore knownRevisions on startup.

#### Parameters

##### collection

`string`

#### Returns

`Promise`\<`object`[]\>

---

### list()

> **list**\<`T`\>(`collection`, `options?`): `Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

List read models in a collection.

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

Collection name

##### options?

[`ReadModelQueryOptions`](../interfaces/ReadModelQueryOptions.md)

Query options

#### Returns

`Promise`\<[`ReadModel`](../interfaces/ReadModel.md)\<`T`\>[]\>

Array of read models

---

### mergeServerData()

> **mergeServerData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`, `revisionMeta?`): `Promise`\<`boolean`\>

Merge partial data into server baseline and recompute effective data via three-way merge.
Preserves local overlays that differ from the server baseline.

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### data

`Partial`\<`T`\>

Partial data to merge into server baseline

##### cacheKey

`string`

Cache key to associate with

##### revisionMeta?

[`RevisionMeta`](../interfaces/RevisionMeta.md)

Revision metadata from the event or seed record

#### Returns

`Promise`\<`boolean`\>

true if data changed

---

### migrateEntityIds()

> **migrateEntityIds**(`migrations`, `preloadedRecords?`): `Promise`\<`void`\>

Migrate one or more read-model rows from a client-assigned id to a
server-assigned id. For each entry in `migrations`:

- Looks up the row in `preloadedRecords` (keyed by `${collection}:${fromId}`)
  if provided, otherwise loads from storage. Missing rows are skipped.
- Patches the top-level `id` field in both `effectiveData` and
  `serverData` (if present) from `fromId` to `toId`.
- Rewrites the row's primary key to `toId` in place via
  [IStorage.migrateReadModelIds](../interfaces/IStorage.md#migratereadmodelids) — `cacheKeys`, `_clientMetadata`,
  `revision`, and `position` are preserved by the storage layer
  (columns not in the `UPDATE`'s SET clause are left untouched).
- When the row had no server baseline (`serverData === null`), the
  new record is written with `hasLocalChanges: false` — the overlay
  is treated as the client's optimistic best guess of what the
  server will eventually produce, so the first `setServerData` call
  against this row will accept the baseline without introducing
  spurious local changes. With an existing baseline,
  `hasLocalChanges` is recomputed from the post-patch diff.

Intended for the `CommandQueue` success path where `reconcileAggregateIds`
has resolved a batch of client→server id mappings and needs to advance
the optimistic read-model overlay onto the server ids in lockstep.

#### Parameters

##### migrations

`Iterable`\<`EntityIdMigration`\>

##### preloadedRecords?

`ReadonlyMap`\<`string`, [`ReadModelRecord`](../interfaces/ReadModelRecord.md)\>

#### Returns

`Promise`\<`void`\>

---

### setClientMetadata()

> **setClientMetadata**(`collection`, `id`, `metadata`): `Promise`\<`void`\>

Set client metadata on a read model entry.
Used to track the original client-generated ID through reconciliation.

#### Parameters

##### collection

`string`

Collection name

##### id

[`EntityId`](../type-aliases/EntityId.md)

Entity ID

##### metadata

[`ClientMetadata`](../interfaces/ClientMetadata.md)

Client metadata to set

#### Returns

`Promise`\<`void`\>

---

### setLocalData()

> **setLocalData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`): `Promise`\<`boolean`\>

Set local data as a full replacement of effective data (optimistic).
Preserves existing server baseline so future setServerData can three-way merge.

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### data

`T`

Complete read model data

##### cacheKey

`string`

Cache key to associate with

#### Returns

`Promise`\<`boolean`\>

true if data changed

---

### setServerData()

> **setServerData**\<`T`\>(`collection`, `id`, `data`, `cacheKey`, `revisionMeta?`): `Promise`\<`boolean`\>

Directly set a read model (used by sync/seeding).
Marks the data as server baseline.

#### Type Parameters

##### T

`T` _extends_ `object`

#### Parameters

##### collection

`string`

Collection name

##### id

`string`

Entity ID

##### data

`T`

Read model data

##### cacheKey

`string`

Cache key to associate with

##### revisionMeta?

[`RevisionMeta`](../interfaces/RevisionMeta.md)

Revision metadata from the event or seed record

#### Returns

`Promise`\<`boolean`\>
