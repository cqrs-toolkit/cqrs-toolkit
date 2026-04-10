import { type CacheKeyIdentity, type EntityId, IQueryManager } from '@cqrs-toolkit/client'
import {
  createItemQuery,
  createListQuery,
  type Identifiable,
  type ItemQueryParams,
  type ItemQueryState,
  type ListQueryParams,
  type ListQueryState,
} from '@cqrs-toolkit/client-solid'
import { ServiceLink } from '@meticoeus/ddd-es'

export function appCreateListQuery<T extends Identifiable>(
  queryManager: IQueryManager<ServiceLink>,
  collection: string,
  cacheKey: CacheKeyIdentity<ServiceLink> | (() => CacheKeyIdentity<ServiceLink> | undefined),
  options?: { limit?: number; offset?: number },
): ListQueryState<T> {
  const params: ListQueryParams<ServiceLink> = {
    collection,
    cacheKey,
    ...options,
  }
  return createListQuery<ServiceLink, T>(queryManager, params)
}

export function appCreateItemQuery<T extends Identifiable>(
  queryManager: IQueryManager<ServiceLink>,
  collection: string,
  id: EntityId | (() => EntityId),
  cacheKey: CacheKeyIdentity<ServiceLink> | (() => CacheKeyIdentity<ServiceLink> | undefined),
): ItemQueryState<T> {
  const params: ItemQueryParams<ServiceLink> = {
    collection,
    id,
    cacheKey,
  }
  return createItemQuery<ServiceLink, T>(queryManager, params)
}
