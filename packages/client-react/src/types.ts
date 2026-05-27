/**
 * Shared types for React reactive query primitives.
 *
 * Companion to `@cqrs-toolkit/client-solid`'s `types.ts`. Where Solid's params
 * accept either a static value or a zero-arg accessor, React's params accept
 * only the static value — re-evaluation is driven by render. Returned state
 * shapes match Solid one-for-one.
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
 * Parameters for `useListQuery`.
 *
 * `cacheKey`, `sort`, and `filter` each accept a plain value. The hook diffs
 * each input across renders and reacts on different scopes:
 *
 * ### Reactive scopes
 *
 * - **`cacheKey` change → full session restart.** Cancels the in-flight
 *   fetch, unsubscribes the collection watcher, releases the held cache key,
 *   resets the snapshot to `loading`, and starts a new session.
 * - **`sort` / `filter` change → in-session refetch.** Re-runs
 *   `queryManager.list` against the *same* held cache key. The watcher
 *   stays attached and the key is never released — important because
 *   release/reacquire has visible side effects on the cache manager
 *   (invalidation reordering, WS topic resubscribes, reseed attempts).
 *   Items stay visible across the refetch; the new data replaces them when
 *   it arrives.
 *
 * When `cacheKey` is `undefined`, the query enters an inactive state
 * (loading, no data).
 */
export interface ListQueryParams<TLink extends Link> {
  collection: string
  cacheKey: CacheKeyIdentity<TLink> | undefined
  limit?: number
  offset?: number
  /** Changes trigger an in-session refetch — cache key hold and watcher are preserved. */
  sort?: Sort
  /** Changes trigger an in-session refetch — cache key hold and watcher are preserved. */
  filter?: ListFilter
}

/**
 * Parameters for `useItemQuery`.
 *
 * `id` and `cacheKey` are plain values — the hook diffs them across renders.
 * When `cacheKey` is `undefined`, the query enters an inactive state.
 */
export interface ItemQueryParams<TLink extends Link> {
  collection: string
  id: EntityId
  cacheKey: CacheKeyIdentity<TLink> | undefined
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
 * Snapshot returned by `useListQuery`.
 */
export interface ListQueryState<T extends Identifiable> {
  /** Current items (may be stale during `sync-failed`, empty during `seed-failed`) */
  readonly items: readonly T[]
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
   * Consumers holding entity IDs in component state can react to maintain stable references:
   *
   * ```tsx
   * useEffect(() => {
   *   for (const { clientId, serverId } of query.reconciled) {
   *     if (selectedId === clientId) setSelectedId(serverId)
   *   }
   * }, [query.reconciled])
   * ```
   */
  readonly reconciled: readonly ReconciledId[]
}

/**
 * Parameters for `useViewQuery`.
 *
 * `view` is static (it's a config-time identifier). `params` and `page` are
 * plain values — the hook diffs them across renders. When `params` is
 * `undefined`, the query enters an inactive state (loading, no data).
 */
export interface ViewQueryParams<TParams = unknown> {
  /** View name as registered in `CqrsConfig.views`. */
  view: string
  /** Params bag for the view. */
  params: TParams | undefined
  /** Optional page. */
  page?: PageRange
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
 * Snapshot returned by `useViewQuery`.
 */
export interface ViewQueryState<T extends Identifiable> {
  /** Current rows from the view's last emission. */
  readonly items: readonly T[]
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
 * Snapshot returned by `useItemQuery`.
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
