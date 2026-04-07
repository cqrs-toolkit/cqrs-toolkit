/**
 * CacheManager proxy — implements ICacheManager on the main thread.
 * All methods are pure RPC calls to the worker.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import type { AcquireCacheKeyOptions, ICacheManager } from '../../core/cache-manager/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { CacheKeyRecord } from '../../storage/IStorage.js'

/**
 * Main-thread proxy for the worker-side CacheManager.
 */
export class CacheManagerProxy<TLink extends Link> implements ICacheManager<TLink> {
  constructor(private readonly channel: WorkerMessageChannel) {}

  async acquireKey(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<CacheKeyIdentity<TLink>> {
    return this.channel.request<CacheKeyIdentity<TLink>>('cacheManager.acquireKey', [
      cacheKey,
      options,
    ])
  }

  async acquire(
    cacheKey: CacheKeyIdentity<TLink>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    return this.channel.request<string>('cacheManager.acquire', [cacheKey, options])
  }

  async exists(key: string): Promise<boolean> {
    return this.channel.request<boolean>('cacheManager.exists', [key])
  }

  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.channel.request<CacheKeyRecord | undefined>('cacheManager.get', [key])
  }

  async touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    return this.channel.request<void>('cacheManager.touch', [cacheKey])
  }

  async hold(key: string): Promise<void> {
    return this.channel.request<void>('cacheManager.hold', [key])
  }

  async release(key: string): Promise<void> {
    return this.channel.request<void>('cacheManager.release', [key])
  }

  async freeze(key: string): Promise<void> {
    return this.channel.request<void>('cacheManager.freeze', [key])
  }

  async unfreeze(key: string): Promise<void> {
    return this.channel.request<void>('cacheManager.unfreeze', [key])
  }

  async isFrozen(key: string): Promise<boolean> {
    return this.channel.request<boolean>('cacheManager.isFrozen', [key])
  }

  async evict(key: string): Promise<boolean> {
    return this.channel.request<boolean>('cacheManager.evict', [key])
  }

  async evictAll(): Promise<number> {
    return this.channel.request<number>('cacheManager.evictAll')
  }

  async evictExpired(): Promise<number> {
    return this.channel.request<number>('cacheManager.evictExpired')
  }

  async getCount(): Promise<number> {
    return this.channel.request<number>('cacheManager.getCount')
  }

  async filterExistingCacheKeys(keys: string[]): Promise<string[]> {
    return this.channel.request<string[]>('cacheManager.filterExistingCacheKeys', [keys])
  }
}
