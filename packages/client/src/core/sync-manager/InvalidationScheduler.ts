/**
 * Debounced invalidation refetch scheduler.
 *
 * When an event processor signals invalidation, this scheduler intersects the event's
 * cache keys with actively tracked keys, then schedules a debounced refetch for each
 * matching (collection, cacheKey) pair. Repeated invalidations within the debounce
 * window are coalesced into a single refetch.
 */

import { Link, logProvider, Result } from '@meticoeus/ddd-es'
import type { Collection, FetchContext } from '../../types/config.js'
import { type CacheKeyIdentity, hydrateCacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import type { EventBus } from '../events/EventBus.js'
import { WriteQueueException } from '../write-queue/IWriteQueue.js'
import type { SeedStatusIndex } from './SeedStatusIndex.js'
import { resolveTopicsForKey } from './SyncManagerUtils.js'

/**
 * Reason a command success path is asking an aggregate to be invalidated.
 *
 * - `'event-less-response'`: the server response carried no events, so the
 *   pipeline will never deliver rule-1 coverage for the command's anticipated
 *   streams. Fire a refetch for each affected aggregate so server data fills in.
 * - `'no-expected-revision'`: an affected aggregate could not be paired with a
 *   parsable expected revision from the merged `responseIdReferences` /
 *   `responseIdMapping` config. The pipeline has no way to cover that
 *   aggregate via rule 2a, so fall back to invalidation + auto-cover.
 */
export type InvalidateAggregateReason = 'event-less-response' | 'no-expected-revision'

export interface InvalidateAggregateParams<TLink extends Link> {
  /** Canonical stream id of the aggregate to invalidate. */
  streamId: string
  /** Cache key that owns the aggregate's data scope — passed through to the scheduler. */
  cacheKey: string
  /** Originating command id, for logging/telemetry. */
  commandId: string
  /** Why the invalidation is being fired (for logging/future routing). */
  reason: InvalidateAggregateReason
  // Reserved for future use: `TLink` is carried on the interface for
  // collections and future wrappers that need the client's link type.
  readonly _link?: TLink
}

export interface InvalidationSchedulerConfig<TLink extends Link> {
  getFetchContext: () => Promise<FetchContext>
  onRefetch: (params: {
    collection: Collection<TLink>
    cacheKey: CacheKeyIdentity<TLink>
    topics: readonly string[]
    ctx: FetchContext
  }) => Promise<Result<{ seeded: boolean; recordCount: number }, WriteQueueException>>
  debounceMs?: number
}

export class InvalidationScheduler<TLink extends Link> {
  private readonly getFetchContext: () => Promise<FetchContext>
  private readonly onRefetch: InvalidationSchedulerConfig<TLink>['onRefetch']
  private readonly debounceMs: number

  private readonly pendingRefetches = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly cacheManager: ICacheManagerInternal<TLink>,
    private readonly seedStatus: SeedStatusIndex,
    private readonly collections: Collection<TLink>[],
    config: InvalidationSchedulerConfig<TLink>,
  ) {
    this.getFetchContext = config.getFetchContext
    this.onRefetch = config.onRefetch
    this.debounceMs = config.debounceMs ?? 500
  }

  public invalidateAggregate(params: InvalidateAggregateParams<TLink>): void {
    const { streamId, cacheKey, commandId, reason } = params

    const collection = this.collections.find((c) => c.matchesStream(streamId))
    if (!collection) {
      logProvider.log.warn(
        { streamId, commandId, reason },
        'InvalidationScheduler: no collection matched streamId; dropping invalidation',
      )
      return
    }

    this.schedule(collection.name, [cacheKey])
  }

  /**
   * Handle an invalidation signal for a collection.
   * Intersects the event's cache keys with actively tracked keys,
   * then schedules a debounced refetch for each match.
   */
  public schedule(collectionName: string, eventCacheKeys: string[]): void {
    const keysToRefetch = this.intersectActiveCacheKeys(collectionName, eventCacheKeys)
    for (const cacheKey of keysToRefetch) {
      this.scheduleCollectionRefetch(collectionName, cacheKey)
    }
  }

  /**
   * Whether a debounced refetch is pending for the given (collection, cacheKey) pair.
   */
  public hasPending(collectionName: string, cacheKeyId: string): boolean {
    return this.pendingRefetches.has(`${collectionName}:${cacheKeyId}`)
  }

  /**
   * Cancel all pending refetch timers.
   */
  public cancelAll(): void {
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
          if (!result.ok) {
            // TODO: handle appropriately, probably cancel and clean up?
          } else if (result.value.seeded) {
            this.eventBus.emitDebug('sync:refetch-executed', {
              collection: collectionName,
              recordCount: result.value.recordCount,
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
