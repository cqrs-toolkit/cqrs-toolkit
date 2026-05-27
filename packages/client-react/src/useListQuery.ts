/**
 * React hook for list queries.
 *
 * Companion to `client-solid`'s `createListQuery`. Same session lifecycle
 * semantics, translated to React idioms. See
 * `docs/projects/client-react/explorations/observable-lifetime-across-rerenders.md`
 * for the implementation discipline this hook follows.
 */

import type {
  CacheKeyIdentity,
  CollectionSignal,
  CqrsClient,
  EnqueueCommand,
  ListFilter,
  ListParams,
  Sort,
} from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { Subscription } from 'rxjs'
import { useClient } from './context.js'
import type {
  Identifiable,
  ListQueryParams,
  ListQueryState,
  ListQueryStatus,
  ReconciledId,
} from './types.js'

/**
 * Subscribe to a list query, returning the snapshot state.
 *
 * Fetches the collection immediately, subscribes to `watchCollection`, and
 * refetches on each update.
 *
 * ### Reactive scopes
 *
 * - **`cacheKey` change → full session restart.** Tears down the watcher,
 *   releases the held cache key, resets the snapshot to `loading`, starts
 *   a new session.
 * - **`sort` / `filter` change → in-session refetch only.** Re-runs
 *   `queryManager.list` against the *same* held cache key. The watcher stays
 *   attached and the key is never released.
 *
 * The `reconciled` field exposes any client-id → server-id mappings the
 * latest fetch surfaced — consumers holding entity IDs in component state
 * can react to maintain stable references. Unlike `client-solid`, the React
 * hook does not pre-mutate items to preserve component identity through
 * reconciliation; if you key list items by `id`, a reconciled entity will
 * remount. Use the `reconciled` mappings (or key by a stable consumer-side
 * id) if that matters for your UI.
 *
 * @param params - Query parameters (collection, cacheKey, limit, offset, sort, filter)
 * @returns Snapshot state with items, loading, total, hasLocalChanges, state, reconciled
 */
