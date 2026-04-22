/**
 * Read model store provides read access to cached read models.
 *
 * Key concepts:
 * - Server baseline: The last confirmed server state
 * - Effective data: Server baseline + optimistic local changes
 * - Local changes are overlaid on server baseline
 */

import type { Link } from '@meticoeus/ddd-es'
import type {
  ClientMetadata,
  IStorage,
  IStorageQueryOptions,
  MigrateReadModelIdParams,
  ReadModelRecord,
} from '../../storage/IStorage.js'
import { EnqueueCommand, EntityId, entityIdToString } from '../../types/index.js'
import type { ICommandIdMappingStore } from '../command-id-mapping-store/ICommandIdMappingStore.js'
import type { EventBus } from '../events/EventBus.js'

/**
 * Revision metadata from the event or seed record that produced this update.
 */
export interface RevisionMeta {
  revision: string
  position?: string
}

/**
 * Read model with metadata.
 */
export interface ReadModel<T = unknown> {
  /** Entity ID */
  id: string
  /** Collection name */
  collection: string
  /** Effective data (server + local changes) */
  data: T
  /** Whether there are uncommitted local changes */
  hasLocalChanges: boolean
  /** Server baseline data (undefined if only local) */
  serverData?: T
  /** Last update timestamp */
  updatedAt: number
  /** Stream revision of the last event that updated this entity. Undefined for locally-created entries. */
  revision?: string
  /** Global position of the last event that updated this entity. Undefined for locally-created entries. */
  position?: string
  /** Client-side identity tracking metadata. Undefined for server-seeded entries. */
  _clientMetadata?: ClientMetadata
}

/**
 * Query options for listing read models.
 */
export interface ReadModelQueryOptions extends IStorageQueryOptions {
  /** Filter by cache key */
  cacheKey?: string
  /** Only include models with local changes */
  localChangesOnly?: boolean
}

/**
 * Read model store implementation.
 */
