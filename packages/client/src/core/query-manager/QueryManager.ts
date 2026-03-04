/**
 * Query manager provides read-only access to cached data.
 *
 * This is the primary interface for consumers to query read models.
 * It wraps the ReadModelStore with cache key management.
 */

import { logProvider } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import {
  Subject,
  catchError,
  distinctUntilChanged,
  filter,
  from,
  map,
  of,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelQueryOptions, ReadModelStore } from '../read-model-store/index.js'

/**
 * Query manager configuration.
 */
export interface QueryManagerConfig {
  eventBus: EventBus
  cacheManager: CacheManager
  readModelStore: ReadModelStore
}

/**
 * Query options.
 */
export interface QueryOptions extends ReadModelQueryOptions {
  /** Place a hold on the cache key while query is active */
  hold?: boolean
  /** Custom scope for the cache key */
  scope?: string
}

/**
 * Query result with metadata.
 */
export interface QueryResult<T> {
  /** The data, or undefined if not found */
  data: T | undefined
  /** Whether the data has local changes pending sync */
  hasLocalChanges: boolean
  /** Cache key used for this query */
  cacheKey: string
}

/**
 * List query result.
 */
export interface ListQueryResult<T> {
  /** The data items */
  data: T[]
  /** Total count (may differ from data.length with pagination) */
  total: number
  /** Whether any items have local changes */
  hasLocalChanges: boolean
  /** Cache key used for this query */
  cacheKey: string
}

/**
 * Query manager.
 */
export class QueryManager {
  private readonly eventBus: EventBus
  private readonly cacheManager: CacheManager
  private readonly readModelStore: ReadModelStore

  private readonly destroy$ = new Subject<void>()
  private readonly activeHolds = new Map<string, number>()

  constructor(config: QueryManagerConfig) {
    this.eventBus = config.eventBus
    this.cacheManager = config.cacheManager
    this.readModelStore = config.readModelStore
  }

  /**
   * Get a single entity by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param options - Query options
   * @returns Query result
   */
  async getById<T>(
    collection: string,
    id: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>> {
    const cacheKey = await this.cacheManager.acquire(collection, undefined, {
      hold: options?.hold,
      scope: options?.scope,
    })

    const model = await this.readModelStore.getById<T>(collection, id)

    return {
      data: model?.data,
      hasLocalChanges: model?.hasLocalChanges ?? false,
      cacheKey,
    }
  }

  /**
   * Get multiple entities by IDs.
   *
   * @param collection - Collection name
   * @param ids - Entity IDs
   * @param options - Query options
   * @returns Map of ID to query result
   */
  async getByIds<T>(
    collection: string,
    ids: string[],
    options?: QueryOptions,
  ): Promise<Map<string, QueryResult<T>>> {
    const cacheKey = await this.cacheManager.acquire(collection, undefined, {
      hold: options?.hold,
      scope: options?.scope,
    })

    const models = await this.readModelStore.getByIds<T>(collection, ids)
    const results = new Map<string, QueryResult<T>>()

    for (const id of ids) {
      const model = models.get(id)
      results.set(id, {
        data: model?.data,
        hasLocalChanges: model?.hasLocalChanges ?? false,
        cacheKey,
      })
    }

    return results
  }

  /**
   * List entities in a collection.
   *
   * @param collection - Collection name
   * @param options - Query options
   * @returns List query result
   */
  async list<T>(collection: string, options?: QueryOptions): Promise<ListQueryResult<T>> {
    const cacheKey = await this.cacheManager.acquire(collection, undefined, {
      hold: options?.hold,
      scope: options?.scope,
    })

    // Don't filter by cache key - list all entities in the collection
    const models = await this.readModelStore.list<T>(collection, {
      limit: options?.limit,
      offset: options?.offset,
    })

    const total = await this.readModelStore.count(collection)

    return {
      data: models.map((m) => m.data),
      total,
      hasLocalChanges: models.some((m) => m.hasLocalChanges),
      cacheKey,
    }
  }

  /**
   * Get an observable that emits when data in a collection changes.
   * Use this for reactive UI updates.
   *
   * @param collection - Collection name
   * @returns Observable of update notifications
   */
  watchCollection(collection: string): Observable<string[]> {
    return this.eventBus.on('readmodel:updated').pipe(
      filter((event) => event.payload.collection === collection),
      map((event) => event.payload.ids),
      takeUntil(this.destroy$),
    )
  }

  /**
   * Get an observable that emits when a specific entity changes.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Observable of the entity data
   */
  watchById<T>(collection: string, id: string): Observable<T | undefined> {
    return this.eventBus.on('readmodel:updated').pipe(
      filter((event) => event.payload.collection === collection && event.payload.ids.includes(id)),
      startWith(undefined),
      switchMap(() =>
        from(this.readModelStore.getById<T>(collection, id)).pipe(
          map((model) => model?.data),
          catchError((err) => {
            logProvider.log.error({ err, collection, id }, 'Failed to load value for watchById')
            return of(undefined)
          }),
        ),
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    )
  }

  /**
   * Check if an entity exists.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Whether the entity exists
   */
  async exists(collection: string, id: string): Promise<boolean> {
    return this.readModelStore.exists(collection, id)
  }

  /**
   * Get the count of entities in a collection.
   *
   * @param collection - Collection name
   * @returns Count
   */
  async count(collection: string): Promise<number> {
    return this.readModelStore.count(collection)
  }

  /**
   * Touch the cache key for a collection.
   * Extends its lifetime in the cache.
   *
   * @param collection - Collection name
   */
  async touch(collection: string): Promise<void> {
    const cacheKey = await this.cacheManager.acquire(collection)
    await this.cacheManager.touch(cacheKey)
  }

  /**
   * Place a hold on a cache key.
   * While held, the data cannot be evicted.
   * Only calls cacheManager.hold() on the 0→1 transition.
   *
   * @param cacheKey - Cache key to hold
   */
  async hold(cacheKey: string): Promise<void> {
    const current = this.activeHolds.get(cacheKey) ?? 0
    if (current === 0) {
      await this.cacheManager.hold(cacheKey)
    }
    this.activeHolds.set(cacheKey, current + 1)
  }

  /**
   * Release a hold on a cache key.
   * Only calls cacheManager.release() on the 1→0 transition.
   *
   * @param cacheKey - Cache key to release
   */
  async release(cacheKey: string): Promise<void> {
    const current = this.activeHolds.get(cacheKey) ?? 0
    if (current <= 0) return

    if (current === 1) {
      this.activeHolds.delete(cacheKey)
      await this.cacheManager.release(cacheKey)
    } else {
      this.activeHolds.set(cacheKey, current - 1)
    }
  }

  /**
   * Handle session destroyed — clear all in-memory holds without calling cacheManager.release().
   * CacheManager state is already being wiped separately.
   */
  onSessionDestroyed(): void {
    this.activeHolds.clear()
  }

  /**
   * Release hold tracking for an evicted cache key.
   * Removes the entry from activeHolds without calling cacheManager.release()
   * since the cache key has already been evicted from storage.
   */
  releaseForCacheKey(cacheKey: string): void {
    this.activeHolds.delete(cacheKey)
  }

  /**
   * Release all active holds.
   * One cacheManager.release() per key regardless of local count.
   */
  async releaseAll(): Promise<void> {
    for (const cacheKey of this.activeHolds.keys()) {
      await this.cacheManager.release(cacheKey)
    }
    this.activeHolds.clear()
  }

  /**
   * Destroy the query manager.
   */
  async destroy(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()
    await this.releaseAll()
  }
}
