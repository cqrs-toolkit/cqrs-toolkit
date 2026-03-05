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
  scope?: string
  limit?: number
  offset?: number
}

/**
 * Options for `createItemQuery`.
 */
export interface ItemQueryOptions {
  scope?: string
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
}

/**
 * Reactive state returned by `createItemQuery`.
 */
export interface ItemQueryState<T extends Identifiable> {
  readonly data: T | undefined
  readonly loading: boolean
  readonly hasLocalChanges: boolean
  readonly error: unknown
}
