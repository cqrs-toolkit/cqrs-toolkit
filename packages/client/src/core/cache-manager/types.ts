/**
 * Cache manager interface and types.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyRecord } from '../../storage/IStorage.js'
import type { CacheKeyIdentity, CacheKeyTemplate } from './CacheKey.js'

/**
 * Options for acquiring a cache key.
 */
export interface AcquireCacheKeyOptions {
  /** Whether to place a hold (prevents eviction) */
  hold?: boolean
  /** @internal Window ID for hold tracking. Injected by the facade/proxy. */
  windowId?: string
  /** TTL in milliseconds (overrides default) */
  ttl?: number
  /** Eviction policy for new keys (default: 'persistent') */
  evictionPolicy?: 'persistent' | 'ephemeral'
}

/**
 * Cache manager interface.
 * Provides cache key lifecycle, eviction, and hold management.
 *
 * Parameterized on `TLink` so entity cache keys carry the app's link type
 * (`Link` for single-service, `ServiceLink` for multi-service).
 */
export interface ICacheManager<TLink extends Link> {
  /**
   * Acquire a cache key identity. Creates the cache key in storage if it doesn't exist.
   * Returns the full identity object with the derived UUID key and all source data.
   *
   * @param cacheKey - The cache key identity to acquire
   * @param options - Acquisition options
   * @returns The acquired cache key identity
   */
  acquireKey(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>>

  /**
   * Acquire a cache key, returning only the UUID string.
   * Convenience wrapper around {@link acquireKey} for callers that only need the key.
   *
   * @param cacheKey - The cache key identity to acquire
   * @param options - Acquisition options
   * @returns The cache key UUID string
   */
  acquire(cacheKey: CacheKeyIdentity<TLink>, options?: AcquireCacheKeyOptions): Promise<string>

  /**
   * Check if a cache key exists.
   *
   * @param key - Cache key UUID
   * @returns Whether the cache key exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Get a cache key record.
   *
   * @param key - Cache key UUID
   * @returns Cache key record or undefined
   */
  get(key: string): Promise<CacheKeyRecord | undefined>

  /**
   * Touch a cache key to update its access time.
   * Creates the key if it does not exist (spec §2.5.1).
   * Does not place a hold.
   *
   * @param cacheKey - Cache key identity
   */
  touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void>

  /**
   * Place a hold on a cache key.
   * While held, the cache key cannot be evicted.
   *
   * @param key - Cache key UUID
   */
  hold(key: string): Promise<void>

  /**
   * Release a hold on a cache key.
   *
   * @param key - Cache key UUID
   */
  release(key: string): Promise<void>

  /**
   * Freeze a cache key.
   *
   * @param key - Cache key UUID
   */
  freeze(key: string): Promise<void>

  /**
   * Unfreeze a cache key.
   *
   * @param key - Cache key UUID
   */
  unfreeze(key: string): Promise<void>

  /**
   * Check if a cache key is frozen.
   *
   * @param key - Cache key UUID
   * @returns Whether the cache key is frozen
   */
  isFrozen(key: string): Promise<boolean>

  /**
   * Explicitly evict a cache key.
   *
   * @param key - Cache key UUID
   * @returns Whether eviction succeeded
   */
  evict(key: string): Promise<boolean>

  /**
   * Evict all evictable cache keys.
   *
   * @returns Number of cache keys evicted
   */
  evictAll(): Promise<number>

  /**
   * Evict expired cache keys.
   *
   * @returns Number of cache keys evicted
   */
  evictExpired(): Promise<number>

  /**
   * Get the number of cache keys.
   *
   * @returns Total cache key count
   */
  getCount(): Promise<number>

  /**
   * Filter an array of cache key strings to only those that exist in storage.
   *
   * @param keys - Cache key UUIDs to check
   * @returns The subset of keys that exist
   */
  filterExistingCacheKeys(keys: string[]): Promise<string[]>

  /**
   * Register a cache key from a template. Assigns a stable opaque UUID.
   * Auto-wires pending ID reconciliation from EntityRef values in the template.
   *
   * For templates without EntityRef values, this is equivalent to acquireKey
   * with a deterministic identity.
   *
   * @param template - Cache key template (entity or scope)
   * @param options - Acquisition options (hold, ttl, eviction policy)
   * @returns The registered cache key identity with a stable UUID
   */
  registerCacheKey(
    template: CacheKeyTemplate<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>>
}

/**
 * Internal cache manager interface.
 *
 * Extends the public {@link ICacheManager} with methods used by internal
 * callers (SyncManager, CommandQueue, WorkerOrchestrator) that run in the
 * same thread as the CacheManager.
 *
 * Not exposed to consumers — the public API is always {@link ICacheManager}.
 */
export interface ICacheManagerInternal<TLink extends Link> extends ICacheManager<TLink> {
  /** Initialize the cache manager. Resets hold counts, evicts stale ephemeral keys. */
  initialize(): Promise<void>

  /**
   * Check if a cache key exists.
   *
   * @param key - Cache key UUID
   * @returns Whether the cache key exists
   */
  existsSync(key: string): boolean

  /** Clean up cache state when the session is destroyed (user changed, logout). */
  onSessionDestroyed(): Promise<void>

  /** Register a window for multi-tab coordination. Returns false if max windows exceeded. */
  registerWindow(windowId: string): boolean

  /** Unregister a window. Releases all holds from that window and evicts orphaned ephemeral keys. */
  unregisterWindow(windowId: string): Promise<void>

  /**
   * Place a hold on a cache key for a specific window.
   * Used by RPC handlers that know the calling window's ID.
   */
  holdForWindow(key: string, windowId: string): void

  /**
   * Release a hold on a cache key for a specific window.
   * Used by RPC handlers that know the calling window's ID.
   */
  releaseForWindow(key: string, windowId: string): void

  /**
   * Release all holds on the given cache keys across all windows.
   * Used by QueryManager.destroy() to clean up without knowing window IDs.
   */
  releaseHolds(keys: string[]): void

  /**
   * Synchronous cache key registration. For internal callers in the same thread
   * (SyncManager, CommandQueue, anywhere inside the worker).
   * Does not touch storage — the dirty flush handles persistence.
   */
  registerCacheKeySync(
    template: CacheKeyTemplate<TLink>,
    options?: AcquireCacheKeyOptions,
  ): CacheKeyIdentity<TLink>

  /**
   * Resolve pending cache keys when a command succeeds with ID mappings.
   * Called by CommandQueue after reconcileCreateIds.
   */
  resolvePendingKeys(
    commandId: string,
    idMap: Record<string, { serverId: string }>,
    resolveCacheKey?: (cacheKey: CacheKeyIdentity<TLink>) => CacheKeyIdentity<TLink>,
  ): void
}
