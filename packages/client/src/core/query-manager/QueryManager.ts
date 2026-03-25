/**
 * Query manager provides read-only access to cached data.
 *
 * This is the primary interface for consumers to query read models.
 * It wraps the ReadModelStore with cache key management.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
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
import { deriveScopeKey } from '../cache-manager/CacheKey.js'
import type { CacheManager } from '../cache-manager/CacheManager.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/index.js'
import type { IQueryManager, ListQueryResult, QueryOptions, QueryResult } from './types.js'

/**
 * Query manager configuration.
 */
export interface QueryManagerConfig<TLink extends Link> {
  eventBus: EventBus
  cacheManager: CacheManager<TLink>
  readModelStore: ReadModelStore
}

// Re-export types for backwards compatibility
export type { ListQueryResult, QueryOptions, QueryResult } from './types.js'

/**
 * Query manager.
 */
export class QueryManager<TLink extends Link> implements IQueryManager<TLink> {
  private readonly eventBus: EventBus
  private readonly cacheManager: CacheManager<TLink>
  private readonly readModelStore: ReadModelStore

  private readonly destroy$ = new Subject<void>()
  private readonly activeHolds = new Map<string, number>()

  constructor(config: QueryManagerConfig<TLink>) {
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
  ): Promise<QueryResult<TLink, T>> {
    // TODO(lazy-load): The caller should provide the cache key identity instead of
    // QueryManager deriving a 1:1 collection→scope key mapping.
    const identity = deriveScopeKey({ scopeType: collection })
    const cacheKeyIdentity = await this.cacheManager.acquireKey(identity, {
      hold: options?.hold,
    })

    const model = await this.readModelStore.getById<T>(collection, id)

    return {
      data: model?.data,
      meta: model
        ? {
            id: model.id,
            updatedAt: model.updatedAt,
            clientId: model._clientMetadata?.clientId,
            revision: model.revision,
          }
        : undefined,
      hasLocalChanges: model?.hasLocalChanges ?? false,
      cacheKey: cacheKeyIdentity,
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
  ): Promise<Map<string, QueryResult<TLink, T>>> {
    // TODO(lazy-load): The caller should provide the cache key identity instead of
    // QueryManager deriving a 1:1 collection→scope key mapping.
    const identity = deriveScopeKey({ scopeType: collection })
    const cacheKeyIdentity = await this.cacheManager.acquireKey(identity, {
      hold: options?.hold,
    })

    const models = await this.readModelStore.getByIds<T>(collection, ids)
    const results = new Map<string, QueryResult<TLink, T>>()

    for (const id of ids) {
      const model = models.get(id)
      results.set(id, {
        data: model?.data,
        meta: model
          ? { id: model.id, updatedAt: model.updatedAt, clientId: model._clientMetadata?.clientId }
          : undefined,
        hasLocalChanges: model?.hasLocalChanges ?? false,
        cacheKey: cacheKeyIdentity,
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
  async list<T>(collection: string, options?: QueryOptions): Promise<ListQueryResult<TLink, T>> {
    // TODO(lazy-load): The caller should provide the cache key identity instead of
    // QueryManager deriving a 1:1 collection→scope key mapping.
    const identity = deriveScopeKey({ scopeType: collection })
    const cacheKeyIdentity = await this.cacheManager.acquireKey(identity, {
      hold: options?.hold,
    })

    // Don't filter by cache key - list all entities in the collection
    const models = await this.readModelStore.list<T>(collection, {
      limit: options?.limit,
      offset: options?.offset,
    })

    const total = await this.readModelStore.count(collection)

    return {
      data: models.map((m) => m.data),
      meta: models.map((m) => ({
        id: m.id,
        updatedAt: m.updatedAt,
        clientId: m._clientMetadata?.clientId,
        revision: m.revision,
      })),
      total,
      hasLocalChanges: models.some((m) => m.hasLocalChanges),
      cacheKey: cacheKeyIdentity,
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
      filter((event) => event.data.collection === collection),
      map((event) => event.data.ids),
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
      filter((event) => event.data.collection === collection && event.data.ids.includes(id)),
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
    const key = await this.cacheManager.acquire(deriveScopeKey({ scopeType: collection }))
    await this.cacheManager.touch(key)
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
