/**
 * Shared integration test helpers.
 *
 * Provides the {@link TestSyncManager} (network layer mock), the {@link createRun}
 * factory that wraps each test with per-test bootstrap/teardown and an
 * internal timeout, {@link integrationTestOptions} (vitest test options every
 * integration `it(...)` should pass to keep the test-level timeout longer than
 * the internal one), and the {@link bootstrapVariants} matrix that test files
 * iterate to run against each wiring path.
 */

import type { IPersistedEvent, ServiceLink } from '@meticoeus/ddd-es'
import { filter, firstValueFrom, type Subscription } from 'rxjs'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { SyncManager } from '../../core/sync-manager/SyncManager.js'
import type { EnqueueCommand } from '../../types/commands.js'
import type { LibraryEvent } from '../../types/events.js'
import { formatEventBusTimeline } from '../fixtures/formatEventBusTimeline.js'
import { testEventBusLogger } from '../testLogger.js'
import {
  bootstrapOnlineOnly,
  bootstrapWorkerSide,
  type IntegrationBootstrapConfig,
  type IntegrationContext,
} from './bootstrap.js'

// ---------------------------------------------------------------------------
// TestSyncManager — mocks the network layer (WS event arrivals)
// ---------------------------------------------------------------------------

export interface InjectWsEventsEntry {
  event: IPersistedEvent
  topics?: string[]
}

export class TestSyncManager extends SyncManager<
  ServiceLink,
  EnqueueCommand,
  unknown,
  IAnticipatedEvent
> {
  /**
   * Simulate WS event arrivals through the real production path.
   * Resolves cache keys from topics, then calls `handleNewWsEvent` which
   * pushes to `pendingWsEvents` and schedules a `reconcile-ws-events` op
   * on the WriteQueue — identical to the real WS message handler.
   */
  injectWsEvents(items: readonly InjectWsEventsEntry[]): void {
    for (const { event, topics = [] } of items) {
      const cacheKeys = this.resolveCacheKeysFromTopics(event.streamId, topics)
      this.handleNewWsEvent(event, cacheKeys)
    }
  }
}

// ---------------------------------------------------------------------------
// Test context and run() helper
// ---------------------------------------------------------------------------

/**
 * Default internal timeout enforced by {@link createRun}. When the test
 * callback exceeds this, the helper dumps the EventBus timeline and throws
 * so the failure message carries the full event history. Individual tests
 * can override via `timeoutMs` on their {@link IntegrationBootstrapConfig} —
 * prefer keeping the default and only overriding for tests that are
 * legitimately slow (e.g., intentional multi-second waits).
 */
const DEFAULT_INTEGRATION_RUN_TIMEOUT_MS = 5000

/**
 * Vitest test options for integration tests. Pass this as the options
 * argument to `it(name, integrationTestOptions, run(...))` so vitest's
 * test-level timeout is longer than {@link createRun}'s internal 5s timeout —
 * otherwise vitest fires first and the EventBus timeline is lost.
 */
export const integrationTestOptions = { timeout: 30000 } as const

export interface TestContext extends IntegrationContext {
  createPersistedEvent(
    type: string,
    streamId: string,
    data: Record<string, unknown>,
  ): IPersistedEvent

  /**
   * Inject WS events and wait for the reconcile to produce a readmodel:updated
   * emission containing the specified entity ID.
   */
  injectWsEventsAndWait(items: readonly InjectWsEventsEntry[], expectedId: string): Promise<void>
}

export function createRun(
  bootstrap: (config?: IntegrationBootstrapConfig) => Promise<IntegrationContext>,
) {
  return function run(
    config: IntegrationBootstrapConfig,
    cb: (ctx: TestContext) => Promise<void>,
  ): () => Promise<void> {
    return async () => {
      const ctx = await bootstrap(config)
      let eventIdCounter = 0
      const testSyncManager = ctx.syncManager as TestSyncManager

      // Record every library event the bus emits so we can dump a timeline
      // on test failure without having to sprinkle logs into production code.
      ctx.eventBus.debug = true
      const eventLog: LibraryEvent<ServiceLink>[] = []
      const eventSub: Subscription = ctx.eventBus.events$.subscribe((event) => {
        eventLog.push(event)
      })

      // Route logProvider through this run's bus so log lines interleave
      // with library events in the timeline. Cleared in `finally` so a
      // completed bus from this test can never receive emissions.
      testEventBusLogger.setSink(ctx.eventBus)

      const testCtx: TestContext = {
        ...ctx,
        createPersistedEvent(type, streamId, data) {
          eventIdCounter++
          return {
            id: `evt-${eventIdCounter}`,
            type,
            streamId,
            data: { ...data } as Record<string, unknown> & { readonly id: string },
            metadata: { correlationId: `corr-${eventIdCounter}` },
            revision: 0n,
            position: BigInt(eventIdCounter),
            persistence: 'Permanent',
            created: new Date().toISOString(),
          }
        },
        async injectWsEventsAndWait(items, expectedId) {
          const updated = firstValueFrom(
            ctx.eventBus
              .on('readmodel:updated')
              .pipe(filter((e) => e.data.ids.includes(expectedId))),
          )
          testSyncManager.injectWsEvents(items)
          await updated
        },
      }

      const timeoutMs = config.timeoutMs ?? DEFAULT_INTEGRATION_RUN_TIMEOUT_MS
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Integration test exceeded ${timeoutMs}ms internal timeout`)),
          timeoutMs,
        )
      })

      try {
        await Promise.race([cb(testCtx), timeoutPromise])
      } catch (err) {
        // eslint-disable-next-line no-console -- dumping event timeline on
        // integration test failure is more useful than the bare assertion
        console.error(formatEventBusTimeline(eventLog))
        throw err
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId)
        eventSub.unsubscribe()
        testEventBusLogger.setSink(undefined)
        await ctx.destroy()
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Bootstrap matrix — every test file uses this to run against all paths
// ---------------------------------------------------------------------------

/**
 * Two production-aligned wiring paths:
 * - `online-only` — main-thread wiring with {@link InMemoryStorage}
 * - `worker-side` — worker wiring with {@link SQLiteStorage} (via better-sqlite3)
 *
 * These mirror the two real storage configurations consumers ship — an earlier
 * third `'sql'` variant duplicated worker-side and was removed.
 */
export const bootstrapVariants = [
  { name: 'online-only', bootstrap: bootstrapOnlineOnly },
  { name: 'worker-side', bootstrap: bootstrapWorkerSide },
] as const
