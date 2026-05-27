/**
 * Query manager provides read-only access to cached data.
 *
 * This is the primary interface for consumers to query read models.
 * It wraps the ReadModelStore with cache key management.
 */

import { assert } from '#utils'
import { type Link, logProvider } from '@meticoeus/ddd-es'
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  of,
  startWith,
  switchMap,
  takeUntil,
  tap,
  throwError,
} from 'rxjs'
import type { IStorageListFilter, ReadModelRecord } from '../../storage/IStorage.js'
import type { Collection } from '../../types/config.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'
import { EnqueueCommand } from '../../types/index.js'
import type { CacheKeyIdentity, CacheKeyTemplate } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import { getValuesAtPath } from '../entity-ref/ref-path.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/index.js'
import type { ViewExecutor } from '../views/ViewExecutor.js'
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  GetViewParams,
  IQueryManagerInternal,
  ListFilter,
  ListParams,
  ListQueryResult,
  PagedViewResult,
  PreEvaluatedListFilter,
  QueryResult,
  Sort,
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
   * Resolve the effective sort for a list call: the per-call override
   * if set, otherwise the collection's `list.defaultSort`, otherwise
   * undefined (storage natural order).
   */
  private resolveSort(name: string, override: Sort | undefined): Sort | undefined {
    if (override !== undefined) return override
    return this.collectionsByName.get(name)?.list?.defaultSort
  }

  /**
   * Resolve a {@link ListFilter} or {@link PreEvaluatedListFilter} into
   * the storage-shape filter the read-model store consumes. The user's
   * `memory(row, params)` is wrapped to operate on `ReadModelRecord`
   * (parse effectiveData once per row); the user's `sql(params)` is
   * invoked exactly once and the result captured as the SQL fragment.
   *
   * On the worker side, the proxy has already substituted the SQL
   * callback for a pre-evaluated fragment; we pass it through.
   */
  private resolveListFilter(
    filter: ListFilter | PreEvaluatedListFilter | undefined,
  ): IStorageListFilter | undefined {
    if (filter === undefined) return undefined
    if ('sqlFragment' in filter) return { sqlFragment: filter.sqlFragment }
    const userFilter = filter
    const predicate = (record: ReadModelRecord): boolean => {
      const data = JSON.parse(record.effectiveData) as unknown
      return userFilter.memory(data, userFilter.params)
    }
    return {
      predicate,
      sqlFragment: userFilter.sql(userFilter.params),
    }
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

    const storageFilter = this.resolveListFilter(params.filter)
    const sort = this.resolveSort(params.collection, params.sort)

    const models = await this.readModelStore.list<T>(params.collection, {
      limit: params.limit,
      offset: params.offset,
      sort,
      cacheKey: cacheKeyIdentity.key,
      filter: storageFilter,
    })

    // Total respects the same filter as the page result — list UIs that
    // show "showing X of Y" need the filtered count, not the raw cache-
    // key-scoped count.
    const total = this.collectionListTotal(params.collection)
      ? await this.readModelStore.count(params.collection, cacheKeyIdentity.key, storageFilter)
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
        // coarse "something changed in this collection, re-fetch" signal.
        // Consumers that need op-kind discrimination subscribe to
        // `readmodel:updated` directly.
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
    // Project session destruction as a session-reset signal so subscribers
    // can clear per-collection state without a separate session subscription.
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

    // Resolve declared cache keys to identities. `getView` is a one-shot
    // pull and is hold-agnostic — touch (lastAccessedAt) so any
    // pre-existing holds don't age out, but don't pin anything ourselves.
    // The subscription-style entry point (createViewQuery → watchView)
    // holds the resulting identities for the subscription's lifetime;
    // consumers calling `getView` directly own whatever lifecycle they want
    // around the read.
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
    return defer(() => {
      const liveTotal = this.collectionListTotal(params.collection)
      // Resolve the user filter once per subscription. The SQL fragment
      // and the wrapped predicate are reused across data and count
      // re-fetches so the user's `sql` callback isn't invoked twice per
      // re-fetch and the predicate closure is shared.
      const storageFilter = this.resolveListFilter(params.filter)

      interface ListState {
        pageIds: string[]
        resolvedCacheKey: string | undefined
        lastResult: ListQueryResult<TLink, T> | undefined
      }

      const emptyState = (): ListState => ({
        pageIds: [],
        resolvedCacheKey: undefined,
        lastResult: undefined,
      })

      // Per-subscription state. switchMap below handles in-flight cancellation;
      // this subject only carries post-result state the event gates consult.
      const state$ = new BehaviorSubject<ListState>(emptyState())

      const deriveState = (result: ListQueryResult<TLink, T>): ListState => ({
        pageIds: result.meta.map((m) => m.id),
        resolvedCacheKey: result.cacheKey.key,
        lastResult: result,
      })

      type Trigger = 'data' | 'count'

      const initial$ = of<Trigger>('data')

      const seed$ = this.eventBus.on('sync:seed-completed').pipe(
        filter((event) => event.data.collection === params.collection),
        map<unknown, Trigger>(() => 'data'),
      )

      // session:destroyed fires for any collection — unconditional reset.
      const session$ = this.eventBus.on('session:destroyed').pipe(
        tap(() => state$.next(emptyState())),
        map<unknown, Trigger>(() => 'data'),
      )

      // cache:evicted preserves resolvedCacheKey; the next data fetch
      // repopulates it. Events arriving in the interim still match the
      // resolved key.
      const evicted$ = this.eventBus.on('cache:evicted').pipe(
        filter((event) => {
          const s = state$.value
          if (s.resolvedCacheKey === undefined) return false
          return event.data.cacheKey.key === s.resolvedCacheKey
        }),
        tap(() => {
          const s = state$.value
          state$.next({
            pageIds: [],
            resolvedCacheKey: s.resolvedCacheKey,
            lastResult: undefined,
          })
        }),
        map<unknown, Trigger>(() => 'data'),
      )

      const updated$ = this.eventBus.on('readmodel:updated').pipe(
        filter((event) => event.data.collection === params.collection),
        map((event): Trigger | undefined => {
          const s = state$.value
          if (s.resolvedCacheKey === undefined) return undefined

          // Data re-fetch — any event id is currently on the page.
          // Cache-key attribution doesn't matter: the row IS what's rendered.
          if (
            eventIdInSet(event.data.created, s.pageIds) ||
            eventIdInSet(event.data.updated, s.pageIds) ||
            eventIdInSet(event.data.deleted, s.pageIds)
          ) {
            return 'data'
          }

          // Count-only re-fetch — event touches the watched cache key with
          // a create or delete (the only ops that can move the count) and
          // the collection opts into live totals.
          if (!liveTotal) return undefined
          const hasCreateOrDelete =
            (event.data.created?.length ?? 0) > 0 || (event.data.deleted?.length ?? 0) > 0
          if (!hasCreateOrDelete) return undefined
          if (!event.data.cacheKeys.includes(s.resolvedCacheKey)) return undefined
          return 'count'
        }),
        filter((t): t is Trigger => t !== undefined),
      )

      return merge(initial$, seed$, session$, evicted$, updated$).pipe(
        switchMap((trigger) => {
          if (trigger === 'count') {
            const cacheKey = state$.value.resolvedCacheKey
            if (!liveTotal || cacheKey === undefined || state$.value.lastResult === undefined) {
              return EMPTY
            }
            return from(this.readModelStore.count(params.collection, cacheKey, storageFilter)).pipe(
              map((total): ListQueryResult<TLink, T> | undefined => {
                const last = state$.value.lastResult
                if (last === undefined) return undefined
                return { ...last, total }
              }),
              filter((r): r is ListQueryResult<TLink, T> => r !== undefined),
              tap((next) => {
                state$.next({ ...state$.value, lastResult: next })
              }),
            )
          }
          return from(this.list<T>(params)).pipe(
            tap((result) => {
              state$.next(deriveState(result))
            }),
          )
        }),
        takeUntil(this.destroy$),
      )
    })
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
   * - `referencedIds[collection]` — FK values extracted from each row via the
   *   corresponding `joinSources[i].referencedIdPath`, used for join-source row
   *   updates.
   *
   * The view registration must be configured at construction time; throws
   * on the underlying observable when no executor is wired or the view name
   * is unknown.
   */
  watchView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Observable<PagedViewResult<TLink, T>> {
    return defer(() => {
      if (!this.viewExecutor) {
        return throwError(
          () =>
            new Error(
              `watchView('${params.view}') called but no views are registered. Add a 'views' array to CqrsConfig.`,
            ),
        )
      }
      const view = this.viewExecutor.get(params.view)
      if (!view) {
        return throwError(() => new Error(`Unknown view: '${params.view}'`))
      }

      const primarySource = view.primarySource
      const joinSources = view.joinSources
      const sourceCollections = new Set<string>([
        primarySource,
        ...joinSources.map((j) => j.collection),
      ])
      const hasCount =
        typeof view.memoryCount === 'function' || typeof view.sql?.count === 'function'

      interface ViewState {
        pageIds: string[]
        referencedIds: Map<string, Set<string>>
        referencingIds: Map<string, Set<string>>
        watchedCacheKeys: Set<string>
        lastResult: PagedViewResult<TLink, T> | undefined
      }

      const emptyState = (): ViewState => ({
        pageIds: [],
        referencedIds: new Map(),
        referencingIds: new Map(),
        watchedCacheKeys: new Set(),
        lastResult: undefined,
      })

      // Per-subscription state. switchMap below handles in-flight cancellation,
      // so no version counters; this subject only carries the post-result state
      // the event gates consult to decide whether to refetch.
      const state$ = new BehaviorSubject<ViewState>(emptyState())

      const deriveState = (result: PagedViewResult<TLink, T>): ViewState => {
        const pageIds: string[] = []
        for (const row of result.data) {
          const id = (row as { id?: unknown }).id
          if (typeof id === 'string') pageIds.push(id)
        }
        const referencedIds = new Map<string, Set<string>>()
        const referencingIds = new Map<string, Set<string>>()
        for (const join of joinSources) {
          const referencedSet = new Set<string>()
          for (const row of result.data) {
            for (const value of getValuesAtPath(row, join.referencedIdPath)) {
              const id = entityIdToString(value as EntityId | undefined)
              if (id !== undefined) referencedSet.add(id)
            }
          }
          referencedIds.set(join.collection, referencedSet)

          if (join.referencingIdPath) {
            const referencingSet = new Set<string>()
            for (const row of result.data) {
              for (const value of getValuesAtPath(row, join.referencingIdPath)) {
                const id = entityIdToString(value as EntityId | undefined)
                if (id !== undefined) referencingSet.add(id)
              }
            }
            const existing = referencingIds.get(join.collection)
            if (existing) {
              for (const id of referencingSet) existing.add(id)
            } else {
              referencingIds.set(join.collection, referencingSet)
            }
          }
        }
        return {
          pageIds,
          referencedIds,
          referencingIds,
          watchedCacheKeys: new Set(result.cacheKeys.map((k) => k.key)),
          lastResult: result,
        }
      }

      type Trigger = 'data' | 'count'

      const initial$ = of<Trigger>('data')

      const seed$ = this.eventBus.on('sync:seed-completed').pipe(
        filter((event) => sourceCollections.has(event.data.collection)),
        map<unknown, Trigger>(() => 'data'),
      )

      // session:destroyed fires for any collection — unconditional reset.
      const session$ = this.eventBus.on('session:destroyed').pipe(
        tap(() => state$.next(emptyState())),
        map<unknown, Trigger>(() => 'data'),
      )

      // cache:evicted preserves watchedCacheKeys (unlike session:destroyed
      // which clears them). The next data fetch repopulates the set;
      // events arriving in the interim still match the watched keys.
      const evicted$ = this.eventBus.on('cache:evicted').pipe(
        filter((event) => state$.value.watchedCacheKeys.has(event.data.cacheKey.key)),
        tap(() => {
          const current = state$.value
          state$.next({
            pageIds: [],
            referencedIds: new Map(),
            referencingIds: new Map(),
            watchedCacheKeys: current.watchedCacheKeys,
            lastResult: undefined,
          })
        }),
        map<unknown, Trigger>(() => 'data'),
      )

      const updated$ = this.eventBus.on('readmodel:updated').pipe(
        filter((event) => sourceCollections.has(event.data.collection)),
        map((event): Trigger | undefined => {
          const s = state$.value

          // Data re-fetch — any event id in this collection's tracked set.
          // pageIds for the primary source; referencedIds[collection] for joins.
          const trackedSet =
            event.data.collection === primarySource
              ? s.pageIds
              : (s.referencedIds.get(event.data.collection) ?? new Set<string>())
          if (
            eventIdInSet(event.data.created, trackedSet) ||
            eventIdInSet(event.data.updated, trackedSet) ||
            eventIdInSet(event.data.deleted, trackedSet)
          ) {
            return 'data'
          }

          // Missing-join re-fetch — fires when a join collection produces a
          // create/update for an id the projection wanted to join on but
          // didn't have at last run (declared via joinSources[].referencingIdPath).
          if (event.data.collection !== primarySource) {
            const referencingSet = s.referencingIds.get(event.data.collection)
            if (referencingSet && referencingSet.size > 0) {
              if (
                eventIdInSet(event.data.created, referencingSet) ||
                eventIdInSet(event.data.updated, referencingSet)
              ) {
                return 'data'
              }
            }
          }

          // Count-only re-fetch — fires when the event touches a watched
          // cache key with a create or delete (the only ops that can move
          // the count) and the view declares a count callback.
          if (!hasCount) return undefined
          const hasCreateOrDelete =
            (event.data.created?.length ?? 0) > 0 || (event.data.deleted?.length ?? 0) > 0
          if (!hasCreateOrDelete) return undefined
          if (!event.data.cacheKeys.some((k) => s.watchedCacheKeys.has(k))) return undefined
          return 'count'
        }),
        filter((t): t is Trigger => t !== undefined),
      )

      return merge(initial$, seed$, session$, evicted$, updated$).pipe(
        switchMap((trigger) =>
          from(this.getView<T, TParams>(params)).pipe(
            map((result): PagedViewResult<TLink, T> | undefined => {
              if (trigger === 'count') {
                const last = state$.value.lastResult
                if (last === undefined || result.total === undefined) return undefined
                return { ...last, total: result.total }
              }
              return result
            }),
            filter((r): r is PagedViewResult<TLink, T> => r !== undefined),
            tap((emission) => {
              if (trigger === 'count') {
                state$.next({ ...state$.value, lastResult: emission })
              } else {
                state$.next(deriveState(emission))
              }
            }),
          ),
        ),
        takeUntil(this.destroy$),
      )
    })
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
