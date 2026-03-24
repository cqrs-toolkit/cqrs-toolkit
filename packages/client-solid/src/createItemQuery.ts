/**
 * SolidJS reactive primitive for single-item queries.
 */

import type { IQueryManager, QueryManagerQueryOptions } from '@cqrs-toolkit/client'
import { createComputed, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type { Identifiable, ItemQueryOptions, ItemQueryState, ReconciledId } from './types.js'

interface ItemQueryStore<T extends Identifiable> {
  data: T | undefined
  loading: boolean
  hasLocalChanges: boolean
  error: unknown
  reconciledId: ReconciledId | undefined
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
 * Handles ID reconciliation transparently: if the tracked client ID was replaced
 * by a server-assigned ID, the query follows the new ID automatically and exposes
 * the mapping via `reconciledId`.
 *
 * @param queryManager - The query manager
 * @param collection - Collection name
 * @param id - Accessor returning the entity ID (reactive)
 * @param options - Query options (scope)
 * @returns Reactive store with data, loading, hasLocalChanges, error, reconciledId
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
    reconciledId: undefined,
  }

  const [store, setStore] = createStore<ItemQueryStore<T>>(initialState)

  let currentSession: Session | undefined
  // Tracks the effective ID across sessions. Updated when reconciliation changes
  // the tracking ID, so createComputed can skip redundant restarts.
  let effectiveTrackingId: string | undefined

  function startSession(initialId: string): Session {
    let cacheKey: string | undefined
    let fetchVersion = 0
    let cancelled = false
    let initialFetchDone = false
    // Mutable tracking ID: starts as the initial ID, updated on reconciliation.
    // The watchCollection subscription uses this to filter events.
    let trackingId = initialId

    const queryOptions: QueryManagerQueryOptions = { hold: true }
    if (options?.scope !== undefined) {
      queryOptions.scope = options.scope
    }

    setStore('data', undefined)
    setStore('loading', true)
    setStore('reconciledId', undefined)

    async function fetch(): Promise<void> {
      fetchVersion++
      const version = fetchVersion

      try {
        const result = await queryManager.getById<T>(collection, trackingId, queryOptions)

        if (cancelled || version !== fetchVersion) {
          return
        }

        if (cacheKey === undefined) {
          cacheKey = result.cacheKey
        }

        // Detect reconciliation: the storage returned an entry under a different ID
        // because the client ID was mapped to a server ID via getCommandIdMapping.
        if (
          result.data !== undefined &&
          result.meta &&
          result.meta.id !== trackingId &&
          result.meta.clientId === trackingId
        ) {
          trackingId = result.meta.id
          effectiveTrackingId = trackingId
          setStore('reconciledId', { clientId: initialId, serverId: result.meta.id })
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
      if (ids.includes(trackingId)) {
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
  // Skips restart if the ID already matches the effective tracking ID (e.g., after
  // reconciliation updated the tracking ID and then the parent prop caught up).
  createComputed(() => {
    const currentId = id()
    if (effectiveTrackingId === currentId) return
    currentSession?.cleanup()
    effectiveTrackingId = currentId
    currentSession = startSession(currentId)
  })

  onCleanup(() => {
    currentSession?.cleanup()
  })

  return store
}
