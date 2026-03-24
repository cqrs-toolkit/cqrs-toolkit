/**
 * @cqrs-toolkit/client-solid
 *
 * SolidJS reactive primitives for @cqrs-toolkit/client.
 *
 * @packageDocumentation
 */

export { CqrsProvider, useClient } from './context.js'
export { createItemQuery } from './createItemQuery.js'
export { createListQuery } from './createListQuery.js'
export type {
  Identifiable,
  ItemQueryOptions,
  ItemQueryState,
  ListQueryOptions,
  ListQueryState,
  ReconciledId,
} from './types.js'
