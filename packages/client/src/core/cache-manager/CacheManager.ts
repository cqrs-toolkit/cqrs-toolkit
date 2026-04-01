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
import { EnqueueCommand } from '../../types/index.js'
import type { EventBus } from '../events/EventBus.js'
import { type CacheKeyIdentity, hydrateCacheKeyIdentity, identityToRecord } from './CacheKey.js'
import type { AcquireCacheKeyOptions, ICacheManager } from './types.js'

/**
 * Cache manager configuration.
 */
export interface CacheManagerConfig<TLink extends Link, TCommand extends EnqueueCommand> {
  storage: IStorage<TLink, TCommand>
  eventBus: EventBus<TLink>
  cacheConfig?: CacheConfig
  /** Unique identifier for this window/tab */
  windowId: string
}

// Re-export types for backwards compatibility
export type { AcquireCacheKeyOptions } from './types.js'

/**
 * Cache manager implementation.
 */
export class CacheManager<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements ICacheManager<TLink> {
  private readonly storage: IStorage<TLink, TCommand>
  private readonly eventBus: EventBus<TLink>
  private readonly maxCacheKeys: number
  private readonly defaultTtl: number
  private readonly evictionPolicy: 'lru' | 'fifo'
  private readonly windowId: string
  private readonly maxWindows: number

  /** Per-key set of windowIds that hold the key */
  private readonly holdsByKey = new Map<string, Set<string>>()

  /** Registered windows (for capacity guard) */
  private readonly registeredWindows = new Set<string>()

  constructor(config: CacheManagerConfig<TLink, TCommand>) {
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
        this.eventBus.emit('cache:evicted', {
          cacheKey: hydrateCacheKeyIdentity(record),
          reason: 'explicit',
        })
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
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    const result = await this.acquireKey(cacheKey, options)
    return result.key
  }

