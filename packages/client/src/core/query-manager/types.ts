/**
 * Query manager interface and types.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { EntityId } from '../../types/entities.js'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { PageRange, PagedViewResult } from '../views/types.js'

export type { PageRange, PagedViewResult } from '../views/types.js'

/**
 * Signal emitted by `watchCollection`.
 * Discriminated union covering data updates, seed completion, sync failures,
 * and session resets.
 *
 * `'updated'` carries the command IDs whose effects produced this batch — empty
 * when the update is server-driven (seed, gap repair, propagated event with no
 * local origin). Consumers that wait for a specific command to settle can
 * filter on `commandIds.includes(commandId)` without subscribing to the
 * lower-level event bus.
 *
 * `'session-reset'` fires when the session changes or is destroyed and all
 * read-model data has been wiped. Consumers should treat it like
 * `'seed-completed'`: re-fetch to pick up the new (often empty) state.
 */
export type CollectionSignal =
  | { type: 'updated'; ids: string[]; commandIds: string[] }
  | { type: 'seed-completed'; recordCount: number }
  | { type: 'sync-failed'; error: string }
  | { type: 'session-reset' }

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
  id: EntityId
}

/**
 * Parameters for {@link IQueryManager.getByIds}.
 */
export interface GetByIdsParams<TLink extends Link> extends QueryOptions<TLink> {
  /** Entity IDs */
  ids: EntityId[]
}

/**
 * One sort term in a {@link Sort} spec — column name plus direction.
 *
 * V1 scope: `column` must refer to a library-owned column on the read-model
 * table (`id`, `updated_at`). Custom-column sort support lands alongside
 * `watchList` once in-memory column-to-path resolution is in place.
 */
export interface SortTerm {
  column: string
  direction: 'asc' | 'desc'
}

/**
 * Composite sort spec — ordered list of {@link SortTerm}s. Earlier terms
 * dominate; later terms break ties. Used by both `list` for ordering and by
 * paged subscriptions for cursor pagination and Gate 3 boundary checks.
 */
export type Sort = readonly SortTerm[]

/**
 * Parameters for {@link IQueryManager.getView}.
 */
export interface GetViewParams<TParams = unknown> {
  /** View name as registered in `CqrsConfig.views`. */
  view: string
  /** Params bag passed to the view's `memory` / `sql.query` / `cacheKeys`. */
  params: TParams
  /** Optional pagination request. The view's SQL inlines LIMIT/OFFSET. */
  page?: PageRange
}

/**
 * Parameters for {@link IQueryManager.list}.
 */
export interface ListParams<TLink extends Link> extends QueryOptions<TLink> {
  /** Limit number of results */
  limit?: number
  /** Offset for pagination */
  offset?: number
  /**
   * Sort specification. When omitted, results are returned in the storage
   * backend's natural order (undefined — do not rely on it).
   */
  sort?: Sort
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
  /**
   * Total row count for the cache-key-scoped query, independent of
   * pagination. Returned when the collection's {@link Collection.list}.total
   * is `true`; `undefined` otherwise.
   */
  total: number | undefined
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
   * Execute a registered cross-collection view by name and return its
   * paged result. Pull form — one-shot read, no subscription state.
   *
   * Dispatches between the view's `memory` and `sql` implementations based
   * on the active storage backend. The library does not validate
   * cross-mode shape parity; the consumer owns it.
   *
   * V1 cache-key semantics: **assume-ambient**. The library resolves the
   * cache key templates declared by the view to {@link CacheKeyIdentity}s
   * and surfaces them in the result, but does not acquire or hold them —
   * the consumer's UI is responsible for ensuring the keys are present.
   */
  getView<T, TParams = unknown>(params: GetViewParams<TParams>): Promise<PagedViewResult<TLink, T>>

  /**
   * Paged-subscription observable over a registered cross-collection view.
   *
   * Mirrors {@link IQueryManager.watchList}'s three-gate model with a
   * cross-source extension:
   *
   * - **Cache-key gate** — event must touch one of the view's resolved keys.
   * - **ID gate** — for events on the view's `primarySource`, `updated`
   *   intersect `pageIds`; for events on a `joinSources[].collection`,
   *   `updated`/`deleted` intersect that collection's tracked `embedIds`
   *   (FK values extracted from the visible rows via `fromPath`).
   * - **Page-shift gate** — only triggered by creates / deletes in
   *   `primarySource` within a watched key. Join-source creates / deletes
   *   never shift the page composition (LEFT JOIN returns null embeds).
   *
   * Subscription state is per-call (per window). Each emission is a fresh
   * {@link PagedViewResult} — `pageIds` and `embedIds` rebuild from each
   * re-run. Hold lifecycle stays consumer-managed.
   *
   * Page identity: each row's `id` property is treated as the primary
   * source id. If `T` doesn't carry `id`, structure the row shape (or the
   * SQL projection) so it does, or the engine can't gate effectively.
   */
  watchView<T, TParams = unknown>(
    params: GetViewParams<TParams>,
  ): Observable<PagedViewResult<TLink, T>>

  /**
   * Get a paged-subscription observable over a collection.
   *
   * Emits an initial {@link ListQueryResult} and re-emits whenever an event
   * affects the visible page. Three gates filter incoming events without
   * re-running the underlying query:
   *
   * - **Cache-key gate** — events must touch the subscription's resolved
   *   cache key. Cross-key updates (e.g. another workspace's projects)
   *   are discarded with no per-row work.
   * - **ID gate** — `updated` rows must intersect the current page's
   *   primary-source IDs. Off-page updates are suppressed.
   * - **Page-shift gate** — any `created` / `deleted` rows in the watched
   *   collection trigger a re-run, since the page composition may have
   *   changed. (V1 is coarse — future versions add a sort-boundary
   *   fast-path to skip re-runs for creates that land outside the page.)
   *
   * Bulk re-fetch triggers: `sync:seed-completed` for the collection,
   * `session:destroyed`, and `cache:evicted` for the watched key all
   * bypass the gates and force a re-run.
   *
   * Hold lifecycle is consumer-managed via {@link IQueryManager.hold} /
   * {@link IQueryManager.release} — `watchList` does not auto-acquire or
   * auto-release. See `params.hold` on the initial fetch.
   */
  watchList<T>(params: ListParams<TLink>): Observable<ListQueryResult<TLink, T>>

  /**
   * Read a locally-cached read model by ID without triggering any client-side effects.
   *
   * Unlike {@link IQueryManager.getById}, this does not acquire a cache key,
   * register holds, emit events, or reconcile references.
   * It reads straight from the local read-model store and returns the data
   * if present, or `undefined` if the entity is not cached locally.
   *
   * Use this for quick local lookups where a full query result
   * (with metadata and cache-key plumbing) is not needed.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns The cached data, or `undefined` if not present locally
   */
  getLocallyById<T>(collection: string, id: EntityId): Promise<T | undefined>

  /**
   * Check if an entity exists.
   *
   * @param collection - Collection name
   * @param id - Entity ID
   * @returns Whether the entity exists
   */
  exists(collection: string, id: EntityId): Promise<boolean>

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
