/**
 * CacheManager proxy — implements ICacheManager on the main thread.
 * All methods are pure RPC calls to the worker.
 */

import type { AcquireCacheKeyOptions, ICacheManager } from '../../core/cache-manager/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { CacheKeyRecord } from '../../storage/IStorage.js'

/**
 * Main-thread proxy for the worker-side CacheManager.
 */
export class CacheManagerProxy implements ICacheManager {
  private readonly channel: WorkerMessageChannel

  constructor(channel: WorkerMessageChannel) {
    this.channel = channel
  }

  async acquire(
    collection: string,
    params?: Record<string, unknown>,
    options?: AcquireCacheKeyOptions,
  ): Promise<string> {
    return this.channel.request<string>('cacheManager.acquire', [collection, params, options])
  }

  async exists(key: string): Promise<boolean> {
    return this.channel.request<boolean>('cacheManager.exists', [key])
  }

  async get(key: string): Promise<CacheKeyRecord | undefined> {
    return this.channel.request<CacheKeyRecord | undefined>('cacheManager.get', [key])
  }

  async touch(key: string): Promise<void> {
    return this.channel.request<void>('cacheManager.touch', [key])
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
}
