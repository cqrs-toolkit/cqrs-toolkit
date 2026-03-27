import type { IPersistedEvent, Link } from '@meticoeus/ddd-es'
import { logProvider } from '@meticoeus/ddd-es'
import type { Collection, FetchContext } from '../../types/config.js'
import type { EventCache } from '../event-cache/EventCache.js'
import type { EventProcessorRunner } from '../event-processor/index.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { ConnectivityManager } from './ConnectivityManager.js'
import { toParsedEvent } from './SyncManagerUtils.js'

export interface GapRepairCoordinatorConfig<TLink extends Link> {
  knownRevisions: Map<string, bigint>
  eventBus: EventBus<TLink>
  eventCache: EventCache<TLink>
  eventProcessor: EventProcessorRunner<TLink>
  readModelStore: ReadModelStore<TLink>
  collections: Collection<TLink>[]
  connectivity: ConnectivityManager<TLink>
  getFetchContext: () => Promise<FetchContext>
  onInvalidated: (collectionName: string, cacheKeys: string[]) => void
}

/**
 * Coordinates gap detection and repair for WebSocket event streams.
 *
 * Owns the `repairing` guard set. Reads and writes the shared `knownRevisions`
 * map (owned by SyncManager) to detect revision discontinuities and drive repair.
 */
export class GapRepairCoordinator<TLink extends Link> {
  private readonly knownRevisions: Map<string, bigint>
  private readonly eventBus: EventBus<TLink>
  private readonly eventCache: EventCache<TLink>
  private readonly eventProcessor: EventProcessorRunner<TLink>
  private readonly readModelStore: ReadModelStore<TLink>
  private readonly collections: Collection<TLink>[]
  private readonly connectivity: ConnectivityManager<TLink>
  private readonly getFetchContext: () => Promise<FetchContext>
  private readonly onInvalidated: (collectionName: string, cacheKeys: string[]) => void

  private readonly repairing = new Set<string>()

  constructor(config: GapRepairCoordinatorConfig<TLink>) {
    this.knownRevisions = config.knownRevisions
    this.eventBus = config.eventBus
    this.eventCache = config.eventCache
    this.eventProcessor = config.eventProcessor
    this.readModelStore = config.readModelStore
    this.collections = config.collections
    this.connectivity = config.connectivity
    this.getFetchContext = config.getFetchContext
    this.onInvalidated = config.onInvalidated
  }

  /**
   * Restore known revisions from persisted read model tables.
   * Called before WS connects to prevent false-positive gap detection after page reload.
   */
  async restoreKnownRevisions(): Promise<void> {
    for (const collection of this.collections) {
      if (!collection.getStreamId) continue
      const entries = await this.readModelStore.getRevisionMap(collection.name)
      for (const entry of entries) {
        const streamId = collection.getStreamId(entry.id)
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
  async checkAndRepairGap(
    event: IPersistedEvent,
    collectionName: string,
    cacheKeys: string[],
  ): Promise<boolean> {
    // Default -1n represents "no stream" — the state before the first event (revision 0).
    const expectedRevision = (this.knownRevisions.get(event.streamId) ?? -1n) + 1n

    if (event.revision !== expectedRevision) {
      this.eventBus.emitDebug('sync:gap-detected', {
        streamId: event.streamId,
        expected: expectedRevision,
        received: event.revision,
      })

      // Gap or out-of-order — event is already in GapBuffer from caching, trigger repair
      if (!this.repairing.has(event.streamId)) {
        await this.repairStreamGap(event.streamId, collectionName, cacheKeys)
      }
      return false
    }

    return true
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
    streamId: string,
    collectionName: string,
    cacheKeys: string[],
  ): Promise<void> {
    this.repairing.add(streamId)

    const gaps = this.eventCache.getStreamGaps(streamId)
    const firstGap = gaps[0]
    const fromRevision = firstGap?.fromPosition ?? -1n

    this.eventBus.emitDebug('sync:gap-repair-started', { streamId, fromRevision })

    try {
      const collection = this.collections.find((c) => c.name === collectionName)
      if (!collection?.fetchStreamEvents) {
        // No fetch method — process buffered events as-is (lossy but unblocked)
        await this.processBufferedEventsForStream(streamId, cacheKeys)
        this.eventBus.emitDebug('sync:gap-repair-completed', {
          streamId,
          eventCount: 0,
        })
        return
      }

      if (!firstGap) {
        this.eventBus.emitDebug('sync:gap-repair-completed', {
          streamId,
          eventCount: 0,
        })
        return
      }

      // Fetch events after the last known good revision (exclusive)
      const ctx = await this.getFetchContext()
      const events = await collection.fetchStreamEvents({
        ctx,
        streamId,
        afterRevision: firstGap.fromPosition,
      })
      this.connectivity.reportContact()

      // Cache fetched events with all active keys
      for (const evt of events) {
        await this.eventCache.cacheServerEvent(evt, { cacheKeys })
      }

      // Process all buffered events for this stream, for each active cache key
      await this.processBufferedEventsForStream(streamId, cacheKeys)

      this.eventBus.emitDebug('sync:gap-repair-completed', {
        streamId,
        eventCount: events.length,
      })
    } catch (error) {
      logProvider.log.error({ streamId, err: error }, 'Gap repair failed')
      // Events stay buffered — next WS event for this stream will retry
    } finally {
      this.repairing.delete(streamId)
    }
  }

  /**
   * Process all buffered events for a stream in revision order, for each active cache key.
   */
  private async processBufferedEventsForStream(
    streamId: string,
    cacheKeys: string[],
  ): Promise<void> {
    const buffered = this.eventCache.getBufferedEvents(streamId)
    let anyInvalidated = false

    for (const entry of buffered) {
      for (const cacheKey of cacheKeys) {
        const parsed = toParsedEvent(entry.event, cacheKey)
        const result = await this.eventProcessor.processEvent(parsed)
        if (result.invalidated) {
          anyInvalidated = true
        }
      }
    }

    const last = buffered[buffered.length - 1]
    if (last) {
      this.eventCache.clearGapBuffer(streamId, last.position)
      this.eventCache.setKnownPosition(streamId, last.position)

      // Update known revision from the last buffered event's revision
      this.knownRevisions.set(streamId, last.event.revision)
    }

    if (anyInvalidated) {
      const matchingCollections = this.collections.filter((c) => c.matchesStream(streamId))
      for (const collection of matchingCollections) {
        this.onInvalidated(collection.name, cacheKeys)
      }
    }
  }
}
