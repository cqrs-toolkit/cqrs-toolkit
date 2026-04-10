/**
 * Query manager interface and types.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'

/**
 * Signal emitted by `watchCollection`.
 * Discriminated union covering data updates, seed completion, and sync failures.
 */
export type CollectionSignal =
  | { type: 'updated'; ids: string[] }
  | { type: 'seed-completed'; recordCount: number }
  | { type: 'sync-failed'; error: string }

/**
 * Common query parameters shared by all query methods.
 */
export interface QueryOptions<TLink extends Link> {
  /** Collection name */
  collection: string
  /** Cache key identity — determines which cached data scope to query */
  cacheKey: CacheKeyIdentity<TLink>
  /** Place a hold on the cache key while query is active */
  hold?: boolean
  /** @internal Window ID for hold tracking. Injected by the facade/proxy. */
  windowId?: string
}

/**
 * Parameters for {@link IQueryManager.getById}.
 */
export interface GetByIdParams<TLink extends Link> extends QueryOptions<TLink> {
  /** Entity ID */
  id: string
}

/**
 * Parameters for {@link IQueryManager.getByIds}.
 */
export interface GetByIdsParams<TLink extends Link> extends QueryOptions<TLink> {
  /** Entity IDs */
  ids: string[]
}

/**
 * Parameters for {@link IQueryManager.list}.
 */
export interface ListParams<TLink extends Link> extends QueryOptions<TLink> {
  /** Limit number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Identity and change-detection metadata for a single item.
 * Carried alongside query results so decorators (e.g. StableRefQueryManager)
 * can reconcile references without inspecting consumer data.
 */
export interface ItemMeta {
  readonly id: string
  readonly updatedAt: number
  /** Original client-generated temp ID. Present when the entity was created from a temp-ID create command. */
  readonly clientId?: string
  /** Stream revision (bigint as string). Present when the entity has been confirmed by the server. */
  readonly revision?: string
}

/**
 * Query result with metadata.
 *
 * Parameterized on `TLink` so multi-service apps get typed cache key identities.
 */
export interface QueryResult<TLink extends Link, T> {
  /** The data, or undefined if not found */
  data: T | undefined
  /** Identity metadata for change detection, undefined when data is undefined */
  meta: ItemMeta | undefined
  /** Whether the data has local changes pending sync */
  hasLocalChanges: boolean
  /** Cache key identity used for this query */
  cacheKey: CacheKeyIdentity<TLink>
}

/**
 * List query result.
 *
 * Parameterized on `TLink` so multi-service apps get typed cache key identities.
 */
export interface ListQueryResult<TLink extends Link, T> {
  /** The data items */
  data: T[]
  /** Identity metadata parallel to data (same length and order) */
  meta: ItemMeta[]
  /** Total count (may differ from data.length with pagination) */
  total: number
  /** Whether any items have local changes */
  hasLocalChanges: boolean
  /** Cache key identity used for this query */
  cacheKey: CacheKeyIdentity<TLink>
}

/**
 * Query manager interface.
 * Provides read-only access to cached data with cache key management.
 *
 * Parameterized on `TLink` so multi-service apps get typed cache key identities
 * in query results.
 */
export interface IQueryManager<TLink extends Link> {
  /**
   * Get a single entity by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param options - Query options
   * @returns Query result
   */
  getById<T>(params: GetByIdParams<TLink>): Promise<QueryResult<TLink, T>>

  /**
   * Get multiple entities by IDs.
   */
  getByIds<T>(params: GetByIdsParams<TLink>): Promise<Map<string, QueryResult<TLink, T>>>

  /**
   * List entities in a collection.
   */
  list<T>(params: ListParams<TLink>): Promise<ListQueryResult<TLink, T>>

  /**
   * Get an observable of collection lifecycle signals.
   * Emits for data updates, seed completion, and sync failures.
   *
   * @param collection - Collection name
   * @returns Observable of collection signals
   */
  watchCollection(collection: string): Observable<CollectionSignal>

  /**
   * Get an observable that emits when a specific entity changes.
   */
  watchById<T>(params: GetByIdParams<TLink>): Observable<T | undefined>

  /**
   * Check if an entity exists.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Whether the entity exists
   */
  exists(collection: string, id: string): Promise<boolean>

  /**
   * Get the count of entities in a collection.
   *
   * @param collection - Collection name
   * @returns Count
   */
  count(collection: string): Promise<number>

  /**
   * Touch a cache key to extend its lifetime.
   */
  touch(cacheKey: CacheKeyIdentity<TLink>): Promise<void>

  /**
   * Place a hold on a cache key.
   *
   * @param cacheKey - Cache key UUID string
   */
  hold(cacheKey: string): Promise<void>

  /**
   * Release a hold on a cache key.
   *
   * @param cacheKey - Cache key UUID string
   */
  release(cacheKey: string): Promise<void>

  /**
   * Release all active holds.
   */
  releaseAll(): Promise<void>

  /**
   * Destroy the query manager and release resources.
   */
  destroy(): Promise<void>
}

/**
 * Internal query manager interface.
 *
 * Extends the public {@link IQueryManager} with methods used by internal
 * callers (SyncManager) that run in the same thread as the QueryManager.
 *
 * Not exposed to consumers — the public API is always {@link IQueryManager}.
 */
export interface IQueryManagerInternal<TLink extends Link> extends IQueryManager<TLink> {
  /** Place a hold on a cache key for a specific window. */
  holdForWindow(cacheKey: string, windowId: string): void

  /** Release a hold on a cache key for a specific window. */
  releaseForWindow(cacheKey: string, windowId: string): void

  /** Release all holds for a specific window. */
  releaseAllForWindow(windowId: string): void

  /** Clear all in-memory hold tracking on session destroy. */
  onSessionDestroyed(): void

  /** Release hold tracking for an evicted cache key without calling cacheManager.release(). */
  releaseForCacheKey(cacheKey: string): void
}
