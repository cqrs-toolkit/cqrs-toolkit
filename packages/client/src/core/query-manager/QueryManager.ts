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
  Observable as RxObservable,
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
import type { Collection } from '../../types/config.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'
import { EnqueueCommand } from '../../types/index.js'
import type { CacheKeyIdentity, CacheKeyTemplate } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import { getAtPath } from '../entity-ref/ref-path.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/index.js'
import type { ViewExecutor } from '../views/ViewExecutor.js'
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  GetViewParams,
  IQueryManagerInternal,
  ListParams,
  ListQueryResult,
  PagedViewResult,
  QueryResult,
} from './types.js'

// Re-export types for backwards compatibility
export type { ListQueryResult, QueryOptions, QueryResult } from './types.js'

/**
 * True when any id in `ids` is also in `tracked`. Both arguments are
 * optional / nullable — undefined `ids` (an omitted event bucket) and
 * empty `tracked` short-circuit to false. Used by the watchList / watchView
 * gates to decide whether an event touches a currently-rendered row.
 */
function eventIdInSet(
  ids: readonly string[] | undefined,
  tracked: readonly string[] | ReadonlySet<string>,
): boolean {
  if (!ids || ids.length === 0) return false
  if (tracked instanceof Set) {
    for (const id of ids) if (tracked.has(id)) return true
    return false
  }
  const arr = tracked as readonly string[]
  if (arr.length === 0) return false
  for (const id of ids) if (arr.includes(id)) return true
  return false
}

/**
 * Query manager.
 */
export class QueryManager<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements IQueryManagerInternal<TLink> {
  private readonly destroy$ = new Subject<void>()
  private readonly activeHolds = new Map<string, number>()

