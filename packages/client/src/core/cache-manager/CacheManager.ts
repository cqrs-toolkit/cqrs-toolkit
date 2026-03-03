/**
 * Cache manager handles cache key lifecycle, eviction, and holds.
 *
 * Key concepts:
 * - Cache keys define boundaries of cached data
 * - Holds prevent eviction (e.g., data being displayed)
 * - Freeze prevents any changes to the cache key
 * - LRU eviction based on access time
 */

import type { CacheKeyRecord, IStorage } from '../../storage/IStorage.js'
import type { CacheConfig } from '../../types/config.js'
import type { EventBus } from '../events/EventBus.js'
import { deriveCacheKey, deriveScopedCacheKey } from './CacheKey.js'

/**
 * Cache manager configuration.
 */
export interface CacheManagerConfig {
  storage: IStorage
  eventBus: EventBus
  cacheConfig?: CacheConfig
}

/**
 * Options for acquiring a cache key.
 */
export interface AcquireCacheKeyOptions {
  /** Whether to place a hold (prevents eviction) */
  hold?: boolean
  /** TTL in milliseconds (overrides default) */
  ttl?: number
  /** Scope for the cache key */
  scope?: string
}

/**
 * Cache manager implementation.
 */
export class CacheManager {
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly maxCacheKeys: number
  private readonly defaultTtl: number
  private readonly evictionPolicy: 'lru' | 'fifo'

  constructor(config: CacheManagerConfig) {
    this.storage = config.storage
    this.eventBus = config.eventBus
    this.maxCacheKeys = config.cacheConfig?.maxCacheKeys ?? 1000
    this.defaultTtl = config.cacheConfig?.defaultTtl ?? 30 * 60 * 1000 // 30 minutes
    this.evictionPolicy = config.cacheConfig?.evictionPolicy ?? 'lru'
  }

  /**
   * Acquire a cache key for a collection with optional parameters.
   * Creates the cache key if it doesn't exist.
   *
   * @param collection - Collection name
   * @param params - Optional query parameters
   * @param options - Acquisition options
   * @returns Cache key identifier
   */
  async acquire(
    collection: string,
    params?: Record<string, unknown>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    const key = options?.scope
      ? deriveScopedCacheKey(options.scope, collection, params)
      : deriveCacheKey(collection, params)

    let record = await this.storage.getCacheKey(key)
    const now = Date.now()

    if (!record) {
      // Check if we need to evict before adding new cache key
      await this.maybeEvict()

      // Create new cache key
      const ttl = options?.ttl ?? this.defaultTtl
      record = {
        key,
        lastAccessedAt: now,
        holdCount: options?.hold ? 1 : 0,
        frozen: false,
        expiresAt: ttl > 0 ? now + ttl : null,
        createdAt: now,
      }
      await this.storage.saveCacheKey(record)
    } else {
      // Update existing cache key
      const updates: Partial<CacheKeyRecord> = {
        lastAccessedAt: now,
      }

      if (options?.hold) {
        updates.holdCount = record.holdCount + 1
      }

      await this.storage.saveCacheKey({ ...record, ...updates })
    }

    return key
  }

  /**
   * Check if a cache key exists.
   *
   * @param key - Cache key identifier
   * @returns Whether the cache key exists
   */
  async exists(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    return record !== undefined
  }

  /**
   * Get a cache key record.
   *
   * @param key - Cache key identifier
   * @returns Cache key record or undefined
   */
  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.storage.getCacheKey(key)
  }

  /**
   * Touch a cache key to update its access time.
   *
   * @param key - Cache key identifier
   */
  async touch(key: string): Promise<void> {
    await this.storage.touchCacheKey(key)
  }

  /**
   * Place a hold on a cache key.
   * While held, the cache key cannot be evicted.
   *
   * @param key - Cache key identifier
   */
  async hold(key: string): Promise<void> {
    await this.storage.holdCacheKey(key)
  }

  /**
   * Release a hold on a cache key.
   *
   * @param key - Cache key identifier
   */
  async release(key: string): Promise<void> {
    await this.storage.releaseCacheKey(key)
  }

  /**
   * Freeze a cache key.
   * While frozen, no changes can be made to data under this cache key.
   *
   * @param key - Cache key identifier
   */
  async freeze(key: string): Promise<void> {
    const record = await this.storage.getCacheKey(key)
    if (record) {
      await this.storage.saveCacheKey({ ...record, frozen: true })
    }
  }

  /**
   * Unfreeze a cache key.
   *
   * @param key - Cache key identifier
   */
  async unfreeze(key: string): Promise<void> {
    const record = await this.storage.getCacheKey(key)
    if (record) {
      await this.storage.saveCacheKey({ ...record, frozen: false })
    }
  }

  /**
   * Check if a cache key is frozen.
   *
   * @param key - Cache key identifier
   * @returns Whether the cache key is frozen
   */
  async isFrozen(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    return record?.frozen ?? false
  }

  /**
   * Explicitly evict a cache key.
   * This will delete the cache key and all associated data.
   * Cannot evict frozen or held cache keys.
   *
   * @param key - Cache key identifier
   * @returns Whether eviction succeeded
   */
  async evict(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    if (!record) {
      return false
    }

    if (record.frozen) {
      return false
    }

    if (record.holdCount > 0) {
      return false
    }

    await this.storage.deleteCacheKey(key)
    this.eventBus.emit('cache:evicted', { cacheKey: key, reason: 'explicit' })
    return true
  }

  /**
   * Evict all evictable cache keys.
   * Used during session clear or manual cleanup.
   *
   * @returns Number of cache keys evicted
   */
  async evictAll(): Promise<number> {
    const evictable = await this.storage.getEvictableCacheKeys(Number.MAX_SAFE_INTEGER)
    let count = 0

    for (const record of evictable) {
      await this.storage.deleteCacheKey(record.key)
      this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'explicit' })
      count++
    }

    return count
  }

  /**
   * Get the number of cache keys.
   *
   * @returns Total cache key count
   */
  async getCount(): Promise<number> {
    const all = await this.storage.getAllCacheKeys()
    return all.length
  }

  /**
   * Evict cache keys if we're at capacity.
   */
  private async maybeEvict(): Promise<void> {
    const count = await this.getCount()
    if (count < this.maxCacheKeys) {
      return
    }

    // Evict oldest by access time (LRU)
    const toEvict = count - this.maxCacheKeys + 1 // Make room for one more
    const evictable = await this.storage.getEvictableCacheKeys(toEvict)

    for (const record of evictable) {
      await this.storage.deleteCacheKey(record.key)
      this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'lru' })
    }
  }

  /**
   * Evict expired cache keys.
   * Should be called periodically (e.g., on activity).
   *
   * @returns Number of cache keys evicted
   */
  async evictExpired(): Promise<number> {
    const now = Date.now()
    const allKeys = await this.storage.getAllCacheKeys()
    let count = 0

    for (const record of allKeys) {
      // Skip if not expired, held, or frozen
      if (record.expiresAt === null || record.expiresAt > now) {
        continue
      }
      if (record.holdCount > 0 || record.frozen) {
        continue
      }

      await this.storage.deleteCacheKey(record.key)
      this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'expired' })
      count++
    }

    return count
  }
}
