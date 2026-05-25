/**
 * SolidJS reactive primitive for list queries.
 */

import type {
  CacheKeyIdentity,
  CollectionSignal,
  ListFilter,
  ListParams,
  Sort,
} from '@cqrs-toolkit/client'
import { entityIdToString } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createComputed, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { useClient } from './context.js'
import type {
  Identifiable,
  ListQueryParams,
  ListQueryState,
  ListQueryStatus,
  ReconciledId,
} from './types.js'
import { isAccessor } from './utils.js'

interface ListQueryStore<T extends Identifiable> {
  items: T[]
  loading: boolean
  total: number | undefined
  hasLocalChanges: boolean
  state: ListQueryStatus
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
 * ### Reactive inputs
 *
 * `cacheKey`, `sort`, and `filter` all accept a reactive accessor, but
 * they fire on different scopes:
 *
 * - **`cacheKey` change → full session restart.** Cancels the in-flight
 *   fetch, unsubscribes the collection watcher, releases the held cache
 *   key, resets the store to `loading`, then starts fresh.
 * - **`sort` / `filter` change → in-session refetch only.** Re-runs
 *   `queryManager.list` with the new params against the *same* held cache
 *   key. The watcher stays attached and the key is never released, so a
 *   sort tweak doesn't tag along with the side effects of dropping a hold
 *   (WS topic resubscribe, invalidation reordering, reseed attempts on
 *   reacquire). Items stay visible across the refetch — `reconcile`
 *   replaces them when the new data arrives.
 *
 * Uses the CQRS client from context (via `useClient()`).
 *
 * @param params - Query parameters (collection, cacheKey, limit, offset, sort, filter)
 * @returns Reactive store with items, loading, total, hasLocalChanges, state, reconciled
 */
export function createListQuery<TLink extends Link, T extends Identifiable>(
  params: ListQueryParams<TLink>,
): ListQueryState<T> {
  const client = useClient<TLink>()
  const queryManager = client.queryManager
  const initialState: ListQueryStore<T> = {
    items: [],
    loading: true,
    total: undefined,
    hasLocalChanges: false,
    state: { status: 'loading' },
    reconciled: [],
  }

  const [store, setStore] = createStore<ListQueryStore<T>>(initialState)

  // Normalize each input to an accessor. Reads happen inside reactive
  // scopes below, where they're tracked per scope's intended granularity.
  const cacheKey = params.cacheKey
  const cacheKeyAccessor: () => CacheKeyIdentity<TLink> | undefined = isAccessor(cacheKey)
    ? cacheKey
    : () => cacheKey

  const sort = params.sort
  const sortAccessor: () => Sort | undefined = isAccessor(sort) ? sort : () => sort

  const filter = params.filter
  const filterAccessor: () => ListFilter | undefined = isAccessor(filter) ? filter : () => filter

  // Outer scope: cacheKey lifecycle.
  //
  // Tracks `cacheKeyAccessor()` only. The session — cache-key hold, the
  // watchCollection subscription, the in-flight fetch — is bound to this
  // scope. Solid disposes the inner computed and runs `onCleanup` on
  // re-run, so a cacheKey change cleanly tears down everything before
  // starting fresh.
  //
  // sort/filter changes are deliberately routed through the nested
  // computed below so they refetch without releasing the cache key.
  // Releasing a held key has visible side effects on the cache manager —
  // it can shuffle invalidation order, drop WS topic subscriptions, or
  // trigger reseed attempts on the next acquire — none of which a sort
  // or filter tweak should incur.
  createComputed(() => {
    const cacheKey = cacheKeyAccessor()

    // Reset the store on every session boundary, including the inactive
    // case (cacheKey === undefined).
    setStore('items', [])
    setStore('loading', true)
    setStore('total', undefined)
    setStore('hasLocalChanges', false)
    setStore('state', { status: 'loading' })
    setStore('reconciled', [])

    if (cacheKey === undefined) return

    // Session-local state. All closures below close over these.
    let resolvedCacheKey: string | undefined
    let fetchVersion = 0
    let cancelled = false
    let settled = false

    // Latest list-params snapshot for handleSignal-triggered refetches.
    // The inner computed below replaces this whenever sort/filter changes
    // (immutable swap so already-issued fetches keep their old snapshot
    // — defends against any QueryManager that reads params across awaits).
    let currentListParams: ListParams<TLink> = {
      collection: params.collection,
      cacheKey,
      hold: true,
      limit: params.limit,
      offset: params.offset,
    }

    async function fetch(listParams: ListParams<TLink>): Promise<void> {
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
        case 'session-reset':
          // Re-fetch data with the current sort/filter, then settle if
          // not already settled. Session reset arrives when the session
          // wipes data; re-fetch will return empty (or whatever the new
          // session populated by the time it runs).
          void fetch(currentListParams).then(() => {
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

    // Inner scope: sort/filter lifecycle.
    //
    // Tracks `sortAccessor()` and `filterAccessor()` only. On change,
    // rebuilds `currentListParams` (immutable swap) and refetches —
    // without releasing the cache key or unsubscribing the watcher.
    // The first run kicks off the initial fetch; the session is
    // otherwise inert until data arrives.
    createComputed(() => {
      currentListParams = {
        ...currentListParams,
        sort: sortAccessor(),
        filter: filterAccessor(),
      }
      void fetch(currentListParams)
    })

    // Subscribe to collection lifecycle signals.
    const subscription = queryManager.watchCollection(params.collection).subscribe(handleSignal)

    // Session teardown — runs on the next cacheKey change or component dispose.
    onCleanup(() => {
      cancelled = true
      subscription.unsubscribe()
      if (resolvedCacheKey !== undefined) {
        void queryManager.release(resolvedCacheKey)
      }
    })
  })

  return store
}
