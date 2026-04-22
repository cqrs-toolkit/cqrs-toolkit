import { type CacheKeyIdentity, type EntityId } from '@cqrs-toolkit/client'
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
  collection: string,
  cacheKey: CacheKeyIdentity<ServiceLink> | (() => CacheKeyIdentity<ServiceLink> | undefined),
  options?: { limit?: number; offset?: number },
): ListQueryState<T> {
  const params: ListQueryParams<ServiceLink> = {
    collection,
    cacheKey,
    ...options,
  }
  return createListQuery<ServiceLink, T>(params)
}

export function appCreateItemQuery<T extends Identifiable>(
  collection: string,
  id: EntityId | (() => EntityId),
  cacheKey: CacheKeyIdentity<ServiceLink> | (() => CacheKeyIdentity<ServiceLink> | undefined),
): ItemQueryState<T> {
  const params: ItemQueryParams<ServiceLink> = {
    collection,
    id,
    cacheKey,
  }
  return createItemQuery<ServiceLink, T>(params)
}
