/**
 * Window-scoped facade for QueryManager.
 *
 * Each window gets its own facade that injects the windowId for hold/release.
 * In online-only mode, createCqrsClient creates one facade.
 * In worker modes, the QueryManagerProxy serves the same role.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type {
  CollectionSignal,
  GetByIdParams,
  GetByIdsParams,
  IQueryManager,
  IQueryManagerInternal,
  ListParams,
  ListQueryResult,
  QueryResult,
} from './types.js'

export class QueryManagerFacade<TLink extends Link> implements IQueryManager<TLink> {
  constructor(
    private readonly inner: IQueryManagerInternal<TLink>,
    private readonly windowId: string,
  ) {}

  getById<T>(params: GetByIdParams<TLink>): Promise<QueryResult<TLink, T>> {
    return this.inner.getById({ ...params, windowId: this.windowId })
  }

  getByIds<T>(params: GetByIdsParams<TLink>): Promise<Map<string, QueryResult<TLink, T>>> {
    return this.inner.getByIds({ ...params, windowId: this.windowId })
  }

  list<T>(params: ListParams<TLink>): Promise<ListQueryResult<TLink, T>> {
    return this.inner.list({ ...params, windowId: this.windowId })
  }

  watchCollection(collection: string): Observable<CollectionSignal> {
    return this.inner.watchCollection(collection)
  }

  watchById<T>(params: GetByIdParams<TLink>): Observable<T | undefined> {
    return this.inner.watchById(params)
  }

  exists(collection: string, id: string): Promise<boolean> {
    return this.inner.exists(collection, id)
  }

  count(collection: string): Promise<number> {
    return this.inner.count(collection)
  }

  touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void> {
    return this.inner.touch(cacheKey)
  }

  async hold(cacheKey: string): Promise<void> {
    return this.inner.holdForWindow(cacheKey, this.windowId)
  }

  async release(cacheKey: string): Promise<void> {
    return this.inner.releaseForWindow(cacheKey, this.windowId)
  }

  async releaseAll(): Promise<void> {
    return this.inner.releaseAllForWindow(this.windowId)
  }

  async destroy(): Promise<void> {
    await this.releaseAll()
  }
}