  /**
   * Acquire a cache key identity. Creates the cache key in storage if it doesn't exist.
   * Returns the full identity object with the derived UUID key and all source data.
   */
  async acquireKey(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    const key = cacheKey.key
    let record = await this.storage.getCacheKey(key)
    const now = Date.now()
    const isNew = !record

    if (!record) {
      await this.maybeEvict()

      const ttl = options?.ttl ?? this.defaultTtl
      record = identityToRecord(cacheKey, {
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

    if (isNew) {
      this.eventBus.emit('cache:key-added', {
        cacheKey: cacheKey,
        evictionPolicy: record.evictionPolicy,
      })
    } else {
      this.eventBus.emit('cache:key-accessed', { cacheKey })
    }

    return cacheKey
  }

  async exists(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    return record !== undefined
  }

  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.storage.getCacheKey(key)
  }

  async touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    await this.acquireKey(cacheKey, { hold: false })
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
        this.eventBus.emit('cache:evicted', {
          cacheKey: hydrateCacheKeyIdentity(record),
          reason: 'explicit',
        })
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
          this.eventBus.emit('cache:evicted', {
            cacheKey: hydrateCacheKeyIdentity(record),
            reason: 'explicit',
          })
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
    if (record && record.evictionPolicy !== 'ephemeral' && !record.frozen) {
      const frozenAt = Date.now()
      await this.storage.saveCacheKey({ ...record, frozen: true, frozenAt })
      this.eventBus.emit('cache:frozen-changed', {
        cacheKey: hydrateCacheKeyIdentity(record),
        frozen: true,
        frozenAt,
      })
      await this.propagateInheritedFrozen(key, true)
    }
  }

  async unfreeze(key: string): Promise<void> {
    const record = await this.storage.getCacheKey(key)
    if (record && record.frozen) {
      await this.storage.saveCacheKey({ ...record, frozen: false, frozenAt: null })
      this.eventBus.emit('cache:frozen-changed', {
        cacheKey: hydrateCacheKeyIdentity(record),
        frozen: false,
        frozenAt: null,
      })
      await this.reevaluateInheritedFrozen(key)
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

    if (record.frozen || record.inheritedFrozen) {
      return false
    }

    // Cannot evict a parent while children exist
    const children = await this.storage.getChildCacheKeys(key)
    if (children.length > 0) {
      return false
    }

    await this.storage.deleteCacheKey(key)
    this.eventBus.emit('cache:evicted', {
      cacheKey: hydrateCacheKeyIdentity(record),
      reason: 'explicit',
    })
    return true
  }

  async evictAll(): Promise<number> {
    let count = 0

    // Bottom-up: repeatedly evict leaf keys until no more are evictable.
    // Each pass only returns leaf keys (no children) that are eligible.
    let evictable = await this.storage.getEvictableCacheKeys(Number.MAX_SAFE_INTEGER)
    while (evictable.length > 0) {
      for (const record of evictable) {
        await this.storage.deleteCacheKey(record.key)
        this.eventBus.emit('cache:evicted', {
          cacheKey: hydrateCacheKeyIdentity(record),
          reason: 'explicit',
        })
        count++
      }
      evictable = await this.storage.getEvictableCacheKeys(Number.MAX_SAFE_INTEGER)
    }

    return count
  }

  async evictExpired(): Promise<number> {
    const allKeys = await this.storage.getAllCacheKeys()
    const now = Date.now()
    let count = 0

    for (const record of allKeys) {
      if (
        record.expiresAt !== null &&
        record.expiresAt <= now &&
        record.holdCount === 0 &&
        !record.frozen &&
        !record.inheritedFrozen
      ) {
        await this.storage.deleteCacheKey(record.key)
        this.eventBus.emit('cache:evicted', {
          cacheKey: hydrateCacheKeyIdentity(record),
          reason: 'expired',
        })
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
      this.eventBus.emit('cache:evicted', {
        cacheKey: hydrateCacheKeyIdentity(record),
        reason: 'session-change',
      })
    }
    this.holdsByKey.clear()
  }

  async filterExistingCacheKeys(keys: string[]): Promise<string[]> {
    return this.storage.filterExistingCacheKeys(keys)
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Propagate inheritedFrozen = true to all descendants of a key.
   * Called when a key is frozen — all children (recursively) inherit the frozen state.
   */
  private async propagateInheritedFrozen(key: string, frozen: boolean): Promise<void> {
    const children = await this.storage.getChildCacheKeys(key)
    for (const child of children) {
      // §2.6: Ephemeral keys never contribute to or receive inherited freeze state
      if (child.evictionPolicy === 'ephemeral') continue
      if (child.inheritedFrozen !== frozen) {
        await this.storage.saveCacheKey({ ...child, inheritedFrozen: frozen })
      }
      await this.propagateInheritedFrozen(child.key, frozen)
    }
  }

  /**
   * Re-evaluate inheritedFrozen for all descendants of a key.
   * Called when a key is unfrozen — children may still inherit freeze from other ancestors.
   */
  private async reevaluateInheritedFrozen(key: string): Promise<void> {
    const children = await this.storage.getChildCacheKeys(key)
    for (const child of children) {
      // §2.6: Ephemeral keys never contribute to or receive inherited freeze state
      if (child.evictionPolicy === 'ephemeral') continue
      const shouldBeInherited = await this.isAncestorFrozen(child.key)
      if (child.inheritedFrozen !== shouldBeInherited) {
        await this.storage.saveCacheKey({ ...child, inheritedFrozen: shouldBeInherited })
      }
      await this.reevaluateInheritedFrozen(child.key)
    }
  }

  /**
   * Check if any ancestor in the parent chain is frozen.
   */
  private async isAncestorFrozen(key: string): Promise<boolean> {
    const record = await this.storage.getCacheKey(key)
    if (!record?.parentKey) return false

    const parent = await this.storage.getCacheKey(record.parentKey)
    if (!parent) return false
    if (parent.frozen) return true

    return this.isAncestorFrozen(parent.key)
  }

  private async maybeEvict(): Promise<void> {
    const count = await this.getCount()
    if (count < this.maxCacheKeys) {
      return
    }

    const evictable = await this.storage.getEvictableCacheKeys(1)
    for (const record of evictable) {
      await this.storage.deleteCacheKey(record.key)
      this.eventBus.emit('cache:evicted', {
        cacheKey: hydrateCacheKeyIdentity(record),
        reason: 'lru',
      })
    }
  }
}
