/**
 * Shared types for SolidJS reactive query primitives.
 */

import type { CacheKeyIdentity } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'

/**
 * Constraint for queryable items — must have a string `id` property.
 */
export interface Identifiable {
  readonly id: string
}

/**
 * Parameters for `createListQuery`.
 *
 * `cacheKey` is required and can be either a static identity or a reactive accessor.
 * When the accessor returns `undefined`, the query enters an inactive state (loading, no data).
 */
export interface ListQueryParams<TLink extends Link> {
  collection: string
  cacheKey: CacheKeyIdentity<TLink> | (() => CacheKeyIdentity<TLink> | undefined)
  limit?: number
  offset?: number
}

/**
 * Parameters for `createItemQuery`.
 *
 * `id` can be a static string or a reactive accessor.
 * `cacheKey` can be a static identity or a reactive accessor.
 */
export interface ItemQueryParams<TLink extends Link> {
  collection: string
  id: string | (() => string)
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
  readonly total: number
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
