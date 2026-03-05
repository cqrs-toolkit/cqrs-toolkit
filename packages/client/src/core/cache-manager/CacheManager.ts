/**
 * Cache manager handles cache key lifecycle, eviction, and holds.
 *
 * Key concepts:
 * - Cache keys define boundaries of cached data
 * - Holds prevent eviction (e.g., data being displayed)
 * - Freeze prevents any changes to the cache key
 * - LRU eviction based on access time
 * - Per-window hold tracking enables tab-death cleanup
 * - Ephemeral keys are auto-evicted when unheld and cannot be frozen
 */

import type { CacheKeyRecord, IStorage } from '../../storage/IStorage.js'
import type { CacheConfig } from '../../types/config.js'
import type { EventBus } from '../events/EventBus.js'
import { deriveCacheKey, deriveScopedCacheKey } from './CacheKey.js'
import type { AcquireCacheKeyOptions, ICacheManager } from './types.js'

/**
 * Cache manager configuration.
 */
export interface CacheManagerConfig {
  storage: IStorage
  eventBus: EventBus
  cacheConfig?: CacheConfig
  /** Unique identifier for this window/tab */
  windowId: string
}

// Re-export types for backwards compatibility
export type { AcquireCacheKeyOptions } from './types.js'

/**
 * Cache manager implementation.
 */
export class CacheManager implements ICacheManager {
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly maxCacheKeys: number
  private readonly defaultTtl: number
  private readonly evictionPolicy: 'lru' | 'fifo'
  private readonly windowId: string
  private readonly maxWindows: number

  /** Per-key set of windowIds that hold the key */
  private readonly holdsByKey = new Map<string, Set<string>>()

  /** Registered windows (for capacity guard) */
  private readonly registeredWindows = new Set<string>()

  constructor(config: CacheManagerConfig) {
    this.storage = config.storage
    this.eventBus = config.eventBus
    this.maxCacheKeys = config.cacheConfig?.maxCacheKeys ?? 1000
    this.defaultTtl = config.cacheConfig?.defaultTtl ?? 30 * 60 * 1000 // 30 minutes
    this.evictionPolicy = config.cacheConfig?.evictionPolicy ?? 'lru'
    this.windowId = config.windowId
    this.maxWindows = config.cacheConfig?.maxWindows ?? 10
  }

