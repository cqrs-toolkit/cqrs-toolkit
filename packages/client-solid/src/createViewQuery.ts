/**
 * SolidJS reactive primitive for view queries.
 *
 * Subscribes to `watchView` for a registered cross-collection view and
 * exposes the rows as a reactive store. View name is static; params and
 * page can be reactive accessors so the query restarts when navigation or
 * filter state changes.
 *
 * Hold lifecycle is not auto-managed — `watchView` itself follows the
 * V1 assume-ambient cache-key contract. Consumers that want the underlying
 * data pinned for the duration of the query must hold the relevant cache
 * keys themselves (typically via `createScopeCacheKey` / `createEntityCacheKey`
 * + `client.queryManager.hold(key)` in a parent effect).
 *
 * Row reconciliation uses each row's `id` (via `_id` injection) for stable
 * `<For>` identity, matching `createListQuery`. View rows that don't carry
 * `id` (e.g. single-row aggregations) need a different primitive — this
 * one constrains `T extends Identifiable`.
 */

import type { PageRange } from '@cqrs-toolkit/client'
import { entityIdToString } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { createComputed, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { useClient } from './context.js'
import type { Identifiable, ViewQueryParams, ViewQueryState, ViewQueryStatus } from './types.js'

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

  const paramsAccessor: () => TParams | undefined =
    typeof queryParams.params === 'function'
      ? (queryParams.params as () => TParams | undefined)
      : () => queryParams.params as TParams
  const pageAccessor: () => PageRange | undefined =
    typeof queryParams.page === 'function'
      ? (queryParams.page as () => PageRange | undefined)
      : () => queryParams.page as PageRange | undefined

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

  onCleanup(() => {
    currentSession?.cleanup()
  })

  return store
}
