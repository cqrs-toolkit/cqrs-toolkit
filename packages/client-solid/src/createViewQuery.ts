/**
 * SolidJS reactive primitive for view queries.
 *
 * Subscribes to `watchView` for a registered cross-collection view and
 * exposes the rows as a reactive store. View name is static; params and
 * page can be reactive accessors so the query restarts when navigation or
 * filter state changes.
 *
 * Holds every cache key the view resolves to for the subscription's
 * lifetime. On each emission, diffs `PagedViewResult.cacheKeys` against
 * the currently-held set: holds entries that are new, releases entries
 * that have left, leaves the overlap untouched. All remaining holds are
 * released on dispose.
 *
 * Row reconciliation uses each row's `id` (via `_id` injection) for stable
 * `<For>` identity. View rows that don't carry `id` (e.g. single-row
 * aggregations) need a different primitive — this one constrains
 * `T extends Identifiable`.
 */

import type { CacheKeyIdentity, PageRange } from '@cqrs-toolkit/client'
import { entityIdToString } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createComputed, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { useClient } from './context.js'
import type { Identifiable, ViewQueryParams, ViewQueryState, ViewQueryStatus } from './types.js'
import { isAccessor } from './utils.js'

interface ViewQueryStore<T extends Identifiable> {
  items: T[]
  total: number | undefined
  loading: boolean
  state: ViewQueryStatus
}

interface Session {
  cleanup: () => void
}

export function createViewQuery<TLink extends Link, T extends Identifiable, TParams = unknown>(
  queryParams: ViewQueryParams<TParams>,
): ViewQueryState<T> {
  const client = useClient<TLink>()
  const queryManager = client.queryManager

  const initialState: ViewQueryStore<T> = {
    items: [],
    total: undefined,
    loading: true,
    state: { status: 'loading' },
  }

  const [store, setStore] = createStore<ViewQueryStore<T>>(initialState)

  const params = queryParams.params
  const paramsAccessor: () => TParams | undefined = isAccessor(params) ? params : () => params

  const page = queryParams.page
  const pageAccessor: () => PageRange | undefined = isAccessor(page) ? page : () => page

  // Lives outside the session scope so holds persist across subscription
  // restarts; an unchanged resolved set diffs to nothing.
  const heldKeys = new Map<string, CacheKeyIdentity<TLink>>()

  function reconcileHolds(newKeys: readonly CacheKeyIdentity<TLink>[]): void {
    const newUuids = new Set<string>()
    for (const identity of newKeys) newUuids.add(identity.key)

    // Release keys that left the resolved set.
    for (const uuid of [...heldKeys.keys()]) {
      if (newUuids.has(uuid)) continue
      void queryManager.release(uuid)
      heldKeys.delete(uuid)
    }

    // Hold keys that entered the resolved set.
    for (const identity of newKeys) {
      if (heldKeys.has(identity.key)) continue
      void queryManager.hold(identity.key)
      heldKeys.set(identity.key, identity)
    }
  }

  let currentSession: Session | undefined

  function startSession(params: TParams, page: PageRange | undefined): Session {
    let cancelled = false

    // Reset store for the new session.
    setStore('items', [])
    setStore('total', undefined)
    setStore('loading', true)
    setStore('state', { status: 'loading' })

    const observable = queryManager.watchView<T, TParams>({
      view: queryParams.view,
      params,
      page,
    })

    const subscription = observable.subscribe({
      next: (result) => {
        if (cancelled) return
        reconcileHolds(result.cacheKeys)
        // Inject `_id` as a plain string for `reconcile` keying; EntityRef
        // ids are objects and break strict-equality matching.
        const items = result.data.map((row) => ({
          ...row,
          _id: entityIdToString(row.id),
        }))
        setStore('items', reconcile(items, { key: '_id', merge: true }))
        setStore('total', result.total)
        setStore('state', { status: 'ready' })
        setStore('loading', false)
      },
      error: (err: unknown) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        setStore('state', { status: 'error', error: message })
        setStore('loading', false)
      },
    })

    return {
      cleanup() {
        cancelled = true
        subscription.unsubscribe()
      },
    }
  }

  // Synchronous reactive boundary — `createComputed` (not `createEffect`)
  // so the initial subscription kicks off without a deferred tick. Re-runs
  // whenever `params` or `page` accessors change.
  createComputed(() => {
    const params = paramsAccessor()
    const page = pageAccessor()
    currentSession?.cleanup()
    currentSession = undefined

    if (params === undefined) {
      setStore('items', [])
      setStore('total', undefined)
      setStore('loading', true)
      setStore('state', { status: 'loading' })
      return
    }

    currentSession = startSession(params, page)
  })

  // Tear down the subscription before releasing — once `cancelled` is set,
  // a late emission can't slip in and re-hold a key we're about to drop.
  onCleanup(() => {
    currentSession?.cleanup()
    for (const uuid of heldKeys.keys()) {
      void queryManager.release(uuid)
    }
    heldKeys.clear()
  })

  return store
}
