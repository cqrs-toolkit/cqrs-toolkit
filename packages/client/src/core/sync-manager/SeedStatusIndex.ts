/**
 * Dual-indexed seed status tracking for (collection, cacheKey) pairs.
 *
 * The Sync Manager needs to look up status from two directions:
 * - **By cache key**: Cache key lifecycle events (§4.2.1) drive seeding and cleanup.
 *   `CacheKeyAdded` → seed all collections for that key.
 *   `CacheKeyEvicted` → stop sync and delete metadata for that key.
 * - **By collection**: WS event routing needs all active cache keys for a collection,
 *   and the consumer API queries status by collection name.
 *
 * Both maps reference the same `CollectionSyncStatus` objects.
 * Mutations via `update()` modify the shared object in-place.
 */

/**
 * Sync status for a single (collection, cacheKey) pair.
 */
export interface CollectionSyncStatus {
  collection: string
  cacheKey: string
  seeded: boolean
  lastSyncedPosition?: bigint
  syncing: boolean
  error?: string
}

/**
 * Dual-indexed seed status store.
 *
 * Maintains two maps kept in sync over the same `CollectionSyncStatus` instances:
 * - `byCollection`: collection name → cache key UUID → status
 * - `byCacheKey`: cache key UUID → collection name → status
 */
export class SeedStatusIndex {
  private readonly byCollection = new Map<string, Map<string, CollectionSyncStatus>>()
  private readonly byCacheKey = new Map<string, Map<string, CollectionSyncStatus>>()

  /**
   * Get status for a specific (collection, cacheKey) pair.
   */
  get(collection: string, cacheKey: string): CollectionSyncStatus | undefined {
    return this.byCollection.get(collection)?.get(cacheKey)
  }

  /**
   * Get all statuses for a collection, keyed by cache key UUID.
   */
  getByCollection(collection: string): ReadonlyMap<string, CollectionSyncStatus> | undefined {
    return this.byCollection.get(collection)
  }

  /**
   * Get all statuses for a cache key, keyed by collection name.
   */
  getByCacheKey(cacheKey: string): ReadonlyMap<string, CollectionSyncStatus> | undefined {
    return this.byCacheKey.get(cacheKey)
  }

  /**
   * Insert or replace a status entry. Updates both indexes.
   */
  set(collection: string, cacheKey: string, status: CollectionSyncStatus): void {
    let collectionMap = this.byCollection.get(collection)
    if (!collectionMap) {
      collectionMap = new Map()
      this.byCollection.set(collection, collectionMap)
    }
    collectionMap.set(cacheKey, status)

    let cacheKeyMap = this.byCacheKey.get(cacheKey)
    if (!cacheKeyMap) {
      cacheKeyMap = new Map()
      this.byCacheKey.set(cacheKey, cacheKeyMap)
    }
    cacheKeyMap.set(collection, status)
  }

  /**
   * Mutate an existing entry in-place. No-op if the entry does not exist.
   * Because both indexes reference the same object, the mutation is visible from either index.
   */
  update(collection: string, cacheKey: string, updates: Partial<CollectionSyncStatus>): void {
    const status = this.byCollection.get(collection)?.get(cacheKey)
    if (!status) return
    Object.assign(status, updates)
  }

  /**
   * Check whether a (collection, cacheKey) pair exists.
   */
  has(collection: string, cacheKey: string): boolean {
    return this.byCollection.get(collection)?.has(cacheKey) === true
  }

  /**
   * Remove a single (collection, cacheKey) entry from both indexes.
   * Cleans up empty inner maps.
   */
  delete(collection: string, cacheKey: string): void {
    const collectionMap = this.byCollection.get(collection)
    if (collectionMap) {
      collectionMap.delete(cacheKey)
      if (collectionMap.size === 0) this.byCollection.delete(collection)
    }

    const cacheKeyMap = this.byCacheKey.get(cacheKey)
    if (cacheKeyMap) {
      cacheKeyMap.delete(collection)
      if (cacheKeyMap.size === 0) this.byCacheKey.delete(cacheKey)
    }
  }

  /**
   * Remove all entries for a cache key from both indexes.
   * Used when a cache key is evicted — all collection statuses for that key are invalid.
   */
  deleteAllForCacheKey(cacheKey: string): void {
    const cacheKeyMap = this.byCacheKey.get(cacheKey)
    if (!cacheKeyMap) return

    for (const collection of cacheKeyMap.keys()) {
      const collectionMap = this.byCollection.get(collection)
      if (collectionMap) {
        collectionMap.delete(cacheKey)
        if (collectionMap.size === 0) this.byCollection.delete(collection)
      }
    }

    this.byCacheKey.delete(cacheKey)
  }

  /**
   * Clear all entries from both indexes.
   */
  clear(): void {
    this.byCollection.clear()
    this.byCacheKey.clear()
  }

  /**
   * Iterate all status entries.
   * Iterates via byCollection to avoid yielding duplicates.
   */
  *values(): IterableIterator<CollectionSyncStatus> {
    for (const inner of this.byCollection.values()) {
      yield* inner.values()
    }
  }
}