export class ReadModelStore<TLink extends Link, TCommand extends EnqueueCommand> {
  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly storage: IStorage<TLink, TCommand>,
    private readonly mappingStore: ICommandIdMappingStore,
  ) {}

  /**
   * Get a read model by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Read model or undefined
   */
  async getById<T>(collection: string, id: EntityId): Promise<ReadModel<T> | undefined> {
    const record = await this.storage.getReadModel(collection, entityIdToString(id))
    if (record) return this.recordToReadModel<T>(record)

    // Reconciliation fallback: a client-generated ID may have been replaced by a
    // server-assigned ID. Check the command ID mapping cache for a redirect.
    const mapping = this.mappingStore.get(entityIdToString(id))
    if (!mapping) return undefined

    const reconciled = await this.storage.getReadModel(collection, mapping.serverId)
    if (!reconciled) return undefined
    return this.recordToReadModel<T>(reconciled)
  }

  /**
   * Get multiple read models by IDs.
   *
   * @param collection - Collection name
   * @param ids - Entity IDs
   * @returns Map of ID to read model
   */
  async getByIds<T>(collection: string, ids: EntityId[]): Promise<Map<string, ReadModel<T>>> {
    const result = new Map<string, ReadModel<T>>()

    for (const id of ids) {
      const stringId = entityIdToString(id)
      const record = await this.storage.getReadModel(collection, stringId)
      if (record) {
        result.set(stringId, this.recordToReadModel<T>(record))
      }
    }

    return result
  }

  /**
   * Get multiple read models across collections by `(collection, id)` pairs.
   *
   * Returns a `Map` keyed by `"${collection}:${id}"` (the same format the
   * event processor uses for its `updatedIds` result and the reconcile
   * workflow uses for its working-state keys). Missing entries are absent
   * from the returned map — callers can distinguish "not loaded" from
   * "loaded empty" by checking `.has(key)`.
   *
   * This is the preload primitive for reconciliation. A single call
   * replaces N per-entity `getById` hits inside the reconcile setup phase.
   *
   * Intentionally does **not** do the client→server id mapping fallback
   * that `getById` does. Reconciliation callers already hold server ids
   * by the time they preload, and the extra lookup per id would defeat
   * the point of batching.
   *
   * TODO(storage-batching): the current implementation loops into
   * `storage.getReadModel` once per pair. A real batched version should
   * group the pairs by collection and run one SQL query per collection
   * using a batch executor — `WHERE collection = ? AND id IN (?, ?, ...)`
   * — then flatten the per-collection result arrays back into the shared
   * Map keyed by `${collection}:${id}`. The InMemoryStorage version can
   * stay as a simple filter over its in-memory map. Move the grouping
   * logic into the storage layer (new `IStorage.getReadModels` method)
   * once the SQL side lands.
   */
  async getManyByCollectionIds<T>(
    pairs: Iterable<{ collection: string; id: string }>,
  ): Promise<Map<string, ReadModel<T>>> {
    const result = new Map<string, ReadModel<T>>()
    for (const { collection, id } of pairs) {
      const record = await this.storage.getReadModel(collection, id)
      if (record) {
        result.set(`${collection}:${id}`, this.recordToReadModel<T>(record))
      }
    }
    return result
  }

  /**
   * List read models in a collection.
   *
   * @param collection - Collection name
   * @param options - Query options
   * @returns Array of read models
   */
  async list<T>(collection: string, options?: ReadModelQueryOptions): Promise<ReadModel<T>[]> {
    let records: ReadModelRecord[]

    if (options?.cacheKey) {
      records = await this.storage.getReadModelsByCacheKey(options.cacheKey)
      records = records.filter((r) => r.collection === collection)
      if (options.offset !== undefined) {
        records = records.slice(options.offset)
      }
      if (options.limit !== undefined) {
        records = records.slice(0, options.limit)
      }
    } else {
      records = await this.storage.getReadModelsByCollection(collection, options)
    }

    let models = records.map((r) => this.recordToReadModel<T>(r))

    // Apply additional filters
    if (options?.localChangesOnly) {
      models = models.filter((m) => m.hasLocalChanges)
    }

    return models
  }

  /**
   * Get all read models with local changes.
   *
   * @returns Array of read models with uncommitted changes
   */
  async getLocalChanges<T>(): Promise<ReadModel<T>[]> {
    // This is a full scan - in production would need an index
    const allKeys = await this.storage.getAllCacheKeys()

    // Get all read models from all cache keys
    const allModels: ReadModel<T>[] = []
    for (const key of allKeys) {
      const records = await this.storage.getReadModelsByCacheKey(key.key)
      for (const record of records) {
        if (record.hasLocalChanges) {
          allModels.push(this.recordToReadModel<T>(record))
        }
      }
    }

    return allModels
  }

  /**
   * Check if a read model exists.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Whether the read model exists
   */
  async exists(collection: string, id: EntityId): Promise<boolean> {
    const record = await this.storage.getReadModel(collection, entityIdToString(id))
    return record !== undefined
  }

  /**
   * Get the count of read models in a collection.
   *
   * @param collection - Collection name
   * @returns Count of read models
   */
  async count(collection: string, cacheKey?: string): Promise<number> {
    return this.storage.countReadModels(collection, cacheKey)
  }

  /**
   * Directly set a read model (used by sync/seeding).
   * Marks the data as server baseline.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param data - Read model data
   * @param cacheKey - Cache key to associate with
   * @param revisionMeta - Revision metadata from the event or seed record
   */
  async setServerData<T extends object>(
    collection: string,
    id: string,
    data: T,
    cacheKey: string,
    revisionMeta?: RevisionMeta,
  ): Promise<boolean> {
    const dataJson = JSON.stringify(data)
    const now = Date.now()

    const existing = await this.storage.getReadModel(collection, id)

    // If there are local changes, keep the effective data, just update server baseline
    let effectiveData = dataJson
    let hasLocalChanges = false

    if (existing?.hasLocalChanges) {
      // Keep local overlay on top of new server baseline
      const localData = JSON.parse(existing.effectiveData) as Record<string, unknown>

      // Find the diff between old server and local, apply to new server
      if (existing.serverData) {
        const oldServer = JSON.parse(existing.serverData) as Record<string, unknown>
        const localChanges = this.getObjectDiff(oldServer, localData)
        const merged: Record<string, unknown> = Object.fromEntries(Object.entries(data))
        for (const [key, value] of Object.entries(localChanges)) {
          if (value === undefined) {
            delete merged[key]
          } else {
            merged[key] = value
          }
        }
        effectiveData = JSON.stringify(merged)
        hasLocalChanges = Object.keys(localChanges).length > 0
      } else {
        effectiveData = existing.effectiveData
        hasLocalChanges = true
      }
    }

    const revision = revisionMeta?.revision ?? existing?.revision ?? null
    const position = revisionMeta?.position ?? existing?.position ?? null

    // Skip save if nothing changed
    if (
      existing &&
      existing.serverData === dataJson &&
      existing.effectiveData === effectiveData &&
      existing.hasLocalChanges === hasLocalChanges &&
      existing.revision === revision &&
      existing.position === position
    ) {
      return false
    }

    const record = this.readModelToRecord({
      id,
      collection,
      cacheKey,
      existing,
      serverData: dataJson,
      effectiveData,
      hasLocalChanges,
      updatedAt: now,
      revision,
      position,
    })

    await this.storage.saveReadModel(record)
    if (existing) {
      await this.storage.addCacheKeysToReadModel(collection, id, [cacheKey])
    }
    return true
  }

  /**
   * Apply local changes to a read model (optimistic update).
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param changes - Partial changes to apply
   * @param cacheKey - Cache key to associate with (required if creating new)
   */
  async applyLocalChanges<T extends object>(
    collection: string,
    id: string,
    changes: Partial<T>,
    cacheKey: string,
  ): Promise<boolean> {
    const existing = await this.storage.getReadModel(collection, id)
    const now = Date.now()

    let currentData: Record<string, unknown> = {}
    if (existing) {
      currentData = JSON.parse(existing.effectiveData) as Record<string, unknown>
    }

    const effectiveData = JSON.stringify({ ...currentData, ...changes })

    // Skip save if effective data is unchanged and already marked as local
    if (existing && existing.effectiveData === effectiveData && existing.hasLocalChanges) {
      return false
    }

    const record = this.readModelToRecord({
      id,
      collection,
      cacheKey,
      existing,
      effectiveData,
      hasLocalChanges: true,
      updatedAt: now,
    })

    await this.storage.saveReadModel(record)
    if (existing) {
      await this.storage.addCacheKeysToReadModel(collection, id, [cacheKey])
    }
    return true
  }

  /**
   * Set local data as a full replacement of effective data (optimistic).
   * Preserves existing server baseline so future setServerData can three-way merge.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param data - Complete read model data
   * @param cacheKey - Cache key to associate with
   * @returns true if data changed
   */
  async setLocalData<T extends object>(
    collection: string,
    id: string,
    data: T,
    cacheKey: string,
  ): Promise<boolean> {
    const existing = await this.storage.getReadModel(collection, id)
    const effectiveData = JSON.stringify(data)

    // Skip save if effective data is unchanged and already marked as local
    if (existing && existing.effectiveData === effectiveData && existing.hasLocalChanges) {
      return false
    }

    const record = this.readModelToRecord({
      id,
      collection,
      cacheKey,
      existing,
      effectiveData,
      hasLocalChanges: true,
    })

    await this.storage.saveReadModel(record)
    if (existing) {
      await this.storage.addCacheKeysToReadModel(collection, id, [cacheKey])
    }
    return true
  }

  /**
   * Merge partial data into server baseline and recompute effective data via three-way merge.
   * Preserves local overlays that differ from the server baseline.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param data - Partial data to merge into server baseline
   * @param cacheKey - Cache key to associate with
   * @param revisionMeta - Revision metadata from the event or seed record
   * @returns true if data changed
   */
  async mergeServerData<T extends object>(
    collection: string,
    id: string,
    data: Partial<T>,
    cacheKey: string,
    revisionMeta?: RevisionMeta,
  ): Promise<boolean> {
    const existing = await this.storage.getReadModel(collection, id)

    // Merge into server baseline
    let serverBaseline: Record<string, unknown> = {}
    if (existing?.serverData) {
      serverBaseline = JSON.parse(existing.serverData) as Record<string, unknown>
    }
    const newServerData: Record<string, unknown> = { ...serverBaseline, ...data }
    const serverDataJson = JSON.stringify(newServerData)

    // Compute effective data via three-way merge with local overlay
    let effectiveData = serverDataJson
    let hasLocalChanges = false

    if (existing?.hasLocalChanges) {
      const localData = JSON.parse(existing.effectiveData) as Record<string, unknown>

      if (existing.serverData) {
        const oldServer = JSON.parse(existing.serverData) as Record<string, unknown>
        const localChanges = this.getObjectDiff(oldServer, localData)
        const merged: Record<string, unknown> = { ...newServerData }
        for (const [key, value] of Object.entries(localChanges)) {
          if (value === undefined) {
            delete merged[key]
          } else {
            merged[key] = value
          }
        }
        effectiveData = JSON.stringify(merged)
        hasLocalChanges = Object.keys(localChanges).length > 0
      } else {
        // No prior server baseline — keep local effective data
        effectiveData = existing.effectiveData
        hasLocalChanges = true
      }
    }

    const revision = revisionMeta?.revision ?? existing?.revision ?? null
    const position = revisionMeta?.position ?? existing?.position ?? null

    // Skip save if nothing changed
    if (
      existing &&
      existing.serverData === serverDataJson &&
      existing.effectiveData === effectiveData &&
      existing.hasLocalChanges === hasLocalChanges &&
      existing.revision === revision &&
      existing.position === position
    ) {
      return false
    }

    const record = this.readModelToRecord({
      id,
      collection,
      cacheKey,
      existing,
      serverData: serverDataJson,
      effectiveData,
      hasLocalChanges,
      revision,
      position,
    })

    await this.storage.saveReadModel(record)
    if (existing) {
      await this.storage.addCacheKeysToReadModel(collection, id, [cacheKey])
    }
    return true
  }

  /**
   * Clear local changes for a read model (revert to server baseline).
   *
   * @param collection - Collection name
   * @param id - Entity ID
   */
  async clearLocalChanges(collection: string, id: EntityId): Promise<void> {
    const stringId = entityIdToString(id)
    const existing = await this.storage.getReadModel(collection, stringId)
    if (!existing || !existing.hasLocalChanges) return

    if (existing.serverData === null) {
      await this.storage.deleteReadModel(collection, stringId)
    } else {
      // Revert to server baseline
      await this.storage.saveReadModel({
        ...existing,
        effectiveData: existing.serverData,
        hasLocalChanges: false,
        updatedAt: Date.now(),
      })
    }
  }

  /**
   * Set client metadata on a read model entry.
   * Used to track the original client-generated ID through reconciliation.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param metadata - Client metadata to set
   */
  async setClientMetadata(
    collection: string,
    id: EntityId,
    metadata: ClientMetadata,
  ): Promise<void> {
    const existing = await this.storage.getReadModel(collection, entityIdToString(id))
    if (!existing) return
    await this.storage.saveReadModel({ ...existing, _clientMetadata: metadata })
  }

  /**
   * Delete a read model.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   */
  async delete(collection: string, id: EntityId): Promise<boolean> {
    const stringId = entityIdToString(id)
    const existing = await this.storage.getReadModel(collection, stringId)
    if (!existing) return false
    await this.storage.deleteReadModel(collection, stringId)
    return true
  }

  /**
   * Migrate one or more read-model rows from a client-assigned id to a
   * server-assigned id. For each entry in `migrations`:
   *
   *   - Looks up the row in `preloadedRecords` (keyed by `${collection}:${fromId}`)
   *     if provided, otherwise loads from storage. Missing rows are skipped.
   *   - Patches the top-level `id` field in both `effectiveData` and
   *     `serverData` (if present) from `fromId` to `toId`.
   *   - Rewrites the row's primary key to `toId` in place via
   *     {@link IStorage.migrateReadModelIds} — `cacheKeys`, `_clientMetadata`,
   *     `revision`, and `position` are preserved by the storage layer
   *     (columns not in the `UPDATE`'s SET clause are left untouched).
   *   - When the row had no server baseline (`serverData === null`), the
   *     new record is written with `hasLocalChanges: false` — the overlay
   *     is treated as the client's optimistic best guess of what the
   *     server will eventually produce, so the first `setServerData` call
   *     against this row will accept the baseline without introducing
   *     spurious local changes. With an existing baseline,
   *     `hasLocalChanges` is recomputed from the post-patch diff.
   *
   * Intended for the `CommandQueue` success path where `reconcileAggregateIds`
   * has resolved a batch of client→server id mappings and needs to advance
   * the optimistic read-model overlay onto the server ids in lockstep.
   */
  async migrateEntityIds(
    migrations: Iterable<EntityIdMigration>,
    preloadedRecords?: ReadonlyMap<string, ReadModelRecord>,
  ): Promise<void> {
    // Materialize so we can walk it twice: once to collect fetch pairs,
    // again to drive the per-migration storage calls.
    const entries: EntityIdMigration[] = []
    const toFetch: Array<{ collection: string; id: string }> = []
    for (const entry of migrations) {
      if (entry.fromId === entry.toId) continue
      entries.push(entry)
      const key = `${entry.collection}:${entry.fromId}`
      if (!preloadedRecords?.has(key)) {
        toFetch.push({ collection: entry.collection, id: entry.fromId })
      }
    }
    if (entries.length === 0) return

    // Single batch-fetch for anything the caller didn't pre-load. Storage is
    // responsible for collapsing this to one query per collection
    // (`WHERE id IN (...)`), not per pair.
    const fetched =
      toFetch.length > 0
        ? await this.storage.getReadModels(toFetch)
        : new Map<string, ReadModelRecord>()

    const migrationParams: MigrateReadModelIdParams[] = []
    const now = Date.now()
    for (const { collection, fromId, toId } of entries) {
      const key = `${collection}:${fromId}`
      const existing = preloadedRecords?.get(key) ?? fetched.get(key)
      if (!existing) continue

      const patchedEffective = patchIdField(existing.effectiveData, fromId, toId)
      const patchedServer =
        existing.serverData !== null ? patchIdField(existing.serverData, fromId, toId) : null

      const hasLocalChanges = patchedServer === null ? false : patchedServer !== patchedEffective

      migrationParams.push({
        collection,
        fromId,
        toId,
        effectiveData: patchedEffective,
        serverData: patchedServer,
        hasLocalChanges,
        updatedAt: now,
      })
    }
    await this.storage.migrateReadModelIds(migrationParams)

    for (const { collection, fromId, toId } of migrationParams) {
      this.eventBus.emit('readmodel:id-reconciled', {
        collection,
        clientId: fromId,
        serverId: toId,
      })
    }
  }

  /**
   * Get all (id, revision) pairs for entities in a collection that have a persisted revision.
   * Used by SyncManager to restore knownRevisions on startup.
   */
  async getRevisionMap(collection: string): Promise<Array<{ id: string; revision: string }>> {
    return this.storage.getReadModelRevisions(collection)
  }

  /**
   * Convert read model to storage record.
   */
  private readModelToRecord(params: {
    id: EntityId
    collection: string
    cacheKey: string
    existing: ReadModelRecord | undefined
    serverData?: string | null
    effectiveData: string
    hasLocalChanges: boolean
    updatedAt?: number
    revision?: string | null
    position?: string | null
  }): ReadModelRecord {
    const {
      id,
      collection,
      cacheKey,
      existing,
      serverData,
      effectiveData,
      hasLocalChanges,
      updatedAt,
      revision,
      position,
    } = params
    return {
      id: entityIdToString(id),
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: serverData ?? existing?.serverData ?? null,
      effectiveData,
      hasLocalChanges,
      updatedAt: updatedAt ?? Date.now(),
      revision: revision ?? existing?.revision ?? null,
      position: position ?? existing?.position ?? null,
      _clientMetadata: existing?._clientMetadata ?? null,
    }
  }

  /**
   * Convert storage record to read model.
   */
  private recordToReadModel<T>(record: ReadModelRecord): ReadModel<T> {
    return {
      id: record.id,
      collection: record.collection,
      data: JSON.parse(record.effectiveData) as T,
      hasLocalChanges: record.hasLocalChanges,
      serverData: record.serverData ? (JSON.parse(record.serverData) as T) : undefined,
      updatedAt: record.updatedAt,
      revision: record.revision ?? undefined,
      position: record.position ?? undefined,
      _clientMetadata: record._clientMetadata ?? undefined,
    }
  }

  /**
   * Get the difference between two objects.
   * Returns properties in 'current' that differ from 'baseline'.
   */
  private getObjectDiff(
    baseline: Record<string, unknown>,
    current: Record<string, unknown>,
  ): Record<string, unknown> {
    const diff: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(current)) {
      if (!(key in baseline) || JSON.stringify(value) !== JSON.stringify(baseline[key])) {
        diff[key] = value
      }
    }

    // Detect deletions: keys in baseline absent from current
    for (const key of Object.keys(baseline)) {
      if (!(key in current)) {
        diff[key] = undefined
      }
    }

    return diff
  }

  /**
   * Batched pipeline write entry point.
   *
   * Takes an ordered list of read-model mutations (set/merge/delete variants,
   * in-place id migrations, and `_clientMetadata` stamps), folds them per row
   * against a single batched baseline read, and commits the minimal set of
   * storage writes. Preserves every side effect of the per-setter path:
   *
   *   - `setServer` / `mergeServer`: three-way merge of local overlay against
   *     the old server baseline, then reapplied over the new one (local
   *     changes survive server updates).
   *   - `setLocal` / `applyLocal`: overwrite / spread into `effectiveData`
   *     with `hasLocalChanges: true`; preserve `serverData`, `revision`,
   *     `position`.
   *   - `delete`: tombstones the row; no-op when baseline absent.
   *   - `setClientMetadata`: overwrites `_clientMetadata` on the folded record.
   *   - `migrateId`: renames the row in-place via
   *     {@link ReadModelStore.migrateEntityIds} (runs FIRST). Subsequent
   *     mutations targeting the migrated tempId are remapped to the serverId.
   *   - No-op short-circuit: rows whose fold ends deep-equal to the original
   *     baseline (with no new cache-key associations) skip the save — matches
   *     the legacy per-setter behavior of avoiding spurious `updatedAt` bumps.
   *   - Cache-key preservation: saved record's `cacheKeys` come from the
   *     baseline (or `[firstOpCacheKey]` for fresh rows); any additional
   *     cache keys observed in the batch are associated via a follow-up
   *     `addCacheKeysToReadModel` call (one per row).
   *
   * Reads are batched via {@link IStorage.getReadModels}; writes are batched
   * via {@link IStorage.saveReadModels} + {@link IStorage.migrateReadModelIds}.
   * Deletes and cache-key associations loop individually until bulk primitives
   * land in `IStorage` (see `TODO(batch)` markers at the call sites).
   */
  async commit(
    mutations: readonly ReadModelMutation[],
    preloaded?: ReadonlyMap<string, ReadModelRecord>,
  ): Promise<void> {
    if (mutations.length === 0) return

    // 1. Partition migrations out; build the id-remap used by downstream ops.
    const migrations: EntityIdMigration[] = []
    const idRemap = new Map<string, string>()
    type RowOp = Exclude<ReadModelMutation, { kind: 'migrateId' }>
    const rowOps: RowOp[] = []
    for (const m of mutations) {
      if (m.kind === 'migrateId') {
        migrations.push({ collection: m.collection, fromId: m.fromId, toId: m.toId })
        idRemap.set(`${m.collection}:${m.fromId}`, m.toId)
      } else {
        rowOps.push(m)
      }
    }

    // 2. Apply migrations first — row rename happens in place, preserving
    //    `_clientMetadata` / `cacheKeys` / `revision` / `position`.
    if (migrations.length > 0) {
      await this.migrateEntityIds(migrations, preloaded)
    }

    if (rowOps.length === 0) return

    // 3. Collect unique post-remap (collection, id) pairs.
    const pairs = new Map<string, { collection: string; id: string }>()
    for (const op of rowOps) {
      const id = idRemap.get(`${op.collection}:${op.id}`) ?? op.id
      pairs.set(`${op.collection}:${id}`, { collection: op.collection, id })
    }

    // 4. Batch-read any rows not supplied by the caller.
    const toFetch: Array<{ collection: string; id: string }> = []
    for (const [key, pair] of pairs) {
      if (!preloaded?.has(key)) toFetch.push(pair)
    }
    const fetched: Map<string, ReadModelRecord> =
      toFetch.length > 0
        ? await this.storage.getReadModels(toFetch)
        : new Map<string, ReadModelRecord>()
    const baselineOf = (rowKey: string): ReadModelRecord | undefined =>
      preloaded?.get(rowKey) ?? fetched.get(rowKey)

    // 5. Fold per row — each op threads the current state forward so
    //    successive server writes see local-overlay changes preserved, etc.
    interface RowState {
      collection: string
      id: string
      baseline: ReadModelRecord | undefined
      current: ReadModelRecord | null
      cacheKeysSeen: Set<string>
      touched: boolean
    }
    const rowState = new Map<string, RowState>()
    const now = Date.now()

    for (const op of rowOps) {
      const id = idRemap.get(`${op.collection}:${op.id}`) ?? op.id
      const rowKey = `${op.collection}:${id}`
      let state = rowState.get(rowKey)
      if (!state) {
        const baseline = baselineOf(rowKey)
        state = {
          collection: op.collection,
          id,
          baseline,
          current: baseline ?? null,
          cacheKeysSeen: new Set(),
          touched: false,
        }
        rowState.set(rowKey, state)
      }
      if ('cacheKey' in op) state.cacheKeysSeen.add(op.cacheKey)

      const existing = state.current ?? undefined
      switch (op.kind) {
        case 'setServer':
          state.current = this.computeSetServerRecord(
            existing,
            op.collection,
            id,
            op.data,
            op.cacheKey,
            op.revisionMeta,
            now,
          )
          state.touched = true
          break
        case 'mergeServer':
          state.current = this.computeMergeServerRecord(
            existing,
            op.collection,
            id,
            op.data,
            op.cacheKey,
            op.revisionMeta,
            now,
          )
          state.touched = true
          break
        case 'setLocal':
          state.current = this.computeSetLocalRecord(
            existing,
            op.collection,
            id,
            op.data,
            op.cacheKey,
            now,
          )
          state.touched = true
          break
        case 'applyLocal':
          state.current = this.computeApplyLocalRecord(
            existing,
            op.collection,
            id,
            op.data,
            op.cacheKey,
            now,
          )
          state.touched = true
          break
        case 'delete':
          if (existing !== undefined) {
            state.current = null
            state.touched = true
          }
          break
        case 'setClientMetadata':
          if (existing !== undefined) {
            state.current = { ...existing, _clientMetadata: op.metadata }
            state.touched = true
          }
          break
      }
    }

    // 6. Partition fold outcomes into bulk writes.
    const toSave: ReadModelRecord[] = []
    const toDelete: Array<{ collection: string; id: string }> = []
    const toAssociate: Array<{ collection: string; id: string; cacheKeys: string[] }> = []

    for (const state of rowState.values()) {
      if (!state.touched) continue

      if (state.current === null) {
        if (state.baseline) {
          toDelete.push({ collection: state.collection, id: state.id })
        }
        continue
      }

      const baselineKeys = state.baseline ? new Set(state.baseline.cacheKeys) : new Set<string>()
      const newKeys: string[] = []
      for (const k of state.cacheKeysSeen) {
        if (!baselineKeys.has(k) && !state.current.cacheKeys.includes(k)) newKeys.push(k)
      }

      // No-op short-circuit: final record deep-equal to baseline + no new
      // cache-key associations ⇒ skip the save entirely.
      if (state.baseline && recordsEqual(state.baseline, state.current) && newKeys.length === 0) {
        continue
      }

      toSave.push(state.current)
      if (newKeys.length > 0) {
        toAssociate.push({ collection: state.collection, id: state.id, cacheKeys: newKeys })
      }
    }

    // 7. Execute writes.
    if (toSave.length > 0) {
      await this.storage.saveReadModels(toSave)
    }
    await this.storage.deleteReadModels(toDelete)
    await this.storage.addCacheKeysToReadModels(toAssociate)
  }

  private computeSetServerRecord(
    existing: ReadModelRecord | undefined,
    collection: string,
    id: string,
    data: object,
    cacheKey: string,
    revisionMeta: RevisionMeta | undefined,
    now: number,
  ): ReadModelRecord {
    const dataJson = JSON.stringify(data)
    let effectiveData = dataJson
    let hasLocalChanges = false
    if (existing?.hasLocalChanges) {
      const localData = JSON.parse(existing.effectiveData) as Record<string, unknown>
      if (existing.serverData) {
        const oldServer = JSON.parse(existing.serverData) as Record<string, unknown>
        const localChanges = this.getObjectDiff(oldServer, localData)
        const merged: Record<string, unknown> = Object.fromEntries(Object.entries(data))
        for (const [k, v] of Object.entries(localChanges)) {
          if (v === undefined) delete merged[k]
          else merged[k] = v
        }
        effectiveData = JSON.stringify(merged)
        hasLocalChanges = Object.keys(localChanges).length > 0
      } else {
        effectiveData = existing.effectiveData
        hasLocalChanges = true
      }
    }
    return {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: dataJson,
      effectiveData,
      hasLocalChanges,
      revision: revisionMeta?.revision ?? existing?.revision ?? null,
      position: revisionMeta?.position ?? existing?.position ?? null,
      updatedAt: now,
      _clientMetadata: existing?._clientMetadata ?? null,
    }
  }

  private computeMergeServerRecord(
    existing: ReadModelRecord | undefined,
    collection: string,
    id: string,
    data: object,
    cacheKey: string,
    revisionMeta: RevisionMeta | undefined,
    now: number,
  ): ReadModelRecord {
    let serverBaseline: Record<string, unknown> = {}
    if (existing?.serverData) {
      serverBaseline = JSON.parse(existing.serverData) as Record<string, unknown>
    }
    const newServerData: Record<string, unknown> = { ...serverBaseline, ...data }
    const serverDataJson = JSON.stringify(newServerData)

    let effectiveData = serverDataJson
    let hasLocalChanges = false
    if (existing?.hasLocalChanges) {
      const localData = JSON.parse(existing.effectiveData) as Record<string, unknown>
      if (existing.serverData) {
        const oldServer = JSON.parse(existing.serverData) as Record<string, unknown>
        const localChanges = this.getObjectDiff(oldServer, localData)
        const merged: Record<string, unknown> = { ...newServerData }
        for (const [k, v] of Object.entries(localChanges)) {
          if (v === undefined) delete merged[k]
          else merged[k] = v
        }
        effectiveData = JSON.stringify(merged)
        hasLocalChanges = Object.keys(localChanges).length > 0
      } else {
        effectiveData = existing.effectiveData
        hasLocalChanges = true
      }
    }

    return {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: serverDataJson,
      effectiveData,
      hasLocalChanges,
      revision: revisionMeta?.revision ?? existing?.revision ?? null,
      position: revisionMeta?.position ?? existing?.position ?? null,
      updatedAt: now,
      _clientMetadata: existing?._clientMetadata ?? null,
    }
  }

  private computeSetLocalRecord(
    existing: ReadModelRecord | undefined,
    collection: string,
    id: string,
    data: object,
    cacheKey: string,
    now: number,
  ): ReadModelRecord {
    return {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: existing?.serverData ?? null,
      effectiveData: JSON.stringify(data),
      hasLocalChanges: true,
      revision: existing?.revision ?? null,
      position: existing?.position ?? null,
      updatedAt: now,
      _clientMetadata: existing?._clientMetadata ?? null,
    }
  }

  private computeApplyLocalRecord(
    existing: ReadModelRecord | undefined,
    collection: string,
    id: string,
    data: object,
    cacheKey: string,
    now: number,
  ): ReadModelRecord {
    const currentData: Record<string, unknown> = existing
      ? (JSON.parse(existing.effectiveData) as Record<string, unknown>)
      : {}
    return {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: existing?.serverData ?? null,
      effectiveData: JSON.stringify({ ...currentData, ...(data as Record<string, unknown>) }),
      hasLocalChanges: true,
      revision: existing?.revision ?? null,
      position: existing?.position ?? null,
      updatedAt: now,
      _clientMetadata: existing?._clientMetadata ?? null,
    }
  }
}

