/**
 * QueryManager proxy — implements IQueryManager on the main thread.
 *
 * Read methods use RPC. watchCollection/watchById use broadcast events.
 */

import { logProvider } from '@meticoeus/ddd-es'
import {
  Observable,
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
import type {
  IQueryManager,
  ListQueryResult,
  QueryOptions,
  QueryResult,
} from '../../core/query-manager/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'

/**
 * Main-thread proxy for the worker-side QueryManager.
 */
export class QueryManagerProxy implements IQueryManager {
  private readonly channel: WorkerMessageChannel
  private readonly broadcastEvents$: Observable<EventMessage>
  private readonly destroy$ = new Subject<void>()

  constructor(channel: WorkerMessageChannel, broadcastEvents$: Observable<EventMessage>) {
    this.channel = channel
    this.broadcastEvents$ = broadcastEvents$
  }

  async getById<T>(
    collection: string,
    id: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>> {
    return this.channel.request<QueryResult<T>>('queryManager.getById', [collection, id, options])
  }

  async getByIds<T>(
    collection: string,
    ids: string[],
    options?: QueryOptions,
  ): Promise<Map<string, QueryResult<T>>> {
    return this.channel.request<Map<string, QueryResult<T>>>('queryManager.getByIds', [
      collection,
      ids,
      options,
    ])
  }

  async list<T>(collection: string, options?: QueryOptions): Promise<ListQueryResult<T>> {
    return this.channel.request<ListQueryResult<T>>('queryManager.list', [collection, options])
  }

  watchCollection(collection: string): Observable<string[]> {
    return this.broadcastEvents$.pipe(
      filter(
        (event) =>
          event.eventName === 'readmodel:updated' &&
          (event.data as { collection: string }).collection === collection,
      ),
      map((event) => (event.data as { ids: string[] }).ids),
      takeUntil(this.destroy$),
    )
  }

  watchById<T>(collection: string, id: string): Observable<T | undefined> {
    return this.broadcastEvents$.pipe(
      filter(
        (event) =>
          event.eventName === 'readmodel:updated' &&
          (event.data as { collection: string }).collection === collection &&
          (event.data as { ids: string[] }).ids.includes(id),
      ),
      startWith(undefined),
      switchMap(() =>
        from(this.getById<T>(collection, id)).pipe(
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

  async exists(collection: string, id: string): Promise<boolean> {
    return this.channel.request<boolean>('queryManager.exists', [collection, id])
  }

  async count(collection: string): Promise<number> {
    return this.channel.request<number>('queryManager.count', [collection])
  }

  async touch(collection: string): Promise<void> {
    return this.channel.request<void>('queryManager.touch', [collection])
  }

  async hold(cacheKey: string): Promise<void> {
    return this.channel.request<void>('queryManager.hold', [cacheKey])
  }

  async release(cacheKey: string): Promise<void> {
    return this.channel.request<void>('queryManager.release', [cacheKey])
  }

  async releaseAll(): Promise<void> {
    return this.channel.request<void>('queryManager.releaseAll')
  }

  async destroy(): Promise<void> {
    this.destroy$.next()
    this.destroy$.complete()
  }
}
