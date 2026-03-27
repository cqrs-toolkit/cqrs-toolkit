/**
 * Debounced invalidation refetch scheduler.
 *
 * When an event processor signals invalidation, this scheduler intersects the event's
 * cache keys with actively tracked keys, then schedules a debounced refetch for each
 * matching (collection, cacheKey) pair. Repeated invalidations within the debounce
 * window are coalesced into a single refetch.
 */

import type { Link } from '@meticoeus/ddd-es'
import { logProvider } from '@meticoeus/ddd-es'
import type { Collection, FetchContext } from '../../types/config.js'
import { type CacheKeyIdentity, hydrateCacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { EventBus } from '../events/EventBus.js'
import type { SeedStatusIndex } from './SeedStatusIndex.js'
import { resolveTopicsForKey } from './SyncManagerUtils.js'

export interface InvalidationSchedulerConfig<TLink extends Link> {
  eventBus: EventBus<TLink>
  cacheManager: CacheManager<TLink>
  seedStatus: SeedStatusIndex
  collections: Collection<TLink>[]
  getFetchContext: () => Promise<FetchContext>
  onRefetch: (params: {
    collection: Collection<TLink>
    cacheKey: CacheKeyIdentity<TLink>
    topics: readonly string[]
    ctx: FetchContext
  }) => Promise<{ seeded: boolean; recordCount: number }>
  debounceMs?: number
}

export class InvalidationScheduler<TLink extends Link> {
  private readonly eventBus: EventBus<TLink>
  private readonly cacheManager: CacheManager<TLink>
  private readonly seedStatus: SeedStatusIndex
  private readonly collections: Collection<TLink>[]
  private readonly getFetchContext: () => Promise<FetchContext>
  private readonly onRefetch: InvalidationSchedulerConfig<TLink>['onRefetch']
  private readonly debounceMs: number

  private readonly pendingRefetches = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(config: InvalidationSchedulerConfig<TLink>) {
    this.eventBus = config.eventBus
    this.cacheManager = config.cacheManager
    this.seedStatus = config.seedStatus
    this.collections = config.collections
    this.getFetchContext = config.getFetchContext
    this.onRefetch = config.onRefetch
    this.debounceMs = config.debounceMs ?? 500
  }

  /**
   * Handle an invalidation signal for a collection.
   * Intersects the event's cache keys with actively tracked keys,
   * then schedules a debounced refetch for each match.
   */
  schedule(collectionName: string, eventCacheKeys: string[]): void {
    const keysToRefetch = this.intersectActiveCacheKeys(collectionName, eventCacheKeys)
    for (const cacheKey of keysToRefetch) {
      this.scheduleCollectionRefetch(collectionName, cacheKey)
    }
  }

  /**
   * Whether a debounced refetch is pending for the given (collection, cacheKey) pair.
   */
  hasPending(collectionName: string, cacheKeyId: string): boolean {
    return this.pendingRefetches.has(`${collectionName}:${cacheKeyId}`)
  }

  /**
   * Cancel all pending refetch timers.
   */
  cancelAll(): void {
    for (const timer of this.pendingRefetches.values()) clearTimeout(timer)
    this.pendingRefetches.clear()
  }

  /**
   * Intersect event cache keys with actively tracked cache keys for a collection.
   * Returns cache keys that the event affects AND that we are currently seeded for.
   */
  private intersectActiveCacheKeys(collectionName: string, eventCacheKeys: string[]): string[] {
    const eventKeys = new Set<string>(eventCacheKeys)
    const activeKeys = new Set<string>()

    // Include seedOnInit key if it matches
    const collection = this.collections.find((c) => c.name === collectionName)
    if (collection?.seedOnInit && eventKeys.has(collection.seedOnInit.cacheKey.key)) {
      activeKeys.add(collection.seedOnInit.cacheKey.key)
    }

    // Include on-demand keys from seed status
    const statuses = this.seedStatus.getByCollection(collectionName)
    if (statuses) {
      for (const key of statuses.keys()) {
        if (eventKeys.has(key)) activeKeys.add(key)
      }
    }

    return Array.from(activeKeys)
  }

  /**
   * Schedule a debounced refetch for a single (collection, cacheKey) pair.
   * Repeated invalidations within the delay window are coalesced into a single refetch.
   */
  private scheduleCollectionRefetch(collectionName: string, cacheKeyId: string): void {
    const refetchKey = `${collectionName}:${cacheKeyId}`
    const existing = this.pendingRefetches.get(refetchKey)
    if (existing !== undefined) clearTimeout(existing)

    this.eventBus.emitDebug('sync:refetch-scheduled', {
      collection: collectionName,
      debounceMs: this.debounceMs,
    })

    const timer = setTimeout(() => {
      this.pendingRefetches.delete(refetchKey)
      const collection = this.collections.find((c) => c.name === collectionName)
      if (!collection) return
      ;(async () => {
        try {
          // Resolve cache key identity and topics
          const cacheKey = await this.resolveCacheKeyIdentity(collection, cacheKeyId)
          if (!cacheKey) return

          const topics = resolveTopicsForKey<TLink>(collection, cacheKey)

          const ctx = await this.getFetchContext()
          const result = await this.onRefetch({ collection, cacheKey, topics, ctx })
          if (result.seeded) {
            this.eventBus.emitDebug('sync:refetch-executed', {
              collection: collectionName,
              recordCount: result.recordCount,
            })
          }
        } catch (err) {
          logProvider.log.error({ err, collection: collectionName }, 'Invalidation refetch failed')
        }
      })()
    }, this.debounceMs)

    this.pendingRefetches.set(refetchKey, timer)
  }

  /**
   * Resolve a cache key identity from a collection config and key string.
   * Checks seedOnInit first, then looks up from seed status entries.
   */
  private async resolveCacheKeyIdentity(
    collection: Collection<TLink>,
    cacheKey: string,
  ): Promise<CacheKeyIdentity<TLink> | undefined> {
    if (collection.seedOnInit?.cacheKey.key === cacheKey) {
      return collection.seedOnInit.cacheKey
    }
    // For on-demand keys, reconstruct from the cache key record in storage.
    const record = await this.cacheManager.get(cacheKey)
    if (record) {
      return hydrateCacheKeyIdentity<TLink>(record)
    }
    return undefined
  }
}
