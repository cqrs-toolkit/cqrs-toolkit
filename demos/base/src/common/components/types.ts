import { IQueryManager } from '@cqrs-toolkit/client'
import {
  createItemQuery,
  createListQuery,
  type Identifiable,
  type ItemQueryOptions,
  type ItemQueryState,
  type ListQueryOptions,
  type ListQueryState,
} from '@cqrs-toolkit/client-solid'
import { ServiceLink } from '@meticoeus/ddd-es'

export function appCreateListQuery<T extends Identifiable>(
  queryManager: IQueryManager<ServiceLink>,
  collection: string,
  options?: ListQueryOptions,
): ListQueryState<T> {
  return createListQuery<ServiceLink, T>(queryManager, collection, options)
}

export function appCreateItemQuery<T extends Identifiable>(
  queryManager: IQueryManager<ServiceLink>,
  collection: string,
  id: () => string,
  options?: ItemQueryOptions,
): ItemQueryState<T> {
  return createItemQuery<ServiceLink, T>(queryManager, collection, id, options)
}
