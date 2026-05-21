/**
 * QueryManager proxy — implements IQueryManager on the main thread.
 *
 * Read methods use RPC. watchCollection/watchById use broadcast events.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
import {
  Observable,
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
      { ...params, windowId: this.windowId },
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
    return new Observable<ListQueryResult<TLink, T>>((subscriber) => {
      const liveTotal = this.collectionListTotal(params.collection)
      let cancelled = false
      let dataVersion = 0
      let countVersion = 0
      let pageIds: string[] = []
      let resolvedCacheKey: string | undefined
      let lastResult: ListQueryResult<TLink, T> | undefined

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

      // Count-only re-fetch through the proxy: re-runs `list` (which
      // computes total when the collection opts in), keeps the previous
      // data, projects the new total into the emission. The proxy doesn't
      // have a count RPC of its own, so the cost is one extra list query
      // — the data fetch dominates anyway and SQLite resolves both via
      // indexed reads.
      const runCount = async (): Promise<void> => {
        if (!liveTotal || lastResult === undefined) return
        const myVersion = ++countVersion
        try {
          const result = await this.list<T>(params)
          if (cancelled || myVersion !== countVersion) return
          if (result.total === undefined) return
          const next: ListQueryResult<TLink, T> = { ...lastResult, total: result.total }
          lastResult = next
          subscriber.next(next)
        } catch (err) {
          if (!cancelled && myVersion === countVersion) subscriber.error(err)
        }
      }

      void runData()

      const updatedSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'readmodel:updated'))
        .subscribe((event) => {
          if (cancelled) return
          const data = event.data as {
            collection: string
            created?: string[]
            updated?: string[]
            deleted?: string[]
            cacheKeys: string[]
          }
          if (data.collection !== params.collection) return
          if (resolvedCacheKey === undefined) return

          const hitsTracked =
            anyMatch(data.created, pageIds) ||
            anyMatch(data.updated, pageIds) ||
            anyMatch(data.deleted, pageIds)
          if (hitsTracked) {
            void runData()
            return
          }

          if (!liveTotal) return
          const hasCreateOrDelete =
            (data.created?.length ?? 0) > 0 || (data.deleted?.length ?? 0) > 0
          if (!hasCreateOrDelete) return
          if (!data.cacheKeys.includes(resolvedCacheKey)) return
          void runCount()
        })

      const seedSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'sync:seed-completed'))
        .subscribe((event) => {
          if (cancelled) return
          const data = event.data as { collection: string }
          if (data.collection !== params.collection) return
          void runData()
        })

      const sessionSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'session:destroyed'))
        .subscribe(() => {
          if (cancelled) return
          pageIds = []
          resolvedCacheKey = undefined
          lastResult = undefined
          void runData()
        })

      const evictedSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'cache:evicted'))
        .subscribe((event) => {
          if (cancelled) return
          if (resolvedCacheKey === undefined) return
          const data = event.data as { cacheKey: { key: string } }
          if (data.cacheKey.key !== resolvedCacheKey) return
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
   * Paged-subscription observable over a registered view. Mirrors the inner
   * {@link QueryManager.watchView} engine on the main thread: view metadata
   * (primary/join sources) is read from {@link viewsByName}; result rows
   * are fetched via RPC `getView`; gates run locally against broadcast
   * events.
   */
  watchView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Observable<PagedViewResult<TLink, T>> {
    return new Observable<PagedViewResult<TLink, T>>((subscriber) => {
      const view = this.viewsByName.get(params.view)
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

      const updatedSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'readmodel:updated'))
        .subscribe((event) => {
          if (cancelled) return
          const data = event.data as {
            collection: string
            created?: string[]
            updated?: string[]
            deleted?: string[]
            cacheKeys: string[]
          }
          if (!sourceCollections.has(data.collection)) return

          const trackedSet =
            data.collection === primarySource
              ? pageIds
              : (embedIds.get(data.collection) ?? new Set<string>())
          const hitsTracked =
            anyMatch(data.created, trackedSet) ||
            anyMatch(data.updated, trackedSet) ||
            anyMatch(data.deleted, trackedSet)
          if (hitsTracked) {
            void runData()
            return
          }

          if (!hasCount) return
          const hasCreateOrDelete =
            (data.created?.length ?? 0) > 0 || (data.deleted?.length ?? 0) > 0
          if (!hasCreateOrDelete) return
          if (!data.cacheKeys.some((k) => watchedCacheKeys.has(k))) return
          void runCount()
        })

      const seedSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'sync:seed-completed'))
        .subscribe((event) => {
          if (cancelled) return
          const data = event.data as { collection: string }
          if (!sourceCollections.has(data.collection)) return
          void runData()
        })

      const sessionSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'session:destroyed'))
        .subscribe(() => {
          if (cancelled) return
          pageIds = []
          embedIds = new Map()
          watchedCacheKeys = new Set()
          lastResult = undefined
          void runData()
        })

      const evictedSub = this.broadcastEvents$
        .pipe(filter((event) => event.eventName === 'cache:evicted'))
        .subscribe((event) => {
          if (cancelled) return
          const data = event.data as { cacheKey: { key: string } }
          if (!watchedCacheKeys.has(data.cacheKey.key)) return
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
