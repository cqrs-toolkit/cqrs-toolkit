/**
 * SolidJS reactive primitive for single-item queries.
 */

import type { IQueryManager, QueryManagerQueryOptions } from '@cqrs-toolkit/client'
import { createComputed, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { Identifiable, ItemQueryOptions, ItemQueryState } from './types.js'

interface ItemQueryStore<T extends Identifiable> {
  data: T | undefined
  loading: boolean
  hasLocalChanges: boolean
  error: unknown
}

interface Session {
  cleanup: () => void
}

/**
 * Create a reactive single-item query that subscribes to collection changes.
 *
 * Fetches the item immediately, subscribes to `watchCollection` filtered
 * by the target ID, and refetches on matching updates.
 * The `id` parameter is an accessor, so it re-subscribes when the ID changes
 * (e.g., route param changes).
 *
 * @param queryManager - The query manager
 * @param collection - Collection name
 * @param id - Accessor returning the entity ID (reactive)
 * @param options - Query options (scope)
 * @returns Reactive store with data, loading, hasLocalChanges, error
 */
export function createItemQuery<T extends Identifiable>(
  queryManager: IQueryManager,
  collection: string,
  id: () => string,
  options?: ItemQueryOptions,
): ItemQueryState<T> {
  const initialState: ItemQueryStore<T> = {
    data: undefined,
    loading: true,
    hasLocalChanges: false,
    error: undefined,
  }

  const [store, setStore] = createStore<ItemQueryStore<T>>(initialState)

  let currentSession: Session | undefined

  function startSession(currentId: string): Session {
    let cacheKey: string | undefined
    let fetchVersion = 0
    let cancelled = false
    let initialFetchDone = false

    const queryOptions: QueryManagerQueryOptions = { hold: true }
    if (options?.scope !== undefined) {
      queryOptions.scope = options.scope
    }

    setStore('loading', true)

    async function fetch(): Promise<void> {
      fetchVersion++
      const version = fetchVersion

      try {
        const result = await queryManager.getById<T>(collection, currentId, queryOptions)

        if (cancelled || version !== fetchVersion) {
          return
        }

        if (cacheKey === undefined) {
          cacheKey = result.cacheKey
        }

        if (result.data !== undefined) {
          setStore('data', reconcile(result.data, { key: 'id', merge: true }))
        } else {
          setStore('data', undefined)
        }
        setStore('hasLocalChanges', result.hasLocalChanges)
        setStore('error', undefined)

        if (!initialFetchDone) {
          initialFetchDone = true
          setStore('loading', false)
        }
      } catch (err: unknown) {
        if (cancelled || version !== fetchVersion) {
          return
        }

        setStore('error', err)

        if (!initialFetchDone) {
          initialFetchDone = true
          setStore('loading', false)
        }
      }
    }

    void fetch()

    const subscription = queryManager.watchCollection(collection).subscribe((ids) => {
      if (ids.includes(currentId)) {
        void fetch()
      }
    })

    return {
      cleanup() {
        cancelled = true
        subscription.unsubscribe()
        if (cacheKey !== undefined) {
          void queryManager.release(cacheKey)
        }
      },
    }
  }

  // createComputed runs synchronously (unlike createEffect which is deferred),
  // ensuring the initial fetch starts immediately and re-runs when id() changes.
  createComputed(() => {
    const currentId = id()
    currentSession?.cleanup()
    currentSession = startSession(currentId)
  })

  onCleanup(() => {
    currentSession?.cleanup()
  })

  return store
}
