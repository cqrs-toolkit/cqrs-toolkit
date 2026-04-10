/**
 * Window-scoped facade for CacheManager.
 *
 * Each window (tab) gets its own facade that knows its windowId.
 * The facade delegates to the real CacheManager for all operations,
 * injecting the windowId for hold/release calls.
 *
 * In online-only mode, createCqrsClient creates one facade.
 * In worker modes, the CacheManagerProxy serves the same role.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyRecord } from '../../storage/IStorage.js'
import type { CacheKeyIdentity, CacheKeyTemplate } from './CacheKey.js'
import type { AcquireCacheKeyOptions, ICacheManager, ICacheManagerInternal } from './types.js'

export class CacheManagerFacade<TLink extends Link> implements ICacheManager<TLink> {
  constructor(
    private readonly inner: ICacheManagerInternal<TLink>,
    private readonly windowId: string,
  ) {}

  async acquireKey(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    return this.inner.acquireKey(cacheKey, { ...options, windowId: this.windowId })
  }

  async acquire(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    const result = await this.acquireKey(cacheKey, options)
    return result.key
  }

  async exists(key: string): Promise<boolean> {
    return this.inner.exists(key)
  }

  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.inner.get(key)
  }

  async touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    return this.inner.touch(cacheKey)
  }

  async hold(key: string): Promise<void> {
    return this.inner.holdForWindow(key, this.windowId)
  }

  async release(key: string): Promise<void> {
    return this.inner.releaseForWindow(key, this.windowId)
  }

  async freeze(key: string): Promise<void> {
    return this.inner.freeze(key)
  }

  async unfreeze(key: string): Promise<void> {
    return this.inner.unfreeze(key)
  }

  async isFrozen(key: string): Promise<boolean> {
    return this.inner.isFrozen(key)
  }

  async evict(key: string): Promise<boolean> {
    return this.inner.evict(key)
  }

  async evictAll(): Promise<number> {
    return this.inner.evictAll()
  }

  async evictExpired(): Promise<number> {
    return this.inner.evictExpired()
  }

  async getCount(): Promise<number> {
    return this.inner.getCount()
  }

  async filterExistingCacheKeys(keys: string[]): Promise<string[]> {
    return this.inner.filterExistingCacheKeys(keys)
  }

  async registerCacheKey(
    template: CacheKeyTemplate<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    return this.inner.registerCacheKey(template, { ...options, windowId: this.windowId })
  }
}
