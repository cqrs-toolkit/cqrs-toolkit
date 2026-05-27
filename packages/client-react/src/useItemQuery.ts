/**
 * React hook for single-item queries.
 *
 * Companion to `client-solid`'s `createItemQuery`. Preserves the same
 * id-reconciliation behaviour: when the tracked client ID is replaced by a
 * server-assigned ID, the session follows the new ID transparently without
 * tearing down the cache-key hold or the watchCollection subscription. The
 * `reconciledId` field exposes the mapping for consumers holding the old ID
 * externally.
 *
 * See `docs/projects/client-react/explorations/observable-lifetime-across-rerenders.md`
 * for the implementation discipline this hook follows.
 */

import {
  entityIdToString,
  type CacheKeyIdentity,
  type CqrsClient,
  type EnqueueCommand,
  type LibraryEvent,
} from '@cqrs-toolkit/client'
import type { Link } from '@meticoeus/ddd-es'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { filter, map, merge, type Subscription } from 'rxjs'
import { useClient } from './context.js'
import type { Identifiable, ItemQueryParams, ItemQueryState, ReconciledId } from './types.js'

/**
 * Subscribe to a single-item query, returning the snapshot state.
 *
 * Fetches the item immediately, subscribes to `watchCollection` filtered by
 * the target ID, and refetches on matching updates.
 *
 * Handles ID reconciliation transparently: if the tracked client ID was
 * replaced by a server-assigned ID, the query follows the new ID
 * automatically and exposes the mapping via `reconciledId`. When the parent
 * component eventually re-renders with the new server ID as the prop, the
 * hook detects that its session is already tracking that ID and skips
 * restart — the cache-key hold is preserved through the transition.
 *
 * @param params - Query parameters (collection, id, cacheKey)
 * @returns Snapshot state with data, loading, hasLocalChanges, error, reconciledId
 */
export function useItemQuery<TLink extends Link, T extends Identifiable>(
  params: ItemQueryParams<TLink>,
): ItemQueryState<T> {
  const client = useClient<TLink>()

  const storeRef = useRef<ItemQuerySnapshotStore<T> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = new ItemQuerySnapshotStore<T>()
  }
  const store = storeRef.current

  const sessionRef = useRef<ItemQuerySession<TLink, T> | null>(null)

  // Per-render reconciler — runs after every render. Compares the current
  // session's tracked inputs against the latest props and only restarts the
  // session when they truly differ. Returning no cleanup is deliberate; the
  // unmount effect below owns teardown. This is what lets a transparent
  // reconciliation (client temp ID -> server ID) survive without restarting
  // the session: once the session updates its internal `effectiveId`, the
  // next render's prop catches up and this reconciler sees a match.
  useEffect(() => {
    const targetIdRaw = params.id
    const targetId = typeof targetIdRaw === 'undefined' ? undefined : entityIdToString(targetIdRaw)
    const targetCacheKey = params.cacheKey

    const current = sessionRef.current
    if (
      current !== null &&
      current.effectiveId === targetId &&
      current.cacheKey === targetCacheKey
    ) {
      return
    }

    if (current !== null) {
      current.destroy()
      sessionRef.current = null
    }
    store.reset()

    if (targetCacheKey === undefined || targetId === undefined) return

    sessionRef.current = new ItemQuerySession<TLink, T>(
      client,
      store,
      params.collection,
      targetId,
      targetCacheKey,
    )
  })

  // Unmount-only teardown — destroys the session and releases the held key.
  useEffect(() => {
    return () => {
      sessionRef.current?.destroy()
      sessionRef.current = null
    }
  }, [])

  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

interface ItemQuerySnapshot<T extends Identifiable> {
  data: T | undefined
  loading: boolean
  hasLocalChanges: boolean
  error: unknown
  reconciledId: ReconciledId | undefined
}

function initialItemSnapshot<T extends Identifiable>(): ItemQuerySnapshot<T> {
  return {
    data: undefined,
    loading: true,
    hasLocalChanges: false,
    error: undefined,
    reconciledId: undefined,
  }
}

class ItemQuerySnapshotStore<T extends Identifiable> {
  private snapshot: ItemQuerySnapshot<T> = initialItemSnapshot<T>()
  private listeners = new Set<() => void>()

