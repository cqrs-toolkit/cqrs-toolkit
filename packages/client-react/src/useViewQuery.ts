/**
 * React hook for view queries.
 *
 * Subscribes to `watchView` for a registered cross-collection view and
 * exposes the rows as a snapshot. The `view` name is static (config-time
 * identifier); `params` and `page` are plain values — the hook diffs them
 * across renders and restarts the subscription when either changes.
 *
 * Holds every cache key the view resolves to for the subscription's lifetime.
 * On each emission, diffs `PagedViewResult.cacheKeys` against the
 * currently-held set: holds entries that are new, releases entries that have
 * left, leaves the overlap untouched. All remaining holds are released on
 * unmount.
 *
 * Companion to `client-solid`'s `createViewQuery`. See
 * `docs/projects/client-react/explorations/observable-lifetime-across-rerenders.md`
 * for the implementation discipline this hook follows.
 */

import type { CacheKeyIdentity, CqrsClient, EnqueueCommand, PageRange } from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Subscription } from 'rxjs'
import { useClient } from './context.js'
import type { Identifiable, ViewQueryParams, ViewQueryState, ViewQueryStatus } from './types.js'

/**
 * Subscribe to a view query, returning the snapshot state.
 *
 * Row identity follows each row's `id`. Items in `items` are returned
 * verbatim from the view's emission — consumers using `key={row.id}` in a
 * list will see standard React reconciliation.
 *
 * @param queryParams - Query parameters (view, params, page)
 * @returns Snapshot state with items, total, loading, state
 */
export function useViewQuery<TLink extends Link, T extends Identifiable, TParams = unknown>(
  queryParams: ViewQueryParams<TParams>,
): ViewQueryState<T> {
  const client = useClient<TLink>()

  const storeRef = useRef<ViewQuerySnapshotStore<T> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = new ViewQuerySnapshotStore<T>()
  }
  const store = storeRef.current

  // Held keys live across subscription restarts so an unchanged resolved set
  // diffs to nothing.
  const heldKeysRef = useRef<Map<string, CacheKeyIdentity<TLink>> | null>(null)
  if (heldKeysRef.current === null) {
    heldKeysRef.current = new Map<string, CacheKeyIdentity<TLink>>()
  }
  const heldKeys = heldKeysRef.current

  const sessionRef = useRef<ViewQuerySession<TLink, T, TParams> | null>(null)

  // Subscription lifecycle — restarts on `view` / `params` / `page` change.
  useEffect(() => {
    sessionRef.current?.destroy()
    sessionRef.current = null

    if (queryParams.params === undefined) {
      store.reset()
      return
    }

    sessionRef.current = new ViewQuerySession<TLink, T, TParams>(
      client,
      store,
      heldKeys,
      queryParams.view,
      queryParams.params,
      queryParams.page,
    )

    return () => {
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [client, store, heldKeys, queryParams.view, queryParams.params, queryParams.page])

  // Unmount-only: release every still-held key once the subscription is
  // already torn down. Ordered so a late emission can't slip in and re-hold
  // a key we're about to drop.
  useEffect(() => {
    return () => {
      sessionRef.current?.destroy()
      sessionRef.current = null
      for (const uuid of heldKeys.keys()) {
        void client.queryManager.release(uuid)
      }
      heldKeys.clear()
    }
  }, [client, heldKeys])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

interface ViewQuerySnapshot<T extends Identifiable> {
  items: readonly T[]
  total: number | undefined
  loading: boolean
  state: ViewQueryStatus
}

function initialViewSnapshot<T extends Identifiable>(): ViewQuerySnapshot<T> {
  return {
    items: [],
    total: undefined,
    loading: true,
    state: { status: 'loading' },
  }
}

class ViewQuerySnapshotStore<T extends Identifiable> {
  private snapshot: ViewQuerySnapshot<T> = initialViewSnapshot<T>()
  private listeners = new Set<() => void>()

  subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  getSnapshot = (): ViewQuerySnapshot<T> => this.snapshot

  update(patch: Partial<ViewQuerySnapshot<T>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  reset(): void {
    this.snapshot = initialViewSnapshot<T>()
    for (const listener of this.listeners) listener()
  }
}

class ViewQuerySession<TLink extends Link, T extends Identifiable, TParams> {
  private cancelled = false
  private readonly subscription: Subscription

  constructor(
    private readonly client: CqrsClient<TLink, EnqueueCommand>,
    private readonly store: ViewQuerySnapshotStore<T>,
    private readonly heldKeys: Map<string, CacheKeyIdentity<TLink>>,
    view: string,
    params: TParams,
    page: PageRange | undefined,
  ) {
    this.store.reset()

    const observable = this.client.queryManager.watchView<T, TParams>({
      view,
      params,
      page,
    })

    this.subscription = observable.subscribe({
      next: (result) => {
        if (this.cancelled) return
        this.reconcileHolds(result.cacheKeys)
        this.store.update({
          items: result.data,
          total: result.total,
          state: { status: 'ready' },
          loading: false,
        })
      },
      error: (err: unknown) => {
        if (this.cancelled) return
        const message = err instanceof Error ? err.message : String(err)
        this.store.update({
          state: { status: 'error', error: message },
          loading: false,
        })
      },
    })
  }

  destroy(): void {
    this.cancelled = true
    this.subscription.unsubscribe()
  }

  private reconcileHolds(newKeys: readonly CacheKeyIdentity<TLink>[]): void {
    const newUuids = new Set<string>()
    for (const identity of newKeys) newUuids.add(identity.key)

    // Release keys that left the resolved set.
    for (const uuid of [...this.heldKeys.keys()]) {
      if (newUuids.has(uuid)) continue
      void this.client.queryManager.release(uuid)
      this.heldKeys.delete(uuid)
    }

    // Hold keys that entered the resolved set.
    for (const identity of newKeys) {
      if (this.heldKeys.has(identity.key)) continue
      void this.client.queryManager.hold(identity.key)
      this.heldKeys.set(identity.key, identity)
    }
  }
}
