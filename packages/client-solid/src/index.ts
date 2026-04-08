/**
 * @cqrs-toolkit/client-solid
 *
 * SolidJS reactive primitives for @cqrs-toolkit/client.
 *
 * @packageDocumentation
 */

export { CqrsProvider, useClient } from './context.js'
export { createEntityCacheKey, createScopeCacheKey } from './createCacheKey.js'
export { createItemQuery } from './createItemQuery.js'
export { createListQuery } from './createListQuery.js'
export type {
  Identifiable,
  ItemQueryParams,
  ItemQueryState,
  ListQueryParams,
  ListQueryState,
  ReconciledId,
} from './types.js'
