/**
 * SolidJS reactive primitive for list queries.
 */

import type { IQueryManager, QueryManagerQueryOptions } from '@cqrs-toolkit/client'
import { onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { Identifiable, ListQueryOptions, ListQueryState } from './types.js'

interface ListQueryStore<T extends Identifiable> {
  items: T[]
  loading: boolean
  total: number
  hasLocalChanges: boolean
  error: unknown
}

/**
 * Create a reactive list query that subscribes to collection changes.
 *
 * Fetches the collection immediately, subscribes to `watchCollection`,
 * and refetches on each update.
 * Uses `createStore` + `reconcile` for fine-grained reactivity and
 * stable `<For>` identity.
 *
 * @param queryManager - The query manager (should be StableRefQueryManager-wrapped for best results)
 * @param collection - Collection name
 * @param options - Query options (scope, limit, offset)
 * @returns Reactive store with items, loading, total, hasLocalChanges, error
 */
export function createListQuery<T extends Identifiable>(
  queryManager: IQueryManager,
  collection: string,
  options?: ListQueryOptions,
): ListQueryState<T> {
  const initialState: ListQueryStore<T> = {
    items: [],
    loading: true,
    total: 0,
    hasLocalChanges: false,
    error: undefined,
  }

  const [store, setStore] = createStore<ListQueryStore<T>>(initialState)

  const queryOptions: QueryManagerQueryOptions = { hold: true }
  if (options?.scope !== undefined) {
    queryOptions.scope = options.scope
  }
  if (options?.limit !== undefined) {
    queryOptions.limit = options.limit
  }
  if (options?.offset !== undefined) {
    queryOptions.offset = options.offset
  }

  let cacheKey: string | undefined
  let fetchVersion = 0
  let initialFetchDone = false

  async function fetch(): Promise<void> {
    fetchVersion++
    const version = fetchVersion

    try {
      const result = await queryManager.list<T>(collection, queryOptions)

      if (version !== fetchVersion) {
        return
      }

      // Track cache key for release on cleanup
      if (cacheKey === undefined) {
        cacheKey = result.cacheKey
      }

      setStore('items', reconcile(result.data, { key: 'id', merge: true }))
      setStore('total', result.total)
      setStore('hasLocalChanges', result.hasLocalChanges)
      setStore('error', undefined)

      if (!initialFetchDone) {
        initialFetchDone = true
        setStore('loading', false)
      }
    } catch (err: unknown) {
      if (version !== fetchVersion) {
        return
      }

      setStore('error', err)

      if (!initialFetchDone) {
        initialFetchDone = true
        setStore('loading', false)
      }
    }
  }

  // Initial fetch
  void fetch()

  // Subscribe to collection changes
  const subscription = queryManager.watchCollection(collection).subscribe(() => {
    void fetch()
  })

  onCleanup(() => {
    subscription.unsubscribe()
    if (cacheKey !== undefined) {
      void queryManager.release(cacheKey)
    }
  })

  return store
}
