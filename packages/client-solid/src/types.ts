/**
 * Shared types for SolidJS reactive query primitives.
 */

/**
 * Constraint for queryable items — must have a string `id` property.
 */
export interface Identifiable {
  readonly id: string
}

/**
 * Options for `createListQuery`.
 */
export interface ListQueryOptions {
  limit?: number
  offset?: number
}

/**
 * Options for `createItemQuery`.
 */
export interface ItemQueryOptions {}

/**
 * A client ID → server ID mapping from a recent ID reconciliation.
 */
export interface ReconciledId {
  readonly clientId: string
  readonly serverId: string
}

/**
 * Reactive state returned by `createListQuery`.
 */
export interface ListQueryState<T extends Identifiable> {
  readonly items: readonly T[]
  readonly loading: boolean
  readonly total: number
  readonly hasLocalChanges: boolean
  readonly error: unknown
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
  readonly reconciled: readonly ReconciledId[]
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