  /**
   * Initialize the cache manager.
   * Resets all persisted hold counts, evicts ephemeral keys, and registers this window.
   */
  async initialize(): Promise<void> {
    // Reset all persisted holdCounts to 0
    const allKeys = await this.storage.getAllCacheKeys()
    for (const record of allKeys) {
      if (record.holdCount !== 0) {
        await this.storage.saveCacheKey({ ...record, holdCount: 0 })
      }
    }

    // Evict all ephemeral keys
    for (const record of allKeys) {
      if (record.evictionPolicy === 'ephemeral') {
        await this.storage.deleteCacheKey(record.key)
        this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'explicit' })
      }
    }

    // Register own window
    this.registeredWindows.add(this.windowId)
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
        holdCount: 0,
        frozen: false,
        expiresAt: ttl > 0 ? now + ttl : null,
        createdAt: now,
        evictionPolicy: options?.evictionPolicy ?? 'persistent',
      }
      await this.storage.saveCacheKey(record)
    } else {
      // Update existing cache key (do NOT change evictionPolicy on existing records)
      const updates: Partial<CacheKeyRecord> = {
        lastAccessedAt: now,
      }

      await this.storage.saveCacheKey({ ...record, ...updates })
    }

    // Place hold via per-window tracking if requested
    if (options?.hold) {
      await this.hold(key)
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
   * Place a hold on a cache key for this window.
   * While held by any window, the cache key cannot be evicted.
   * Idempotent: calling hold twice for the same window is a no-op.
   *
   * @param key - Cache key identifier
   */
  async hold(key: string): Promise<void> {
    let windowSet = this.holdsByKey.get(key)
    if (!windowSet) {
      windowSet = new Set()
      this.holdsByKey.set(key, windowSet)
    }

    if (windowSet.has(this.windowId)) {
      return // Already held by this window
    }

    const wasEmpty = windowSet.size === 0
    windowSet.add(this.windowId)

    if (wasEmpty) {
      await this.storage.holdCacheKey(key)
    }
  }

  /**
   * Release a hold on a cache key for this window.
   * If this was the last window holding the key, the persisted holdCount drops to 0.
   * Ephemeral keys are auto-evicted when the last hold is released.
   *
   * @param key - Cache key identifier
   */
  async release(key: string): Promise<void> {
    const windowSet = this.holdsByKey.get(key)
    if (!windowSet || !windowSet.has(this.windowId)) {
      return
    }

    windowSet.delete(this.windowId)

    if (windowSet.size === 0) {
      this.holdsByKey.delete(key)
      await this.storage.releaseCacheKey(key)

      // Auto-evict ephemeral keys when no windows hold them
      const record = await this.storage.getCacheKey(key)
      if (record?.evictionPolicy === 'ephemeral') {
        await this.storage.deleteCacheKey(key)
        this.eventBus.emit('cache:evicted', { cacheKey: key, reason: 'explicit' })
      }
    }
  }

  /**
   * Release all holds for a specific window across all cache keys.
   * Used for tab-death cleanup.
   *
   * @param windowId - Window identifier to release
   */
  async releaseAllForWindow(windowId: string): Promise<void> {
    for (const [key, windowSet] of this.holdsByKey) {
      if (!windowSet.has(windowId)) {
        continue
      }

      windowSet.delete(windowId)

      if (windowSet.size === 0) {
        this.holdsByKey.delete(key)
        await this.storage.releaseCacheKey(key)

        // Auto-evict ephemeral keys when no windows hold them
        const record = await this.storage.getCacheKey(key)
        if (record?.evictionPolicy === 'ephemeral') {
          await this.storage.deleteCacheKey(key)
          this.eventBus.emit('cache:evicted', { cacheKey: key, reason: 'explicit' })
        }
      }
    }
  }

  /**
   * Register a window for capacity tracking.
   * Returns false and emits event if at capacity.
   *
   * @param windowId - Window identifier to register
   * @returns Whether registration succeeded
   */
  registerWindow(windowId: string): boolean {
    if (this.registeredWindows.has(windowId)) {
      return true // Already registered
    }

    if (this.registeredWindows.size >= this.maxWindows) {
      this.eventBus.emit('cache:too-many-windows', {
        windowId,
        maxWindows: this.maxWindows,
      })
      return false
    }

    this.registeredWindows.add(windowId)
    return true
  }

  /**
   * Unregister a window, releasing all its holds.
   *
   * @param windowId - Window identifier to unregister
   */
  async unregisterWindow(windowId: string): Promise<void> {
    this.registeredWindows.delete(windowId)
    await this.releaseAllForWindow(windowId)
  }

  /**
   * Freeze a cache key.
   * While frozen, no changes can be made to data under this cache key.
   * Ephemeral keys cannot be frozen (no-op).
   *
   * @param key - Cache key identifier
   */
  async freeze(key: string): Promise<void> {
    const record = await this.storage.getCacheKey(key)
    if (record && record.evictionPolicy !== 'ephemeral') {
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
   * Cannot evict held cache keys. Cannot evict frozen persistent keys.
   * Ephemeral keys skip the frozen check (they can never be frozen).
   *
   * @param key - Cache key identifier
   * @returns Whether eviction succeeded
   */
  async evict(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    if (!record) {
      return false
    }

    if (record.holdCount > 0) {
      return false
    }

    // Only persistent keys can be frozen, but check anyway
    if (record.frozen) {
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
   * Check for session/user mismatch. If the current session belongs to a
   * different user, wipes all cache keys and emits `cache:session-reset`.
   *
   * @param userId - Expected user identifier
   * @returns Whether a mismatch was detected and the cache was reset
   */
  async checkSessionUser(userId: string): Promise<boolean> {
    const session = await this.storage.getSession()
    if (!session || session.userId === userId) {
      return false
    }

    // User changed — wipe everything
    const allKeys = await this.storage.getAllCacheKeys()
    for (const record of allKeys) {
      await this.storage.deleteCacheKey(record.key)
    }

    this.holdsByKey.clear()
    this.registeredWindows.clear()

    this.eventBus.emit('cache:session-reset', {
      previousUserId: session.userId,
      newUserId: userId,
    })

    return true
  }

  /**
   * Handle session destroyed — wipe all cache keys and in-memory state.
   * Deletes each cache key via storage.deleteCacheKey() which cascade-deletes events + read models.
   */
  async onSessionDestroyed(): Promise<void> {
    const allKeys = await this.storage.getAllCacheKeys()
    for (const record of allKeys) {
      await this.storage.deleteCacheKey(record.key)
    }
    this.holdsByKey.clear()
    this.registeredWindows.clear()
  }

  /**
   * Evict cache keys if we're at capacity.
   */
  private async maybeEvict(): Promise<void> {
    const count = await this.getCount()
    if (count < this.maxCacheKeys) {
      return
    }

    // Evict oldest by access time (LRU), ephemeral first
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
