/**
 * Query manager provides read-only access to cached data.
 *
 * This is the primary interface for consumers to query read models.
 * It wraps the ReadModelStore with cache key management.
 */

import { assert } from '#utils'
import { type Link, logProvider } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import {
  Subject,
  catchError,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  of,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'
import { EnqueueCommand } from '../../types/index.js'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/index.js'
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  IQueryManagerInternal,
  ListParams,
  ListQueryResult,
  QueryResult,
} from './types.js'

// Re-export types for backwards compatibility
export type { ListQueryResult, QueryOptions, QueryResult } from './types.js'

/**
 * Query manager.
 */
export class QueryManager<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements IQueryManagerInternal<TLink> {
  private readonly destroy$ = new Subject<void>()
  private readonly activeHolds = new Map<string, number>()

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly cacheManager: ICacheManagerInternal<TLink>,
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
  ) {}

  /**
   * Get a single entity by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param options - Query options
   * @returns Query result
   */
  async getById<T>(params: GetByIdParams<TLink>): Promise<QueryResult<TLink, T>> {
    const cacheKeyIdentity = await this.cacheManager.acquireKey(params.cacheKey, {
      hold: params.hold ?? false,
      windowId: params.windowId,
    })

    const model = await this.readModelStore.getById<T>(params.collection, params.id)

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
  async getByIds<T>(params: GetByIdsParams<TLink>): Promise<Map<string, QueryResult<TLink, T>>> {
    const cacheKeyIdentity = await this.cacheManager.acquireKey(params.cacheKey, {
      hold: params.hold ?? false,
      windowId: params.windowId,
    })

    const models = await this.readModelStore.getByIds<T>(params.collection, params.ids)
    const results = new Map<string, QueryResult<TLink, T>>()

    for (const id of params.ids) {
      const stringId = entityIdToString(id)
      const model = models.get(stringId)
      results.set(stringId, {
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
  async list<T>(params: ListParams<TLink>): Promise<ListQueryResult<TLink, T>> {
    const cacheKeyIdentity = await this.cacheManager.acquireKey(params.cacheKey, {
      hold: params.hold ?? false,
      windowId: params.windowId,
    })

    const models = await this.readModelStore.list<T>(params.collection, {
      limit: params.limit,
      offset: params.offset,
      cacheKey: cacheKeyIdentity.key,
    })

    const total = await this.readModelStore.count(params.collection, cacheKeyIdentity.key)

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
  watchCollection(collection: string): Observable<CollectionSignal> {
    const updated$ = this.eventBus.on('readmodel:updated').pipe(
      filter((e) => e.data.collection === collection),
      map(
        (e): CollectionSignal => ({
          type: 'updated',
          ids: e.data.ids,
          commandIds: e.data.commandIds,
        }),
      ),
    )
    const seedCompleted$ = this.eventBus.on('sync:seed-completed').pipe(
      filter((e) => e.data.collection === collection),
      map((e): CollectionSignal => ({ type: 'seed-completed', recordCount: e.data.recordCount })),
    )
    const syncFailed$ = this.eventBus.on('sync:failed').pipe(
      filter((e) => e.data.collection === collection),
      map((e): CollectionSignal => ({ type: 'sync-failed', error: e.data.error })),
    )
    return merge(updated$, seedCompleted$, syncFailed$).pipe(takeUntil(this.destroy$))
  }

  /**
   * Get an observable that emits when a specific entity changes.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Observable of the entity data
   */
  watchById<T>(params: GetByIdParams<TLink>): Observable<T | undefined> {
    return this.eventBus.on('readmodel:updated').pipe(
      filter(
        (event) =>
          event.data.collection === params.collection &&
          event.data.ids.includes(entityIdToString(params.id)),
      ),
      startWith(undefined),
      switchMap(() =>
        from(this.readModelStore.getById<T>(params.collection, params.id)).pipe(
          map((model) => model?.data),
          catchError((err) => {
            logProvider.log.error(
              { err, collection: params.collection, id: params.id },
              'Failed to load value for watchById',
            )
            return of(undefined)
          }),
        ),
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    )
  }

  /**
   * Read a locally-cached read model by ID without triggering any client-side effects.
   *
   * No cache key is acquired, no hold is registered, no events are emitted.
   * Returns `undefined` if the entity is not present in the local store.
   */
  async getLocallyById<T>(collection: string, id: EntityId): Promise<T | undefined> {
    const model = await this.readModelStore.getById<T>(collection, id)
    return model?.data
  }

  /**
   * Check if an entity exists.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Whether the entity exists
   */
  async exists(collection: string, id: EntityId): Promise<boolean> {
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
   */
  async touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    await this.cacheManager.touch(cacheKey)
  }

  async hold(_cacheKey: string): Promise<void> {
    assert.fail('QueryManager.hold() requires a windowId. Use holdForWindow() or the facade.')
  }

  async release(_cacheKey: string): Promise<void> {
    assert.fail('QueryManager.release() requires a windowId. Use releaseForWindow() or the facade.')
  }

  async releaseAll(): Promise<void> {
    assert.fail(
      'QueryManager.releaseAll() requires a windowId. Use releaseAllForWindow() or the facade.',
    )
  }

  /**
   * Place a hold on a cache key for a specific window.
   * Ref-counted — only calls cacheManager.holdForWindow() on the 0→1 transition.
   */
  holdForWindow(cacheKey: string, windowId: string): void {
    const current = this.activeHolds.get(cacheKey) ?? 0
    if (current === 0) {
      this.cacheManager.holdForWindow(cacheKey, windowId)
    }
    this.activeHolds.set(cacheKey, current + 1)
  }

  /**
   * Release a hold on a cache key for a specific window.
   * Ref-counted — only calls cacheManager.releaseForWindow() on the 1→0 transition.
   */
  releaseForWindow(cacheKey: string, windowId: string): void {
    const current = this.activeHolds.get(cacheKey) ?? 0
    if (current <= 0) return

    if (current === 1) {
      this.activeHolds.delete(cacheKey)
      this.cacheManager.releaseForWindow(cacheKey, windowId)
    } else {
      this.activeHolds.set(cacheKey, current - 1)
    }
  }

  /**
   * Release all holds for a specific window.
   */
  releaseAllForWindow(windowId: string): void {
    for (const cacheKey of this.activeHolds.keys()) {
      this.cacheManager.releaseForWindow(cacheKey, windowId)
    }
    this.activeHolds.clear()
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
   * Destroy the query manager.
   */
  async destroy(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()
    this.cacheManager.releaseHolds([...this.activeHolds.keys()])
    this.activeHolds.clear()
  }
}
