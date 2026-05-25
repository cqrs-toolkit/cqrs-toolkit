/**
 * QueryManager proxy — implements IQueryManager on the main thread.
 *
 * Read methods use RPC. watchCollection/watchById use broadcast events.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
import {
  BehaviorSubject,
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
import type { CacheKeyIdentity } from '../../core/cache-manager/CacheKey.js'
import { getAtPath } from '../../core/entity-ref/ref-path.js'
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  GetViewParams,
  IQueryManager,
  ListParams,
  ListQueryResult,
  PagedViewResult,
  QueryResult,
} from '../../core/query-manager/types.js'
import type { AnyViewRegistration } from '../../core/views/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { Collection } from '../../types/config.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'

/**
 * Main-thread proxy for the worker-side QueryManager.
 *
 * View metadata (primary/join sources) for `watchView`'s gate logic is
 * provided at construction time via `views` — these are the same view
 * registrations the worker has, loaded from the shared `CqrsConfig.views`
 * module on the main thread. The proxy reads them locally to drive gates
 * and RPCs to the worker for actual execution.
 */
/**
 * True when any string in `ids` is also in `tracked`. Helper for the
 * tracked-id branch of the watchList / watchView gates.
 */
function anyMatch(
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
 * Substitute a {@link ListFilter}'s callbacks with a structured-cloneable
 * {@link PreEvaluatedListFilter} before crossing the worker boundary.
 * Closures aren't transferable; we resolve the SQL fragment on the main
 * thread (sync, pure) and drop the memory predicate (the worker only
 * runs SQL storage).
 *
 * Idempotent: a filter already in pre-evaluated form is returned as-is.
 */
function preEvaluateListFilter<TLink extends Link>(params: ListParams<TLink>): ListParams<TLink> {
  const f = params.filter
  if (f === undefined) return params
  if ('sqlFragment' in f) return params
  return {
    ...params,
    filter: { sqlFragment: f.sql(f.params) },
  }
}

export class QueryManagerProxy<TLink extends Link> implements IQueryManager<TLink> {
  private readonly destroy$ = new Subject<void>()
  private readonly viewsByName: ReadonlyMap<string, AnyViewRegistration<TLink>>
  private readonly collectionsByName: ReadonlyMap<string, Collection<TLink>>

  constructor(
    private readonly channel: WorkerMessageChannel,
    private readonly broadcastEvents$: Observable<EventMessage>,
    private readonly windowId: string,
    views: readonly AnyViewRegistration<TLink>[] = [],
    collections: readonly Collection<TLink>[] = [],
  ) {
    const viewMap = new Map<string, AnyViewRegistration<TLink>>()
    for (const view of views) viewMap.set(view.name, view)
    this.viewsByName = viewMap

    const collectionMap = new Map<string, Collection<TLink>>()
    for (const c of collections) collectionMap.set(c.name, c)
    this.collectionsByName = collectionMap
  }

  private collectionListTotal(name: string): boolean {
    return this.collectionsByName.get(name)?.list?.total === true
  }

  async getById<T>(params: GetByIdParams<TLink>): Promise<QueryResult<TLink, T>> {
    return this.channel.request<QueryResult<TLink, T>>('queryManager.getById', [
      { ...params, windowId: this.windowId },
    ])
  }

  async getByIds<T>(params: GetByIdsParams<TLink>): Promise<Map<string, QueryResult<TLink, T>>> {
    return this.channel.request<Map<string, QueryResult<TLink, T>>>('queryManager.getByIds', [
      { ...params, windowId: this.windowId },
    ])
  }

  async list<T>(params: ListParams<TLink>): Promise<ListQueryResult<TLink, T>> {
    return this.channel.request<ListQueryResult<TLink, T>>('queryManager.list', [
      { ...preEvaluateListFilter(params), windowId: this.windowId },
    ])
  }

  async getView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Promise<PagedViewResult<TLink, T>> {
    return this.channel.request<PagedViewResult<TLink, T>>('queryManager.getView', [params])
  }

  watchCollection(collection: string): Observable<CollectionSignal> {
    const updated$ = this.broadcastEvents$.pipe(
      filter(
        (event) =>
          event.eventName === 'readmodel:updated' &&
          (event.data as { collection: string }).collection === collection,
      ),
      map((event): CollectionSignal => {
        const data = event.data as {
          created?: string[]
          updated?: string[]
          deleted?: string[]
          commandIds: string[]
        }
        const ids: string[] = []
        if (data.created) ids.push(...data.created)
        if (data.updated) ids.push(...data.updated)
        if (data.deleted) ids.push(...data.deleted)
        return {
          type: 'updated',
          ids,
          commandIds: data.commandIds,
        }
      }),
    )
    const seedCompleted$ = this.broadcastEvents$.pipe(
      filter(
        (event) =>
          event.eventName === 'sync:seed-completed' &&
          (event.data as { collection: string }).collection === collection,
      ),
      map(
        (event): CollectionSignal => ({
          type: 'seed-completed',
          recordCount: (event.data as { recordCount: number }).recordCount,
        }),
      ),
    )
    const syncFailed$ = this.broadcastEvents$.pipe(
      filter(
        (event) =>
          event.eventName === 'sync:failed' &&
          (event.data as { collection: string }).collection === collection,
      ),
      map(
        (event): CollectionSignal => ({
          type: 'sync-failed',
          error: (event.data as { error: string }).error,
        }),
      ),
    )
    const sessionReset$ = this.broadcastEvents$.pipe(
      filter((event) => event.eventName === 'session:destroyed'),
      map((): CollectionSignal => ({ type: 'session-reset' })),
    )
    return merge(updated$, seedCompleted$, syncFailed$, sessionReset$).pipe(
      takeUntil(this.destroy$),
    )
  }

  watchById<T>(params: GetByIdParams<TLink>): Observable<T | undefined> {
    const { collection, id } = params
    return this.watchCollection(collection).pipe(
      filter((signal) => signal.type === 'updated' && signal.ids.includes(entityIdToString(id))),
      startWith(undefined),
      switchMap(() =>
        from(this.getById<T>(params)).pipe(
          map((result) => result.data),
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
   * Paged-subscription observable. Mirrors the inner
   * {@link QueryManager.watchList} implementation across the worker boundary:
   * runs `list` via RPC, listens to broadcast events for gate checks, re-runs
   * via RPC on gate hits. Each window's proxy maintains its own subscription
   * state independently.
   */
  watchList<T>(params: ListParams<TLink>): Observable<ListQueryResult<TLink, T>> {
    return defer(() => {
      const liveTotal = this.collectionListTotal(params.collection)

      type ListState = {
        pageIds: string[]
        resolvedCacheKey: string | undefined
        lastResult: ListQueryResult<TLink, T> | undefined
      }

      const emptyState = (): ListState => ({
        pageIds: [],
        resolvedCacheKey: undefined,
        lastResult: undefined,
      })

      // Per-subscription state. switchMap below cancels in-flight RPCs; this
      // subject only carries post-result state the event gates consult.
      const state$ = new BehaviorSubject<ListState>(emptyState())

      const deriveState = (result: ListQueryResult<TLink, T>): ListState => ({
        pageIds: result.meta.map((m) => m.id),
        resolvedCacheKey: result.cacheKey.key,
        lastResult: result,
      })

      type Trigger = 'data' | 'count'

      const initial$ = of<Trigger>('data')

      const seed$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'sync:seed-completed'),
        filter((event) => (event.data as { collection: string }).collection === params.collection),
        map<unknown, Trigger>(() => 'data'),
      )

      const session$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'session:destroyed'),
        tap(() => state$.next(emptyState())),
        map<unknown, Trigger>(() => 'data'),
      )

      // cache:evicted preserves resolvedCacheKey; the next data fetch
      // repopulates it. Events arriving in the interim still match the
      // previously-resolved key.
      const evicted$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'cache:evicted'),
        filter((event) => {
          const s = state$.value
          if (s.resolvedCacheKey === undefined) return false
          const data = event.data as { cacheKey: { key: string } }
          return data.cacheKey.key === s.resolvedCacheKey
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

      const updated$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'readmodel:updated'),
        map((event): Trigger | undefined => {
          const data = event.data as {
            collection: string
            created?: string[]
            updated?: string[]
            deleted?: string[]
            cacheKeys: string[]
          }
          if (data.collection !== params.collection) return undefined
          const s = state$.value
          if (s.resolvedCacheKey === undefined) return undefined

          if (
            anyMatch(data.created, s.pageIds) ||
            anyMatch(data.updated, s.pageIds) ||
            anyMatch(data.deleted, s.pageIds)
          ) {
            return 'data'
          }

          if (!liveTotal) return undefined
          const hasCreateOrDelete =
            (data.created?.length ?? 0) > 0 || (data.deleted?.length ?? 0) > 0
          if (!hasCreateOrDelete) return undefined
          if (!data.cacheKeys.includes(s.resolvedCacheKey)) return undefined
          return 'count'
        }),
        filter((t): t is Trigger => t !== undefined),
      )

      return merge(initial$, seed$, session$, evicted$, updated$).pipe(
        switchMap((trigger) =>
          from(this.list<T>(params)).pipe(
            map((result): ListQueryResult<TLink, T> | undefined => {
              if (trigger === 'count') {
                const last = state$.value.lastResult
                if (last === undefined || result.total === undefined) return undefined
                return { ...last, total: result.total }
              }
              return result
            }),
            filter((r): r is ListQueryResult<TLink, T> => r !== undefined),
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
   * Paged-subscription observable over a registered view. Mirrors the inner
   * {@link QueryManager.watchView} engine on the main thread: view metadata
   * (primary/join sources) is read from {@link viewsByName}; result rows
   * are fetched via RPC `getView`; gates run locally against broadcast
   * events.
   */
  watchView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Observable<PagedViewResult<TLink, T>> {
    return defer(() => {
      const view = this.viewsByName.get(params.view)
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

      type ViewState = {
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
            const value = getAtPath(row, join.referencedIdPath)
            if (typeof value === 'string') referencedSet.add(value)
          }
          referencedIds.set(join.collection, referencedSet)

          if (join.referencingIdPath !== undefined) {
            const referencingSet = new Set<string>()
            for (const row of result.data) {
              const value = getAtPath(row, join.referencingIdPath)
              if (typeof value === 'string') referencingSet.add(value)
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

      const seed$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'sync:seed-completed'),
        filter((event) => sourceCollections.has((event.data as { collection: string }).collection)),
        map<unknown, Trigger>(() => 'data'),
      )

      const session$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'session:destroyed'),
        tap(() => state$.next(emptyState())),
        map<unknown, Trigger>(() => 'data'),
      )

      // cache:evicted preserves watchedCacheKeys. The next data fetch
      // repopulates the set; events arriving in the interim still match.
      const evicted$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'cache:evicted'),
        filter((event) => {
          const data = event.data as { cacheKey: { key: string } }
          return state$.value.watchedCacheKeys.has(data.cacheKey.key)
        }),
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

      const updated$ = this.broadcastEvents$.pipe(
        filter((event) => event.eventName === 'readmodel:updated'),
        map((event): Trigger | undefined => {
          const data = event.data as {
            collection: string
            created?: string[]
            updated?: string[]
            deleted?: string[]
            cacheKeys: string[]
          }
          if (!sourceCollections.has(data.collection)) return undefined
          const s = state$.value

          const trackedSet =
            data.collection === primarySource
              ? s.pageIds
              : (s.referencedIds.get(data.collection) ?? new Set<string>())
          if (
            anyMatch(data.created, trackedSet) ||
            anyMatch(data.updated, trackedSet) ||
            anyMatch(data.deleted, trackedSet)
          ) {
            return 'data'
          }

          if (data.collection !== primarySource) {
            const referencingSet = s.referencingIds.get(data.collection)
            if (referencingSet && referencingSet.size > 0) {
              if (
                anyMatch(data.created, referencingSet) ||
                anyMatch(data.updated, referencingSet)
              ) {
                return 'data'
              }
            }
          }

          if (!hasCount) return undefined
          const hasCreateOrDelete =
            (data.created?.length ?? 0) > 0 || (data.deleted?.length ?? 0) > 0
          if (!hasCreateOrDelete) return undefined
          if (!data.cacheKeys.some((k) => s.watchedCacheKeys.has(k))) return undefined
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

  async getLocallyById<T>(collection: string, id: EntityId): Promise<T | undefined> {
    return this.channel.request<T | undefined>('queryManager.getLocallyById', [collection, id])
  }

  async exists(collection: string, id: EntityId): Promise<boolean> {
    return this.channel.request<boolean>('queryManager.exists', [collection, id])
  }

  async count(collection: string): Promise<number> {
    return this.channel.request<number>('queryManager.count', [collection])
  }

  async touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    return this.channel.request<void>('queryManager.touch', [cacheKey])
  }

  async hold(cacheKey: string): Promise<void> {
    return this.channel.request<void>('queryManager.holdForWindow', [cacheKey, this.windowId])
  }

  async release(cacheKey: string): Promise<void> {
    return this.channel.request<void>('queryManager.releaseForWindow', [cacheKey, this.windowId])
  }

  async releaseAll(): Promise<void> {
    return this.channel.request<void>('queryManager.releaseAllForWindow', [this.windowId])
  }

  async destroy(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()
  }
}
