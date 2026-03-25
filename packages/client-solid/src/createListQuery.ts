/**
 * SolidJS reactive primitive for list queries.
 */

import type { IQueryManager, QueryManagerQueryOptions } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { Identifiable, ListQueryOptions, ListQueryState, ReconciledId } from './types.js'

interface ListQueryStore<T extends Identifiable> {
  items: T[]
  loading: boolean
  total: number
  hasLocalChanges: boolean
  error: unknown
  reconciled: ReconciledId[]
}

/**
 * Create a reactive list query that subscribes to collection changes.
 *
 * Fetches the collection immediately, subscribes to `watchCollection`,
 * and refetches on each update.
 * Uses `createStore` + `reconcile` for fine-grained reactivity and
 * stable `<For>` identity.
 *
 * When an entity's ID is reconciled (client temp ID → server ID), the store
 * pre-mutates existing items so `reconcile()` preserves Solid store identity.
 * The `reconciled` field exposes these mappings for consumers holding entity
 * IDs in external signals (selection state, URL params).
 *
 * @param queryManager - The query manager (should be StableRefQueryManager-wrapped for best results)
 * @param collection - Collection name
 * @param options - Query options (scope, limit, offset)
 * @returns Reactive store with items, loading, total, hasLocalChanges, error, reconciled
 */
export function createListQuery<TLink extends Link, T extends Identifiable>(
  queryManager: IQueryManager<TLink>,
  collection: string,
  options?: ListQueryOptions,
): ListQueryState<T> {
  const initialState: ListQueryStore<T> = {
    items: [],
    loading: true,
    total: 0,
    hasLocalChanges: false,
    error: undefined,
    reconciled: [],
  }

  const [store, setStore] = createStore<ListQueryStore<T>>(initialState)

  const queryOptions: QueryManagerQueryOptions = { hold: true }
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
        cacheKey = result.cacheKey.key
      }

      // Build clientId→serverId map from metadata for items that have been reconciled.
      // An item has been reconciled when its _clientMetadata.clientId differs from its id.
      const idRemaps = new Map<string, string>()
      for (const m of result.meta) {
        if (m.clientId && m.clientId !== m.id) {
          idRemaps.set(m.clientId, m.id)
        }
      }

      // Pre-mutate existing store items whose id matches a reconciled clientId.
      // This makes reconcile() see the same item with the new id — preserving
      // the Solid store object reference and <For> DOM node identity.
      if (idRemaps.size > 0) {
        for (const [i, item] of store.items.entries()) {
          const newId = idRemaps.get(item.id)
          if (typeof newId === 'string') {
            setStore('items', i, { ...item, id: newId } as T)
          }
        }
      }

      setStore('items', reconcile(result.data, { key: 'id', merge: true }))
      setStore('total', result.total)
      setStore('hasLocalChanges', result.hasLocalChanges)
      setStore('error', undefined)

      // Expose reconciliation mappings for consumers holding entity IDs externally.
      const reconciled: ReconciledId[] = []
      for (const [clientId, serverId] of idRemaps) {
        reconciled.push({ clientId, serverId })
      }
      setStore('reconciled', reconciled)

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