  subscribe = (callback: () => void): (() => void) => {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  getSnapshot = (): ItemQuerySnapshot<T> => this.snapshot

  update(patch: Partial<ItemQuerySnapshot<T>>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener()
  }

  reset(): void {
    this.snapshot = initialItemSnapshot<T>()
    for (const listener of this.listeners) listener()
  }
}

class ItemQuerySession<TLink extends Link, T extends Identifiable> {
  private cancelled = false
  private initialFetchDone = false
  private fetchVersion = 0
  private resolvedCacheKey: string | undefined
  /** The currently-tracked ID. Mutated when reconciliation lands. */
  private trackingId: string
  /**
   * The ID the hook's reconciler checks against to decide whether a render
   * needs a session restart. Same as `trackingId` after every internal
   * change.
   */
  effectiveId: string
  readonly cacheKey: CacheKeyIdentity<TLink>
  private readonly initialId: string
  private readonly subscription: Subscription

  constructor(
    private readonly client: CqrsClient<TLink, EnqueueCommand>,
    private readonly store: ItemQuerySnapshotStore<T>,
    private readonly collection: string,
    initialId: string,
    cacheKey: CacheKeyIdentity<TLink>,
  ) {
    this.initialId = initialId
    this.trackingId = initialId
    this.effectiveId = initialId
    this.cacheKey = cacheKey

    void this.fetch()

    // Collection-updated signals that hit the tracked ID trigger a refetch.
    // ID-reconciled events update the tracked ID first, then refetch.
    const collectionUpdates$ = this.client.queryManager.watchCollection(this.collection).pipe(
      filter(
        (signal) =>
          (signal.type === 'updated' && signal.ids.includes(this.trackingId)) ||
          signal.type === 'session-reset',
      ),
      map(() => 'refetch' as const),
    )

    type IdReconciledEvent = LibraryEvent<TLink, 'readmodel:id-reconciled'>
    const idReconciled$ = this.client.events$.pipe(
      filter((e): e is IdReconciledEvent => e.type === 'readmodel:id-reconciled'),
      filter((e) => e.data.collection === this.collection && e.data.clientId === this.trackingId),
      map((e) => {
        this.trackingId = e.data.serverId
        this.effectiveId = e.data.serverId
        this.store.update({
          reconciledId: { clientId: this.initialId, serverId: e.data.serverId },
        })
        return 'refetch' as const
      }),
    )

    this.subscription = merge(collectionUpdates$, idReconciled$).subscribe(() => {
      void this.fetch()
    })
  }

  destroy(): void {
    this.cancelled = true
    this.subscription.unsubscribe()
    if (this.resolvedCacheKey !== undefined) {
      void this.client.queryManager.release(this.resolvedCacheKey)
    }
  }

  private async fetch(): Promise<void> {
    this.fetchVersion++
    const version = this.fetchVersion

    try {
      const result = await this.client.queryManager.getById<T>({
        collection: this.collection,
        id: this.trackingId,
        cacheKey: this.cacheKey,
        hold: true,
      })

      if (this.cancelled || version !== this.fetchVersion) return

      if (this.resolvedCacheKey === undefined) {
        this.resolvedCacheKey = result.cacheKey.key
      }

      // Detect reconciliation surfaced by storage: the returned meta has a
      // different id than what we asked for, with our id in clientId.
      if (
        result.data !== undefined &&
        result.meta &&
        result.meta.id !== this.trackingId &&
        result.meta.clientId === this.trackingId
      ) {
        this.trackingId = result.meta.id
        this.effectiveId = result.meta.id
        this.store.update({
          reconciledId: { clientId: this.initialId, serverId: result.meta.id },
        })
      }

      this.store.update({
        data: result.data,
        hasLocalChanges: result.hasLocalChanges,
        error: undefined,
      })

      if (!this.initialFetchDone) {
        this.initialFetchDone = true
        this.store.update({ loading: false })
      }
    } catch (err: unknown) {
      if (this.cancelled || version !== this.fetchVersion) return

      this.store.update({ error: err })

      if (!this.initialFetchDone) {
        this.initialFetchDone = true
        this.store.update({ loading: false })
      }
    }
  }
}
