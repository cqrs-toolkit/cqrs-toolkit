/**
 * Read model store provides read access to cached read models.
 *
 * Key concepts:
 * - Server baseline: The last confirmed server state
 * - Effective data: Server baseline + optimistic local changes
 * - Local changes are overlaid on server baseline
 */

import type { IStorage, QueryOptions, ReadModelRecord } from '../../storage/IStorage.js'

/**
 * Read model store configuration.
 */
export interface ReadModelStoreConfig {
  storage: IStorage
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
}

/**
 * Query options for listing read models.
 */
export interface ReadModelQueryOptions extends QueryOptions {
  /** Filter by cache key */
  cacheKey?: string
  /** Only include models with local changes */
  localChangesOnly?: boolean
}

/**
 * Read model store implementation.
 */
export class ReadModelStore {
  private readonly storage: IStorage

  constructor(config: ReadModelStoreConfig) {
    this.storage = config.storage
  }

  /**
   * Get a read model by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Read model or undefined
   */
  async getById<T>(collection: string, id: string): Promise<ReadModel<T> | undefined> {
    const record = await this.storage.getReadModel(collection, id)
    if (!record) return undefined
    return this.recordToReadModel<T>(record)
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
  async count(collection: string): Promise<number> {
    const records = await this.storage.getReadModelsByCollection(collection)
    return records.length
  }

  /**
   * Directly set a read model (used by sync/seeding).
   * Marks the data as server baseline.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param data - Read model data
   * @param cacheKey - Cache key to associate with
   */
  async setServerData<T extends object>(
    collection: string,
    id: string,
    data: T,
    cacheKey: string,
  ): Promise<void> {
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

    const record: ReadModelRecord = {
      id,
      collection,
      cacheKey,
      serverData: dataJson,
      effectiveData,
      hasLocalChanges,
      updatedAt: now,
    }

    await this.storage.saveReadModel(record)
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
  ): Promise<void> {
    const existing = await this.storage.getReadModel(collection, id)
    const now = Date.now()

    let currentData: Record<string, unknown> = {}
    if (existing) {
      currentData = JSON.parse(existing.effectiveData) as Record<string, unknown>
    }

    const effectiveData = JSON.stringify({ ...currentData, ...changes })

    const record: ReadModelRecord = {
      id,
      collection,
      cacheKey: existing?.cacheKey ?? cacheKey,
      serverData: existing?.serverData ?? null,
      effectiveData,
      hasLocalChanges: true,
      updatedAt: now,
    }

    await this.storage.saveReadModel(record)
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
   * Delete a read model.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   */
  async delete(collection: string, id: string): Promise<void> {
    await this.storage.deleteReadModel(collection, id)
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
