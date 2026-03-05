/**
 * Query manager interface and types.
 */

import type { Observable } from 'rxjs'
import type { ReadModelQueryOptions } from '../read-model-store/index.js'

/**
 * Query options.
 */
export interface QueryOptions extends ReadModelQueryOptions {
  /** Place a hold on the cache key while query is active */
  hold?: boolean
  /** Custom scope for the cache key */
  scope?: string
}

/**
 * Query result with metadata.
 */
export interface QueryResult<T> {
  /** The data, or undefined if not found */
  data: T | undefined
  /** Whether the data has local changes pending sync */
  hasLocalChanges: boolean
  /** Cache key used for this query */
  cacheKey: string
}

/**
 * List query result.
 */
export interface ListQueryResult<T> {
  /** The data items */
  data: T[]
  /** Total count (may differ from data.length with pagination) */
  total: number
  /** Whether any items have local changes */
  hasLocalChanges: boolean
  /** Cache key used for this query */
  cacheKey: string
}

/**
 * Query manager interface.
 * Provides read-only access to cached data with cache key management.
 */
export interface IQueryManager {
  /**
   * Get a single entity by ID.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @param options - Query options
   * @returns Query result
   */
  getById<T>(collection: string, id: string, options?: QueryOptions): Promise<QueryResult<T>>

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
  ): Promise<Map<string, QueryResult<T>>>

  /**
   * List entities in a collection.
   *
   * @param collection - Collection name
   * @param options - Query options
   * @returns List query result
   */
  list<T>(collection: string, options?: QueryOptions): Promise<ListQueryResult<T>>

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
   * @param cacheKey - Cache key to hold
   */
  hold(cacheKey: string): Promise<void>

  /**
   * Release a hold on a cache key.
   *
   * @param cacheKey - Cache key to release
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
