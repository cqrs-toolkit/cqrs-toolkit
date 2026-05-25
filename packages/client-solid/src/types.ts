/**
 * Shared types for SolidJS reactive query primitives.
 */

import type { CacheKeyIdentity, EntityId, ListFilter, PageRange, Sort } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'

/**
 * Constraint for queryable items — must have an `id` property.
 * The id is `EntityId` (string | EntityRef): plain string for server-confirmed
 * entities, EntityRef for locally-created entities with pending IDs.
 */
export interface Identifiable {
  readonly id: EntityId
}

/**
 * Parameters for `createListQuery`.
 *
 * `cacheKey`, `sort`, and `filter` each accept either a static value or
 * a reactive accessor (e.g. a `createMemo`). The three react on
 * different scopes — see below.
 *
 * When `cacheKey` resolves to `undefined`, the query enters an inactive
 * state (loading, no data). `sort` defaults to the collection-level
 * `list.defaultSort`; `filter` is a per-call predicate shipped to both
 * backends — see {@link ListFilter} for the wrapping contract.
 *
 * ### Reactive scopes
 *
 * - **`cacheKey` change → full session restart.** Cancels the in-flight
 *   fetch, unsubscribes the collection watcher, releases the held cache
 *   key, resets the store to `loading`, and starts a new session.
 * - **`sort` / `filter` change → in-session refetch.** Re-runs
 *   `queryManager.list` against the *same* held cache key. The watcher
 *   stays attached and the key is never released — important because
 *   release/reacquire has visible side effects on the cache manager
 *   (invalidation reordering, WS topic resubscribes, reseed attempts).
 *   Items stay visible across the refetch; `reconcile` replaces them
 *   when the new data arrives.
 */
export interface ListQueryParams<TLink extends Link> {
  collection: string
  cacheKey: CacheKeyIdentity<TLink> | (() => CacheKeyIdentity<TLink> | undefined)
  limit?: number
  offset?: number
  /**
   * Static value, or a reactive accessor. Changes trigger an in-session
   * refetch — the cache key hold and collection watcher are preserved.
   */
  sort?: Sort | (() => Sort | undefined)
  /**
   * Static value, or a reactive accessor. Changes trigger an in-session
   * refetch — the cache key hold and collection watcher are preserved.
   */
  filter?: ListFilter | (() => ListFilter | undefined)
}

/**
 * Parameters for `createItemQuery`.
 *
 * `id` can be a static string or a reactive accessor.
 * `cacheKey` can be a static identity or a reactive accessor.
 */
export interface ItemQueryParams<TLink extends Link> {
  collection: string
  id: EntityId | (() => EntityId)
  cacheKey: CacheKeyIdentity<TLink> | (() => CacheKeyIdentity<TLink> | undefined)
}

/**
 * A client ID → server ID mapping from a recent ID reconciliation.
 */
export interface ReconciledId {
  readonly clientId: string
  readonly serverId: string
}

/**
 * Discriminated union representing the lifecycle state of a list query.
 *
 * - `loading` — Initial state, checking local cache
 * - `seeding` — No local data, seed in progress for this collection
 * - `ready` — Data loaded (may be empty if collection is genuinely empty)
 * - `seed-failed` — First seed attempt failed, no data was ever loaded
 * - `sync-failed` — Had data, subsequent sync failed — stale data still displayed
 */
export type ListQueryStatus =
  | { status: 'loading' }
  | { status: 'seeding' }
  | { status: 'ready' }
  | { status: 'seed-failed'; error: string }
  | { status: 'sync-failed'; error: string }

/**
 * Reactive state returned by `createListQuery`.
 */
export interface ListQueryState<T extends Identifiable> {
  /** Current items (may be stale during `sync-failed`, empty during `seed-failed`) */
  readonly items: T[]
  /** Convenience: `true` when `state.status` is `'loading'` or `'seeding'` */
  readonly loading: boolean
  /**
   * Total row count for the collection's cache-key scope. Defined when the
   * underlying collection has `list.total: true`; `undefined` otherwise.
   */
  readonly total: number | undefined
  readonly hasLocalChanges: boolean
  /** Lifecycle state with status-specific data */
  readonly state: ListQueryStatus
  /**
   * Recent ID reconciliations for this collection.
   * Contains entries where a client-generated temp ID was replaced by a server ID.
   * Consumers holding entity IDs in signals can react to maintain stable references:
   *
   * ```ts
   * createEffect(() => {
   *   for (const { clientId, serverId } of query.reconciled) {
   *     if (selectedId() === clientId) setSelectedId(serverId)
   *   }
   * })
   * ```
   */
  readonly reconciled: ReconciledId[]
}

/**
 * Parameters for `createViewQuery`.
 *
 * View name is static (it's a config-time identifier); params and page can
 * be either static or reactive accessors. When a reactive accessor returns
 * `undefined`, the query enters an inactive state (loading, no data) — useful
 * for navigation flows where the params come from a route that's not yet
 * matched.
 */
export interface ViewQueryParams<TParams = unknown> {
  /** View name as registered in `CqrsConfig.views`. */
  view: string
  /** Params bag for the view. Static or reactive accessor. */
  params: TParams | (() => TParams | undefined)
  /** Optional page. Static or reactive accessor. */
  page?: PageRange | (() => PageRange | undefined)
}

/**
 * Lifecycle status for a view query.
 *
 * Simpler than the list-query lifecycle: views don't have a built-in "seeding"
 * distinction since seed status is per-cache-key and views read across
 * multiple keys. Consumers that need the distinction layer it via their own
 * cache-key acquisition flow.
 */
export type ViewQueryStatus =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; error: string }

/**
 * Reactive state returned by `createViewQuery`.
 */
export interface ViewQueryState<T extends Identifiable> {
  /** Current rows from the view's last emission. */
  readonly items: T[]
  /**
   * Total row count for the view's query, independent of pagination.
   * Populated when the view registration supplies a count callback
   * (`memoryCount` on the memory path or `sql.count` on the SQL path).
   * `undefined` when no count callback is configured.
   */
  readonly total: number | undefined
  /** Convenience: `true` when `state.status` is `'loading'`. */
  readonly loading: boolean
  /** Lifecycle state with status-specific data. */
  readonly state: ViewQueryStatus
}

/**
 * Reactive state returned by `createItemQuery`.
 */
export interface ItemQueryState<T extends Identifiable> {
  readonly data: T | undefined
  readonly loading: boolean
  readonly hasLocalChanges: boolean
  readonly error: unknown
  /**
   * Set when the item query detects that the tracked ID was reconciled
   * (client temp ID replaced by server ID). The query transparently follows
   * the new ID — consumers holding the old ID externally can react to update
   * their references.
   */
  readonly reconciledId: ReconciledId | undefined
}
