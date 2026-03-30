/**
 * Cache manager interface and types.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyRecord } from '../../storage/IStorage.js'
import type { CacheKeyIdentity } from './CacheKey.js'

/**
 * Options for acquiring a cache key.
 */
export interface AcquireCacheKeyOptions {
  /** Whether to place a hold (prevents eviction) */
  hold?: boolean
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
}
