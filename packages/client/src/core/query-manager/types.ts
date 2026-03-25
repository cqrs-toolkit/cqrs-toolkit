/**
 * Query manager interface and types.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { ReadModelQueryOptions } from '../read-model-store/index.js'

/**
 * Query options.
 */
export interface QueryOptions extends ReadModelQueryOptions {
  /** Place a hold on the cache key while query is active */
  hold?: boolean
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
  getById<T>(collection: string, id: string, options?: QueryOptions): Promise<QueryResult<TLink, T>>

  /**
   * Get multiple entities by IDs.
   *
   * @param collection - Collection name
   * @param ids - Entity IDs
   * @param options - Query options
   * @returns Map of ID to query result
   */
  getByIds<T>(
    collection: string,
    ids: string[],
    options?: QueryOptions,
  ): Promise<Map<string, QueryResult<TLink, T>>>

  /**
   * List entities in a collection.
   *
   * @param collection - Collection name
   * @param options - Query options
   * @returns List query result
   */
  list<T>(collection: string, options?: QueryOptions): Promise<ListQueryResult<TLink, T>>

  /**
   * Get an observable that emits when data in a collection changes.
   *
   * @param collection - Collection name
   * @returns Observable of updated entity IDs
   */
  watchCollection(collection: string): Observable<string[]>

  /**
   * Get an observable that emits when a specific entity changes.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Observable of the entity data
   */
  watchById<T>(collection: string, id: string): Observable<T | undefined>

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
   * Touch the cache key for a collection.
   *
   * @param collection - Collection name
   */
  touch(collection: string): Promise<void>

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
