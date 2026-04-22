import { noop } from '#utils'
import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import { logProvider } from '@meticoeus/ddd-es'
import {
  Collection,
  CollectionWithFetchStreamEvents,
  FetchContext,
  isCollectionWithFetchStreamEvents,
} from '../../types/config.js'
import { EnqueueCommand } from '../../types/index.js'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { IWriteQueue } from '../write-queue/IWriteQueue.js'
import type { ApplyGapRepairOp } from '../write-queue/operations.js'
import type { IConnectivityManager } from './IConnectivityManager.js'

export interface GapRepairEntry<TLink extends Link> {
  event: IPersistedEvent
  cacheKeys: CacheKeyIdentity<TLink>[]
}

export interface GapRepairCoordinatorConfig<TLink extends Link> {
  getFetchContext: () => Promise<FetchContext>
  onInvalidated: (collectionName: string, cacheKeys: string[]) => void
  onProcessGapEvents: (entries: readonly GapRepairEntry<TLink>[]) => Promise<void>
}

/**
 * Coordinates gap detection and repair for WebSocket event streams.
 *
 * Owns the `repairing` guard set. Reads and writes the shared `knownRevisions`
 * map (owned by SyncManager) to detect revision discontinuities and drive repair.
 */
export class GapRepairCoordinator<TLink extends Link, TCommand extends EnqueueCommand> {
  private readonly getFetchContext: () => Promise<FetchContext>
  private readonly onInvalidated: (collectionName: string, cacheKeys: string[]) => void
  private readonly onProcessGapEvents: (entries: readonly GapRepairEntry<TLink>[]) => Promise<void>

  private readonly repairing = new Set<string>()

  constructor(
    private readonly knownRevisions: Map<string, bigint>,
    private readonly eventBus: EventBus<TLink>,
    private readonly eventCache: EventCache<TLink, TCommand>,
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
    private readonly collections: Collection<TLink>[],
    private readonly connectivity: IConnectivityManager<TLink>,
    private readonly writeQueue: IWriteQueue<TLink, TCommand>,
    config: GapRepairCoordinatorConfig<TLink>,
  ) {
    this.getFetchContext = config.getFetchContext
    this.onInvalidated = config.onInvalidated
    this.onProcessGapEvents = config.onProcessGapEvents

    this.writeQueue.register('apply-gap-repair', this.onApplyGapRepair.bind(this))
    this.writeQueue.registerEviction('apply-gap-repair', this.onApplyGapRepairEviction.bind(this))
  }

  /**
   * Restore known revisions from persisted read model tables.
   * Called before WS connects to prevent false-positive gap detection after page reload.
   */
  async restoreKnownRevisions(): Promise<void> {
    for (const collection of this.collections) {
      const entries = await this.readModelStore.getRevisionMap(collection.name)
      for (const entry of entries) {
        const streamId = collection.aggregate.getStreamId(entry.id)
        const revBigint = BigInt(entry.revision)
        const current = this.knownRevisions.get(streamId)
        if (current === undefined || revBigint > current) {
          this.knownRevisions.set(streamId, revBigint)
        }
      }
    }
  }

  /**
   * Check whether a Permanent event's revision is in order.
   * If a gap is detected, emits sync:gap-detected and triggers repair.
   * Returns true if the event is in order and the caller should continue processing,
   * false if a gap was detected or repair is already in flight.
   */
  checkAndRepairGap(
    event: IPersistedEvent,
    collectionName: string,
    cacheKeys: CacheKeyIdentity<TLink>[],
  ): 'no-gap' | 'has-gap' | 'invalidated' {
    // Default -1n represents "no stream" — the state before the first event (revision 0).
    const knownRevision = this.knownRevisions.get(event.streamId) ?? -1n
    const expectedRevision = knownRevision + 1n
    if (event.revision === expectedRevision) return 'no-gap'

    this.eventBus.emitDebug('sync:gap-detected', {
      streamId: event.streamId,
      expected: expectedRevision,
      received: event.revision,
    })

    const collection = this.collections.find((c) => c.name === collectionName)
    if (!isCollectionWithFetchStreamEvents(collection)) return 'invalidated'

    // Gap or out-of-order — event is already in GapBuffer from caching, trigger repair
    if (!this.repairing.has(event.streamId)) {
      this.repairStreamGap(collection, event.streamId, knownRevision, cacheKeys).catch(noop)
    }
    return 'has-gap'
  }

  /**
   * Clear repairing guard state. Called on session destruction.
   */
  reset(): void {
    this.repairing.clear()
  }

  /**
   * Repair a gap in a specific stream by fetching missing events from the server.
   */
  private async repairStreamGap(
    collection: CollectionWithFetchStreamEvents<TLink>,
    streamId: string,
    fromRevision: bigint,
    cacheKeys: CacheKeyIdentity<TLink>[],
  ): Promise<void> {
    this.repairing.add(streamId)
    this.eventBus.emitDebug('sync:gap-repair-started', { streamId, fromRevision })

    try {
      // Fetch events after the last known good revision (exclusive)
      const ctx = await this.getFetchContext()
      const events = await collection.fetchStreamEvents({
        ctx,
        streamId,
        afterRevision: fromRevision,
      })
      this.connectivity.reportContact()

      this.writeQueue
        .enqueue({
          type: 'apply-gap-repair',
          streamId,
          cacheKeys,
          events,
        })
        .catch(noop)
    } catch (error) {
      logProvider.log.error({ streamId, err: error }, 'Gap repair failed')
      // Network error — no op was enqueued, clear repairing so next WS event retries
      this.repairing.delete(streamId)
    }
  }

  /**
   * Write queue handler for apply-gap-repair.
   * Drains the gap buffer for a stream, processing events through EventProcessorRunner.
   * Clears the repairing guard on completion (including errors) so the next WS event can retry.
   */
  private async onApplyGapRepair(op: ApplyGapRepairOp<TLink>): Promise<void> {
    const { streamId, cacheKeys, events } = op
    try {
      // Cache fetched events with all active keys
      const sharedCacheKeys = cacheKeys.map((ck) => ck.key)
      await this.eventCache.cacheServerEventsWithKeys(
        events.map((event) => ({ event, cacheKeys: sharedCacheKeys })),
      )

      // Read the gap buffer for this stream — includes both the fetched
      // fill events (just cached above) and the original out-of-order
      // events that were cached by the WS drain's dedup pass when they
      // first arrived. The buffer is sorted by revision ascending.
      const buffered = this.eventCache.getBufferedEvents(streamId)
      if (buffered.length === 0) return

      // Route through the reconcile pipeline via the SyncManager callback.
      // The events are already cached; the reconcile's dedup pass will see
      // them as duplicates — the callback is responsible for bypassing
      // dedup (it calls reconcileFromWsEvents directly, not through
      // onReconcileWsEventsOp).
      const entries: GapRepairEntry<TLink>[] = buffered.map((entry) => ({
        event: entry.event,
        cacheKeys,
      }))
      await this.onProcessGapEvents(entries)

      const last = buffered[buffered.length - 1]
      if (last) {
        this.eventCache.clearGapBuffer(streamId, last.position)
        this.eventCache.setKnownPosition(streamId, last.position)
        this.knownRevisions.set(streamId, last.event.revision)
      }

      this.eventBus.emitDebug('sync:gap-repair-completed', {
        streamId,
        eventCount: events.length,
      })
    } finally {
      this.repairing.delete(streamId)
    }
  }

  private async onApplyGapRepairEviction(op: ApplyGapRepairOp<TLink>): Promise<void> {
    this.repairing.delete(op.streamId)
  }
}
