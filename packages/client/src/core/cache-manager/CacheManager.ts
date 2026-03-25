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

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyRecord, IStorage } from '../../storage/IStorage.js'
import type { CacheConfig } from '../../types/config.js'
import type { EventBus } from '../events/EventBus.js'
import { type CacheKeyIdentity, identityToRecord } from './CacheKey.js'
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
export class CacheManager<TLink extends Link> implements ICacheManager<TLink> {
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
   * Acquire a cache key, returning only the UUID string.
   * Convenience wrapper around {@link acquireKey} for callers that only need the key.
   */
  async acquire(
    identity: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    const result = await this.acquireKey(identity, options)
    return result.key
  }

  /**
   * Acquire a cache key identity. Creates the cache key in storage if it doesn't exist.
   * Returns the full identity object with the derived UUID key and all source data.
   */
  async acquireKey(
    identity: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    const key = identity.key
    let record = await this.storage.getCacheKey(key)
    const now = Date.now()

    if (!record) {
      await this.maybeEvict()

      const ttl = options?.ttl ?? this.defaultTtl
      record = identityToRecord(identity, {
        evictionPolicy: options?.evictionPolicy ?? 'persistent',
        expiresAt: ttl > 0 ? now + ttl : null,
        now,
      })
      await this.storage.saveCacheKey(record)
    } else {
      await this.storage.saveCacheKey({ ...record, lastAccessedAt: now })
    }

    if (options?.hold) {
      await this.hold(key)
    }

    this.eventBus.emitDebug('cache:key-acquired', {
      cacheKey: key,
      collection: identity.kind === 'entity' ? identity.link.type : identity.scopeType,
      evictionPolicy: record.evictionPolicy,
    })

    return identity
  }

  async exists(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    return record !== undefined
  }

  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.storage.getCacheKey(key)
  }

  async touch(key: string): Promise<void> {
    await this.storage.touchCacheKey(key)
  }

  /**
   * Place a hold on a cache key for this window.
   * While held by any window, the cache key cannot be evicted.
   * Idempotent: calling hold twice for the same window is a no-op.
   */
  async hold(key: string): Promise<void> {
    let windowSet = this.holdsByKey.get(key)
    if (!windowSet) {
      windowSet = new Set()
      this.holdsByKey.set(key, windowSet)
    }

    if (windowSet.has(this.windowId)) {
      return
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
   */
  registerWindow(windowId: string): boolean {
    if (this.registeredWindows.has(windowId)) {
      return true
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
   */
  async unregisterWindow(windowId: string): Promise<void> {
    this.registeredWindows.delete(windowId)
    await this.releaseAllForWindow(windowId)
  }

  async freeze(key: string): Promise<void> {
    const record = await this.storage.getCacheKey(key)
    if (record && record.evictionPolicy !== 'ephemeral') {
      await this.storage.saveCacheKey({ ...record, frozen: true })
    }
  }

  async unfreeze(key: string): Promise<void> {
    const record = await this.storage.getCacheKey(key)
    if (record) {
      await this.storage.saveCacheKey({ ...record, frozen: false })
    }
  }

  async isFrozen(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    return record?.frozen ?? false
  }

  async evict(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    if (!record) {
      return false
    }

    if (record.holdCount > 0) {
      return false
    }

    if (record.frozen) {
      return false
    }

    await this.storage.deleteCacheKey(key)
    this.eventBus.emit('cache:evicted', { cacheKey: key, reason: 'explicit' })
    return true
  }

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

  async evictExpired(): Promise<number> {
    const allKeys = await this.storage.getAllCacheKeys()
    const now = Date.now()
    let count = 0

    for (const record of allKeys) {
      if (record.expiresAt !== null && record.expiresAt <= now && record.holdCount === 0) {
        await this.storage.deleteCacheKey(record.key)
        this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'expired' })
        count++
      }
    }

    return count
  }

  async getCount(): Promise<number> {
    const all = await this.storage.getAllCacheKeys()
    return all.length
  }

  async checkSessionUser(userId: string): Promise<boolean> {
    const session = await this.storage.getSession()
    if (!session || session.userId === userId) {
      return false
    }

    const allKeys = await this.storage.getAllCacheKeys()
    for (const record of allKeys) {
      await this.storage.deleteCacheKey(record.key)
    }

    this.holdsByKey.clear()
    this.eventBus.emit('cache:session-reset', {
      previousUserId: session.userId,
      newUserId: userId,
    })
    return true
  }

  /**
   * Handle session destroyed — clears all cache state.
   */
  async onSessionDestroyed(): Promise<void> {
    const allKeys = await this.storage.getAllCacheKeys()
    for (const record of allKeys) {
      await this.storage.deleteCacheKey(record.key)
      this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'session-change' })
    }
    this.holdsByKey.clear()
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async maybeEvict(): Promise<void> {
    const count = await this.getCount()
    if (count < this.maxCacheKeys) {
      return
    }

    const evictable = await this.storage.getEvictableCacheKeys(1)
    for (const record of evictable) {
      await this.storage.deleteCacheKey(record.key)
      this.eventBus.emit('cache:evicted', { cacheKey: record.key, reason: 'lru' })
    }
  }
}