export function useListQuery<TLink extends Link, T extends Identifiable>(
  params: ListQueryParams<TLink>,
): ListQueryState<T> {
  const client = useClient<TLink>()

  const storeRef = useRef<ListQuerySnapshotStore<T> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = new ListQuerySnapshotStore<T>()
  }
  const store = storeRef.current

  const sessionRef = useRef<ListQuerySession<TLink, T> | null>(null)

  // Latest sort/filter held in refs so the cacheKey effect can read them
  // without depending on them — that's what keeps a sort change from
  // restarting the session.
  const latestSortRef = useRef(params.sort)
  latestSortRef.current = params.sort
  const latestFilterRef = useRef(params.filter)
  latestFilterRef.current = params.filter

  // cacheKey scope: session lifecycle. The cleanup releases the held key
  // and unsubscribes the watcher; only cacheKey change or unmount triggers
  // this effect.
  useEffect(() => {
    store.reset()

    if (params.cacheKey === undefined) {
      sessionRef.current = null
      return
    }

    const session = new ListQuerySession<TLink, T>(
      client,
      store,
      params.collection,
      params.cacheKey,
      params.limit,
      params.offset,
      latestSortRef.current,
      latestFilterRef.current,
    )
    sessionRef.current = session

    return () => {
      sessionRef.current = null
      session.destroy()
    }
    // The collection / limit / offset are session-scope inputs (per Solid
    // parity). Changing them does NOT restart the session — only cacheKey
    // does. Consumers paginating across pages should change cacheKey to
    // match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.cacheKey, client, store])

  // sort / filter scope: in-session refetch.
  useEffect(() => {
    sessionRef.current?.applyParams(params.sort, params.filter)
  }, [params.sort, params.filter])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

interface ListQuerySnapshot<T extends Identifiable> {
  items: readonly T[]
  loading: boolean
  total: number | undefined
  hasLocalChanges: boolean
  state: ListQueryStatus
  reconciled: readonly ReconciledId[]
}

function initialSnapshot<T extends Identifiable>(): ListQuerySnapshot<T> {
  return {
    items: [],
    loading: true,
    total: undefined,
    hasLocalChanges: false,
    state: { status: 'loading' },
    reconciled: [],
  }
}

class ListQuerySnapshotStore<T extends Identifiable> {
  private snapshot: ListQuerySnapshot<T> = initialSnapshot<T>()
  private listeners = new Set<() => void>()

  subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  getSnapshot = (): ListQuerySnapshot<T> => this.snapshot

  update(patch: Partial<ListQuerySnapshot<T>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  reset(): void {
    this.snapshot = initialSnapshot<T>()
    for (const listener of this.listeners) listener()
  }
}

class ListQuerySession<TLink extends Link, T extends Identifiable> {
  private cancelled = false
  private settled = false
  private fetchVersion = 0
  private resolvedCacheKey: string | undefined
  private currentListParams: ListParams<TLink>
  private readonly subscription: Subscription

  constructor(
    private readonly client: CqrsClient<TLink, EnqueueCommand>,
    private readonly store: ListQuerySnapshotStore<T>,
    collection: string,
    cacheKey: CacheKeyIdentity<TLink>,
    limit: number | undefined,
    offset: number | undefined,
    initialSort: Sort | undefined,
    initialFilter: ListFilter | undefined,
  ) {
    this.currentListParams = {
      collection,
      cacheKey,
      hold: true,
      limit,
      offset,
      sort: initialSort,
      filter: initialFilter,
    }
    this.subscription = this.client.queryManager
      .watchCollection(collection)
      .subscribe((signal) => this.handleSignal(signal))
    void this.fetch(this.currentListParams)
  }

  applyParams(sort: Sort | undefined, filter: ListFilter | undefined): void {
    if (this.cancelled) return
    if (this.currentListParams.sort === sort && this.currentListParams.filter === filter) return
    this.currentListParams = {
      ...this.currentListParams,
      sort,
      filter,
    }
    void this.fetch(this.currentListParams)
  }

  destroy(): void {
    this.cancelled = true
    this.subscription.unsubscribe()
    if (this.resolvedCacheKey !== undefined) {
      void this.client.queryManager.release(this.resolvedCacheKey)
    }
  }

  private async fetch(listParams: ListParams<TLink>): Promise<void> {
    this.fetchVersion++
    const version = this.fetchVersion

    try {
      const result = await this.client.queryManager.list<T>(listParams)

      if (this.cancelled || version !== this.fetchVersion) return

      if (this.resolvedCacheKey === undefined) {
        this.resolvedCacheKey = result.cacheKey.key
      }

      // clientId -> serverId map from items that have been reconciled.
      const idRemaps = new Map<string, string>()
      for (const m of result.meta) {
        if (m.clientId && m.clientId !== m.id) {
          idRemaps.set(m.clientId, m.id)
        }
      }

      const reconciled: ReconciledId[] = []
      for (const [clientId, serverId] of idRemaps) {
        reconciled.push({ clientId, serverId })
      }

      this.store.update({
        items: result.data,
        total: result.total,
        hasLocalChanges: result.hasLocalChanges,
        reconciled,
      })

      if (!this.settled) {
        if (result.data.length > 0) {
          this.settle()
        } else {
          this.store.update({ state: { status: 'seeding' } })
        }
      }
    } catch (err: unknown) {
      if (this.cancelled || version !== this.fetchVersion) return

      if (!this.settled) {
        this.settled = true
        const message = err instanceof Error ? err.message : String(err)
        this.store.update({ state: { status: 'seed-failed', error: message }, loading: false })
      }
      // Already settled: transient fetch errors don't change state.
    }
  }

  private settle(): void {
    this.settled = true
    this.store.update({ state: { status: 'ready' }, loading: false })
  }

  private handleSignal(signal: CollectionSignal): void {
    if (this.cancelled) return

    switch (signal.type) {
      case 'updated':
      case 'seed-completed':
      case 'session-reset':
        void this.fetch(this.currentListParams).then(() => {
          if (!this.cancelled && !this.settled) {
            this.settle()
          }
        })
        break

      case 'sync-failed':
        if (!this.settled) {
          this.settled = true
          this.store.update({
            state: { status: 'seed-failed', error: signal.error },
            loading: false,
          })
        } else if (this.store.getSnapshot().state.status !== 'seed-failed') {
          this.store.update({ state: { status: 'sync-failed', error: signal.error } })
        }
        break
    }
  }
}