/**
 * One entry in a {@link ReadModelStore.migrateEntityIds} call.
 */
export interface EntityIdMigration {
  collection: string
  fromId: string
  toId: string
}

/**
 * Discriminated union of read-model mutations that can flow through a single
 * {@link ReadModelStore.commit} call.
 *
 * `migrateId` runs first as a row-rename; subsequent mutations that target
 * the `fromId` are remapped to the `toId` before they fold.
 */
export type ReadModelMutation =
  | {
      kind: 'setServer'
      collection: string
      id: string
      data: object
      cacheKey: string
      revisionMeta?: RevisionMeta
    }
  | {
      kind: 'mergeServer'
      collection: string
      id: string
      data: object
      cacheKey: string
      revisionMeta?: RevisionMeta
    }
  | { kind: 'setLocal'; collection: string; id: string; data: object; cacheKey: string }
  | { kind: 'applyLocal'; collection: string; id: string; data: object; cacheKey: string }
  | { kind: 'delete'; collection: string; id: string }
  | { kind: 'migrateId'; collection: string; fromId: string; toId: string }
  | { kind: 'setClientMetadata'; collection: string; id: string; metadata: ClientMetadata }

/**
 * Structural equality for {@link ReadModelRecord}. Used by
 * {@link ReadModelStore.commit}'s no-op short-circuit to skip saves whose
 * fold outcome matches the pre-batch baseline verbatim.
 *
 * `cacheKeys` are compared separately (the batch's cache-key-association
 * set is the source of truth for new associations), so this function
 * intentionally ignores them.
 */