  private readonly collectionsByName: ReadonlyMap<string, Collection<TLink>>

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly cacheManager: ICacheManagerInternal<TLink>,
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
    collections: readonly Collection<TLink>[] = [],
    private readonly viewExecutor?: ViewExecutor<TLink>,
  ) {
    const map = new Map<string, Collection<TLink>>()
    for (const c of collections) map.set(c.name, c)
    this.collectionsByName = map
  }

  /**
   * Resolve a per-collection setting that's only present when the consumer
   * registered the collection. Returns the literal default when the
   * collection isn't registered (e.g. tests that use read-model storage
   * directly without a full config).
   */
  private collectionListTotal(name: string): boolean {
    return this.collectionsByName.get(name)?.list?.total === true
  }

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
      sort: params.sort,
      cacheKey: cacheKeyIdentity.key,
    })

    const total = this.collectionListTotal(params.collection)
      ? await this.readModelStore.count(params.collection, cacheKeyIdentity.key)
      : undefined

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
      map((e): CollectionSignal => {
        // Flatten the per-op buckets back into a single `ids` array for the
        // coarse signal. Consumers that need op-kind discrimination read
        // `readmodel:updated` directly; `watchCollection` is the legacy
        // "something changed in this collection, re-fetch" pathway.
        const ids: string[] = []
        if (e.data.created) ids.push(...e.data.created)
        if (e.data.updated) ids.push(...e.data.updated)
        if (e.data.deleted) ids.push(...e.data.deleted)
        return { type: 'updated', ids, commandIds: e.data.commandIds }
      }),
    )
    const seedCompleted$ = this.eventBus.on('sync:seed-completed').pipe(
      filter((e) => e.data.collection === collection),
      map((e): CollectionSignal => ({ type: 'seed-completed', recordCount: e.data.recordCount })),
    )
    const syncFailed$ = this.eventBus.on('sync:failed').pipe(
      filter((e) => e.data.collection === collection),
      map((e): CollectionSignal => ({ type: 'sync-failed', error: e.data.error })),
    )
    // Session-reset projection — replaces the previously synthesized
    // empty-ids `readmodel:updated` that SyncManager fired after session
    // wipe. Collection name is constant; the signal is per-watch.
    const sessionReset$ = this.eventBus
      .on('session:destroyed')
      .pipe(map((): CollectionSignal => ({ type: 'session-reset' })))
    return merge(updated$, seedCompleted$, syncFailed$, sessionReset$).pipe(
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
  watchById<T>(params: GetByIdParams<TLink>): Observable<T | undefined> {
    const targetId = entityIdToString(params.id)
    return this.eventBus.on('readmodel:updated').pipe(
      filter(
        (event) =>
          event.data.collection === params.collection &&
          (event.data.created?.includes(targetId) === true ||
            event.data.updated?.includes(targetId) === true ||
            event.data.deleted?.includes(targetId) === true),
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
   * Execute a registered cross-collection view by name.
   *
   * Resolves the view's declared cache keys to identities (does not hold —
   * V1 assume-ambient), dispatches to the appropriate implementation via
   * the configured {@link ViewExecutor}, and packages the result.
   *
   * Throws when no executor is configured (no `views` in CqrsConfig) or
   * the view name is unknown.
   */
  async getView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Promise<PagedViewResult<TLink, T>> {
    if (!this.viewExecutor) {
      throw new Error(
        `getView('${params.view}') called but no views are registered. Add a 'views' array to CqrsConfig.`,
      )
    }
    const view = this.viewExecutor.get(params.view)
    if (!view) {
      throw new Error(`Unknown view: '${params.view}'`)
    }

    // Resolve declared cache keys to identities. V1: assume ambient — touch
    // (lastAccessedAt) but do not hold. The consumer's UI is responsible for
    // having acquired and held these keys before getView is called.
    const templates = view.cacheKeys(params.params)
    const identities: CacheKeyIdentity<TLink>[] = []
    for (const template of templates as readonly CacheKeyTemplate<TLink>[]) {
      const identity = await this.cacheManager.registerCacheKey(template, { hold: false })
      identities.push(identity)
    }

    const { rows, total } = await this.viewExecutor.execute(params.view, params.params, params.page)
    return {
      data: rows as T[],
      cacheKeys: identities,
      ...(total !== undefined ? { total } : {}),
    }
  }

  /**
   * Paged-subscription observable over a single collection.
   *
   * See {@link IQueryManager.watchList} for the gate semantics. V1 implementation:
   *
   * - Runs an initial `list` on subscribe and emits the result.
   * - Listens to `readmodel:updated`, `sync:seed-completed`, `session:destroyed`,
   *   and `cache:evicted` events, applies the three gates per event, re-runs and
   *   emits when a gate fires.
   * - Last-write-wins: concurrent in-flight re-runs are versioned; stale results
   *   are dropped.
   *
   * Hold lifecycle stays consumer-managed — pass `hold: true` on the initial
   * params if you want the cache key pinned for the duration; release it when
   * you unsubscribe.
   */
  watchList<T>(params: ListParams<TLink>): Observable<ListQueryResult<TLink, T>> {
    return new RxObservable<ListQueryResult<TLink, T>>((subscriber) => {
      const liveTotal = this.collectionListTotal(params.collection)
      let cancelled = false
      let dataVersion = 0
      let countVersion = 0
      let pageIds: string[] = []
      let resolvedCacheKey: string | undefined
      let lastResult: ListQueryResult<TLink, T> | undefined

      // Full data re-fetch — runs `list()`, which already returns total
      // when the collection opts into it. Updates pageIds and resolvedCacheKey.
      const runData = async (): Promise<void> => {
        const myVersion = ++dataVersion
        try {
          const result = await this.list<T>(params)
          if (cancelled || myVersion !== dataVersion) return
          resolvedCacheKey = result.cacheKey.key
          pageIds = result.meta.map((m) => m.id)
          lastResult = result
          subscriber.next(result)
        } catch (err) {
          if (!cancelled && myVersion === dataVersion) subscriber.error(err)
        }
      }

      // Count-only re-fetch — re-runs the count primitive and emits the
      // previous data with the new total. Only meaningful when the
      // collection opts into live totals.
      const runCount = async (): Promise<void> => {
        if (!liveTotal) return
        if (resolvedCacheKey === undefined || lastResult === undefined) return
        const myVersion = ++countVersion
        try {
          const total = await this.readModelStore.count(params.collection, resolvedCacheKey)
          if (cancelled || myVersion !== countVersion) return
          const next: ListQueryResult<TLink, T> = { ...lastResult, total }
          lastResult = next
          subscriber.next(next)
        } catch (err) {
          if (!cancelled && myVersion === countVersion) subscriber.error(err)
        }
      }

      void runData()

      const updatedSub = this.eventBus.on('readmodel:updated').subscribe((event) => {
        if (cancelled) return
        if (event.data.collection !== params.collection) return
        if (resolvedCacheKey === undefined) return

        // Data re-fetch — fires when any event id is currently on the page.
        // Cache-key attribution doesn't matter: the row IS what's rendered.
        const hitsTracked =
          eventIdInSet(event.data.created, pageIds) ||
          eventIdInSet(event.data.updated, pageIds) ||
          eventIdInSet(event.data.deleted, pageIds)
        if (hitsTracked) {
          void runData()
          return
        }

        // Count-only re-fetch — fires when the event touches the watched
        // cache key with a create or delete (the only ops that can move the
        // count) and the collection opts into live totals. Pure updates and
        // events in unwatched keys are dropped without a re-fetch.
        if (!liveTotal) return
        const hasCreateOrDelete =
          (event.data.created?.length ?? 0) > 0 || (event.data.deleted?.length ?? 0) > 0
        if (!hasCreateOrDelete) return
        if (!event.data.cacheKeys.includes(resolvedCacheKey)) return
        void runCount()
      })

      const seedSub = this.eventBus.on('sync:seed-completed').subscribe((event) => {
        if (cancelled) return
        if (event.data.collection !== params.collection) return
        void runData()
      })

      const sessionSub = this.eventBus.on('session:destroyed').subscribe(() => {
        if (cancelled) return
        pageIds = []
        resolvedCacheKey = undefined
        lastResult = undefined
        void runData()
      })

      const evictedSub = this.eventBus.on('cache:evicted').subscribe((event) => {
        if (cancelled) return
        if (resolvedCacheKey === undefined) return
        if (event.data.cacheKey.key !== resolvedCacheKey) return
        pageIds = []
        lastResult = undefined
        void runData()
      })

      return () => {
        cancelled = true
        updatedSub.unsubscribe()
        seedSub.unsubscribe()
        sessionSub.unsubscribe()
        evictedSub.unsubscribe()
      }
    }).pipe(takeUntil(this.destroy$))
  }

  /**
   * Paged-subscription observable over a registered view.
   *
   * Reuses the three-gate engine from {@link watchList} extended with the
   * primary-source vs join-source distinction declared on the view
   * registration. Per-emission state:
   *
   * - `watchedCacheKeys` — resolved key set from `view.cacheKeys(params)`.
   * - `pageIds` — primary-source ids; read from each emitted row's `id`.
   * - `embedIds[collection]` — FK values extracted from each row via the
   *   corresponding `joinSources[i].fromPath`, used for join-source row
   *   updates.
   *
   * The view registration must be configured at construction time; throws
   * on the underlying observable when no executor is wired or the view name
   * is unknown.
   */
  watchView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Observable<PagedViewResult<TLink, T>> {
    return new RxObservable<PagedViewResult<TLink, T>>((subscriber) => {
      if (!this.viewExecutor) {
        subscriber.error(
          new Error(
            `watchView('${params.view}') called but no views are registered. Add a 'views' array to CqrsConfig.`,
          ),
        )
        return
      }
      const view = this.viewExecutor.get(params.view)
      if (!view) {
        subscriber.error(new Error(`Unknown view: '${params.view}'`))
        return
      }

      const primarySource = view.primarySource
      const joinSources = view.joinSources
      const sourceCollections = new Set<string>([
        primarySource,
        ...joinSources.map((j) => j.collection),
      ])
      const hasCount =
        typeof view.memoryCount === 'function' || typeof view.sql?.count === 'function'

      let cancelled = false
      let dataVersion = 0
      let countVersion = 0
      let pageIds: string[] = []
      let embedIds: Map<string, Set<string>> = new Map()
      let watchedCacheKeys: Set<string> = new Set()
      let lastResult: PagedViewResult<TLink, T> | undefined

      // Full data re-fetch via `getView`. Captures fresh pageIds, embedIds,
      // watchedCacheKeys, and total (when the view supplies count callbacks).
      const runData = async (): Promise<void> => {
        const myVersion = ++dataVersion
        try {
          const result = await this.getView<T, TParams>(params)
          if (cancelled || myVersion !== dataVersion) return

          watchedCacheKeys = new Set(result.cacheKeys.map((k) => k.key))
          pageIds = []
          for (const row of result.data) {
            const id = (row as { id?: unknown }).id
            if (typeof id === 'string') pageIds.push(id)
          }
          embedIds = new Map()
          for (const join of joinSources) {
            const set = new Set<string>()
            for (const row of result.data) {
              const value = getAtPath(row, join.fromPath)
              if (typeof value === 'string') set.add(value)
            }
            embedIds.set(join.collection, set)
          }
          lastResult = result
          subscriber.next(result)
        } catch (err) {
          if (!cancelled && myVersion === dataVersion) subscriber.error(err)
        }
      }

      // Count-only re-fetch. Re-executes the view (which runs both data
      // and count) but only emits the previous data with the new total —
      // the data may have changed underneath but off-page changes aren't
      // supposed to shift the visible rows. (A future refinement could run
      // the count callback in isolation; the executor doesn't expose that
      // surface yet, so we re-execute and project the total only.)
      const runCount = async (): Promise<void> => {
        if (!hasCount || lastResult === undefined) return
        const myVersion = ++countVersion
        try {
          const result = await this.getView<T, TParams>(params)
          if (cancelled || myVersion !== countVersion) return
          if (result.total === undefined) return
          const next: PagedViewResult<TLink, T> = { ...lastResult, total: result.total }
          lastResult = next
          subscriber.next(next)
        } catch (err) {
          if (!cancelled && myVersion === countVersion) subscriber.error(err)
        }
      }

      void runData()

      const updatedSub = this.eventBus.on('readmodel:updated').subscribe((event) => {
        if (cancelled) return
        if (!sourceCollections.has(event.data.collection)) return

        // Data re-fetch — any event id in this collection's tracked set.
        // pageIds for the primary source; embedIds[collection] for joins.
        const trackedSet =
          event.data.collection === primarySource
            ? pageIds
            : (embedIds.get(event.data.collection) ?? new Set<string>())
        const hitsTracked =
          eventIdInSet(event.data.created, trackedSet) ||
          eventIdInSet(event.data.updated, trackedSet) ||
          eventIdInSet(event.data.deleted, trackedSet)
        if (hitsTracked) {
          void runData()
          return
        }

        // Count-only re-fetch — fires when the event touches a watched
        // cache key with a create or delete (the only ops that can move
        // the count) and the view declares a count callback.
        if (!hasCount) return
        const hasCreateOrDelete =
          (event.data.created?.length ?? 0) > 0 || (event.data.deleted?.length ?? 0) > 0
        if (!hasCreateOrDelete) return
        if (!event.data.cacheKeys.some((k) => watchedCacheKeys.has(k))) return
        void runCount()
      })

      const seedSub = this.eventBus.on('sync:seed-completed').subscribe((event) => {
        if (cancelled) return
        if (!sourceCollections.has(event.data.collection)) return
        void runData()
      })

      const sessionSub = this.eventBus.on('session:destroyed').subscribe(() => {
        if (cancelled) return
        pageIds = []
        embedIds = new Map()
        watchedCacheKeys = new Set()
        lastResult = undefined
        void runData()
      })

      const evictedSub = this.eventBus.on('cache:evicted').subscribe((event) => {
        if (cancelled) return
        if (!watchedCacheKeys.has(event.data.cacheKey.key)) return
        pageIds = []
        embedIds = new Map()
        lastResult = undefined
        void runData()
      })

      return () => {
        cancelled = true
        updatedSub.unsubscribe()
        seedSub.unsubscribe()
        sessionSub.unsubscribe()
        evictedSub.unsubscribe()
      }
    }).pipe(takeUntil(this.destroy$))
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
