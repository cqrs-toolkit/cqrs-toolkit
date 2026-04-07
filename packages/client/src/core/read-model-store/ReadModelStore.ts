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
  ReadModelRecord,
} from '../../storage/IStorage.js'
import { EnqueueCommand } from '../../types/index.js'

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
  constructor(private readonly storage: IStorage<TLink, TCommand>) {}

  /**
   * Get a read model by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Read model or undefined
   */
  async getById<T>(collection: string, id: string): Promise<ReadModel<T> | undefined> {
    const record = await this.storage.getReadModel(collection, id)
    if (record) return this.recordToReadModel<T>(record)

    // Reconciliation fallback: a client-generated ID may have been replaced by a
    // server-assigned ID. Check the command ID mapping table for a redirect.
    const mapping = await this.storage.getCommandIdMapping(id)
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
  async getByIds<T>(collection: string, ids: string[]): Promise<Map<string, ReadModel<T>>> {
    const result = new Map<string, ReadModel<T>>()

    for (const id of ids) {
      const record = await this.storage.getReadModel(collection, id)
      if (record) {
        result.set(id, this.recordToReadModel<T>(record))
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
  async exists(collection: string, id: string): Promise<boolean> {
    const record = await this.storage.getReadModel(collection, id)
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

    const record: ReadModelRecord = {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: dataJson,
      effectiveData,
      hasLocalChanges,
      updatedAt: now,
      revision,
      position,
      _clientMetadata: existing?._clientMetadata ?? null,
    }

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

    const record: ReadModelRecord = {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: existing?.serverData ?? null,
      effectiveData,
      hasLocalChanges: true,
      updatedAt: now,
      revision: existing?.revision ?? null,
      position: existing?.position ?? null,
      _clientMetadata: existing?._clientMetadata ?? null,
    }

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

    const record: ReadModelRecord = {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: existing?.serverData ?? null,
      effectiveData,
      hasLocalChanges: true,
      updatedAt: Date.now(),
      revision: existing?.revision ?? null,
      position: existing?.position ?? null,
      _clientMetadata: existing?._clientMetadata ?? null,
    }

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

    const record: ReadModelRecord = {
      id,
      collection,
      cacheKeys: existing ? existing.cacheKeys : [cacheKey],
      serverData: serverDataJson,
      effectiveData,
      hasLocalChanges,
      updatedAt: Date.now(),
      revision,
      position,
      _clientMetadata: existing?._clientMetadata ?? null,
    }

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
  async clearLocalChanges(collection: string, id: string): Promise<void> {
    const existing = await this.storage.getReadModel(collection, id)
    if (!existing || !existing.hasLocalChanges) return

    if (existing.serverData === null) {
      // No server baseline, delete entirely
      await this.storage.deleteReadModel(collection, id)
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
  async setClientMetadata(collection: string, id: string, metadata: ClientMetadata): Promise<void> {
    const existing = await this.storage.getReadModel(collection, id)
    if (!existing) return
    await this.storage.saveReadModel({ ...existing, _clientMetadata: metadata })
  }

  /**
   * Delete a read model.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   */
  async delete(collection: string, id: string): Promise<boolean> {
    const existing = await this.storage.getReadModel(collection, id)
    if (!existing) return false
    await this.storage.deleteReadModel(collection, id)
    return true
  }

  /**
   * Get all (id, revision) pairs for entities in a collection that have a persisted revision.
   * Used by SyncManager to restore knownRevisions on startup.
   */
  async getRevisionMap(collection: string): Promise<Array<{ id: string; revision: string }>> {
    return this.storage.getReadModelRevisions(collection)
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
}
