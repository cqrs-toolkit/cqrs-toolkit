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
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  IQueryManager,
  ListParams,
  ListQueryResult,
  QueryResult,
} from '../../core/query-manager/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/entities.js'

/**
 * Main-thread proxy for the worker-side QueryManager.
 */
export class QueryManagerProxy<TLink extends Link> implements IQueryManager<TLink> {
  private readonly destroy$ = new Subject<void>()

  constructor(
    private readonly channel: WorkerMessageChannel,
    private readonly broadcastEvents$: Observable<EventMessage>,
    private readonly windowId: string,
  ) {}

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

  watchCollection(collection: string): Observable<CollectionSignal> {
    const updated$ = this.broadcastEvents$.pipe(
      filter(
        (event) =>
          event.eventName === 'readmodel:updated' &&
          (event.data as { collection: string }).collection === collection,
      ),
      map((event): CollectionSignal => {
        const data = event.data as { ids: string[]; commandIds: string[] }
        return {
          type: 'updated',
          ids: data.ids,
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
    return merge(updated$, seedCompleted$, syncFailed$).pipe(takeUntil(this.destroy$))
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
