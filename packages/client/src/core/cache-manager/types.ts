/**
 * Cache manager interface and types.
 */

import type { CacheKeyRecord } from '../../storage/IStorage.js'

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
  /** Eviction policy for new keys (default: 'persistent') */
  evictionPolicy?: 'persistent' | 'ephemeral'
}

/**
 * Cache manager interface.
 * Provides cache key lifecycle, eviction, and hold management.
 */
export interface ICacheManager {
  /**
   * Acquire a cache key for a collection with optional parameters.
   * Creates the cache key if it doesn't exist.
   *
   * @param collection - Collection name
   * @param params - Optional query parameters
   * @param options - Acquisition options
   * @returns Cache key identifier
   */
  acquire(
    collection: string,
    params?: Record<string, unknown>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string>

  /**
   * Check if a cache key exists.
   *
   * @param key - Cache key identifier
   * @returns Whether the cache key exists
   */
  exists(key: string): Promise<boolean>

  /**
   * Get a cache key record.
   *
   * @param key - Cache key identifier
   * @returns Cache key record or undefined
   */
  get(key: string): Promise<CacheKeyRecord | undefined>

  /**
   * Touch a cache key to update its access time.
   *
   * @param key - Cache key identifier
   */
  touch(key: string): Promise<void>

  /**
   * Place a hold on a cache key.
   * While held, the cache key cannot be evicted.
   *
   * @param key - Cache key identifier
   */
  hold(key: string): Promise<void>

  /**
   * Release a hold on a cache key.
   *
   * @param key - Cache key identifier
   */
  release(key: string): Promise<void>

  /**
   * Freeze a cache key.
   *
   * @param key - Cache key identifier
   */
  freeze(key: string): Promise<void>

  /**
   * Unfreeze a cache key.
   *
   * @param key - Cache key identifier
   */
  unfreeze(key: string): Promise<void>

  /**
   * Check if a cache key is frozen.
   *
   * @param key - Cache key identifier
   * @returns Whether the cache key is frozen
   */
  isFrozen(key: string): Promise<boolean>

  /**
   * Explicitly evict a cache key.
   *
   * @param key - Cache key identifier
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
}
