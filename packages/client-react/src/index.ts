/**
 * @cqrs-toolkit/client-react
 *
 * React 18 hooks for @cqrs-toolkit/client.
 *
 * @packageDocumentation
 */

export { CqrsProvider, useClient } from './context.js'
export type {
  Identifiable,
  ItemQueryParams,
  ItemQueryState,
  ListQueryParams,
  ListQueryState,
  ListQueryStatus,
  ReconciledId,
  ViewQueryParams,
  ViewQueryState,
  ViewQueryStatus,
} from './types.js'
export { useEntityCacheKey, useScopeCacheKey } from './useCacheKey.js'
export { useItemQuery } from './useItemQuery.js'
export { useListQuery } from './useListQuery.js'
export { useViewQuery } from './useViewQuery.js'