function recordsEqual(a: ReadModelRecord, b: ReadModelRecord): boolean {
  return (
    a.id === b.id &&
    a.collection === b.collection &&
    a.serverData === b.serverData &&
    a.effectiveData === b.effectiveData &&
    a.hasLocalChanges === b.hasLocalChanges &&
    a.revision === b.revision &&
    a.position === b.position &&
    JSON.stringify(a._clientMetadata) === JSON.stringify(b._clientMetadata)
  )
}

/**
 * Rewrite the top-level `id` field of a serialized read-model payload from
 * `fromId` to `toId`. Matches the anticipated-overlay convention where the
 * `id` may be wrapped in an `EntityRef` — comparison uses
 * {@link entityIdToString} so both wrapped and plain-string ids are handled.
 *
 * Returns the original serialization unchanged when the payload is not an
 * object, does not carry an `id` field, or the id does not match `fromId`.
 */
function patchIdField(serialized: string, fromId: string, toId: string): string {
  const parsed = JSON.parse(serialized) as unknown
  if (typeof parsed !== 'object' || parsed === null) return serialized
  if (!('id' in parsed)) return serialized
  const rawId = (parsed as { id: unknown }).id
  if (entityIdToString(rawId as EntityId) !== fromId) return serialized
  return JSON.stringify({ ...(parsed as Record<string, unknown>), id: toId })
}
