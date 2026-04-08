/**
 * SolidJS reactive primitive for list queries.
 */

import type {
  CacheKeyIdentity,
  CollectionSignal,
  IQueryManager,
  ListParams,
} from '@cqrs-toolkit/client'
import { entityIdToString } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createComputed, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import type {
  Identifiable,
  ListQueryParams,
  ListQueryState,
  ListQueryStatus,
  ReconciledId,
} from './types.js'

interface ListQueryStore<T extends Identifiable> {
  items: T[]
  loading: boolean
  total: number
  hasLocalChanges: boolean
  state: ListQueryStatus
  reconciled: ReconciledId[]
}

interface Session {
  cleanup: () => void
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
 * The `cacheKey` parameter is required. When it is a reactive accessor,
 * the query re-subscribes when the cache key identity changes — releasing
 * the old key and resetting to loading state.
 *
 * @param queryManager - The query manager (should be StableRefQueryManager-wrapped for best results)
 * @param params - Query parameters (collection, cacheKey, limit, offset)
 * @returns Reactive store with items, loading, total, hasLocalChanges, state, reconciled
 */
export function createListQuery<TLink extends Link, T extends Identifiable>(
  queryManager: IQueryManager<TLink>,
  params: ListQueryParams<TLink>,
): ListQueryState<T> {
  const initialState: ListQueryStore<T> = {
    items: [],
    loading: true,
    total: 0,
    hasLocalChanges: false,
    state: { status: 'loading' },
    reconciled: [],
  }

  const [store, setStore] = createStore<ListQueryStore<T>>(initialState)

  // Normalize cacheKey to an accessor
  const cacheKeyAccessor: () => CacheKeyIdentity<TLink> | undefined =
    typeof params.cacheKey === 'function'
      ? params.cacheKey
      : () => params.cacheKey as CacheKeyIdentity<TLink>

  let currentSession: Session | undefined

  function startSession(cacheKey: CacheKeyIdentity<TLink>): Session {
    let resolvedCacheKey: string | undefined
    let fetchVersion = 0
    let cancelled = false
    let settled = false

    const listParams: ListParams<TLink> = {
      collection: params.collection,
      cacheKey,
      hold: true,
      limit: params.limit,
      offset: params.offset,
    }

    // Reset store to loading state for the new session
    setStore('items', [])
    setStore('loading', true)
    setStore('total', 0)
    setStore('hasLocalChanges', false)
    setStore('state', { status: 'loading' })
    setStore('reconciled', [])

    async function fetch(): Promise<void> {
      fetchVersion++
      const version = fetchVersion

      try {
        const result = await queryManager.list<T>(listParams)

        if (cancelled || version !== fetchVersion) {
          return
        }

        // Track cache key for release on cleanup
        if (resolvedCacheKey === undefined) {
          resolvedCacheKey = result.cacheKey.key
        }

        // Build clientId→serverId map from metadata for items that have been reconciled.
        // An item has been reconciled when its _clientMetadata.clientId differs from its id.
        const idRemaps = new Map<string, string>()
        for (const m of result.meta) {
          if (m.clientId && m.clientId !== m.id) {
            idRemaps.set(m.clientId, m.id)
          }
        }

        // Pre-mutate existing store items whose _id matches a reconciled clientId.
        // This makes reconcile() see the same item with the new _id — preserving
        // the Solid store object reference and <For> DOM node identity.
        if (idRemaps.size > 0) {
          for (const [i, item] of store.items.entries()) {
            const itemId = entityIdToString(item.id)
            const newId = idRemaps.get(itemId)
            if (typeof newId === 'string') {
              setStore('items', i, { ...item, id: newId, _id: newId } as T & { _id: string })
            }
          }
        }

        // Inject _id (always a plain string) for reconcile keying.
        // EntityRef ids are objects and break reconcile's strict equality check.
        const itemsWithKey = result.data.map((item) => ({
          ...item,
          _id: entityIdToString(item.id),
        }))
        setStore('items', reconcile(itemsWithKey, { key: '_id', merge: true }))
        setStore('total', result.total)
        setStore('hasLocalChanges', result.hasLocalChanges)

        // Expose reconciliation mappings for consumers holding entity IDs externally.
        const reconciled: ReconciledId[] = []
        for (const [clientId, serverId] of idRemaps) {
          reconciled.push({ clientId, serverId })
        }
        setStore('reconciled', reconciled)

        if (!settled) {
          if (result.data.length > 0) {
            // Restore path: local data available — settle immediately
            settle()
          } else {
            // Fresh path: no data yet — transition to seeding, wait for watchCollection
            setStore('state', { status: 'seeding' })
          }
        }
      } catch (err: unknown) {
        if (cancelled || version !== fetchVersion) {
          return
        }

        if (!settled) {
          // First fetch failed — seed-failed
          settled = true
          const message = err instanceof Error ? err.message : String(err)
          setStore('state', { status: 'seed-failed', error: message })
          setStore('loading', false)
        }
        // If already settled, fetch errors are transient — state stays as-is
      }
    }

    function settle(): void {
      settled = true
      setStore('state', { status: 'ready' })
      setStore('loading', false)
    }

    function handleSignal(signal: CollectionSignal): void {
      if (cancelled) return

      switch (signal.type) {
        case 'updated':
        case 'seed-completed':
          // Re-fetch data, then settle if not already settled
          void fetch().then(() => {
            if (!cancelled && !settled) {
              settle()
            }
          })
          break

        case 'sync-failed':
          if (!settled) {
            // First seed failed
            settled = true
            setStore('state', { status: 'seed-failed', error: signal.error })
            setStore('loading', false)
          } else if (store.state.status !== 'seed-failed') {
            // Subsequent sync failure — data is stale but preserved
            setStore('state', { status: 'sync-failed', error: signal.error })
          }
          break
      }
    }

    // Initial fetch
    void fetch()

    // Subscribe to collection lifecycle signals
    const subscription = queryManager.watchCollection(params.collection).subscribe(handleSignal)

    return {
      cleanup() {
        cancelled = true
        subscription.unsubscribe()
        if (resolvedCacheKey !== undefined) {
          void queryManager.release(resolvedCacheKey)
        }
      },
    }
  }

  // createComputed runs synchronously (unlike createEffect which is deferred),
  // ensuring the initial fetch starts immediately and re-runs when cacheKey changes.
  // When the accessor returns undefined, no session is active (loading state with no data).
  createComputed(() => {
    const cacheKey = cacheKeyAccessor()
    currentSession?.cleanup()
    currentSession = undefined

    if (cacheKey === undefined) {
      // No active query — show loading/empty state
      setStore('items', [])
      setStore('loading', true)
      setStore('total', 0)
      setStore('hasLocalChanges', false)
      setStore('state', { status: 'loading' })
      setStore('reconciled', [])
      return
    }

    currentSession = startSession(cacheKey)
  })

  onCleanup(() => {
    currentSession?.cleanup()
  })

  return store
}
