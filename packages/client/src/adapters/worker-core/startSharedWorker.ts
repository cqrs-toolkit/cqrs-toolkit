/**
 * Entry point function for a SharedWorker (Mode C).
 *
 * The SharedWorker owns the full CQRS execution stack (WebSocket, CommandQueue,
 * SyncManager, EventProcessor). SQLite I/O is routed to the active tab's
 * DedicatedWorker via RemoteSqliteDb.
 *
 * Each tab spawns its own DedicatedWorker for SQLite and transfers a
 * MessagePort to this SharedWorker. Active tab election happens on the
 * main thread via Web Locks — the winning tab notifies this worker, which
 * points RemoteSqliteDb at the active tab's port.
 *
 * Tab changeover is a pure storage routing concern: WebSocket doesn't
 * reconnect, command queue doesn't pause, in-flight operations don't restart.
 *
 * The consumer writes a small worker file:
 * ```ts
 * import { startSharedWorker } from '@cqrs-toolkit/client'
 * import { cqrsConfig } from './cqrs-config'
 *
 * startSharedWorker(cqrsConfig)
 * ```
 */

/// <reference lib="webworker" />

import { createConsoleLogger, logProvider, type Link } from '@meticoeus/ddd-es'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { OpfsCommandFileStore } from '../../core/command-queue/file-store/OpfsCommandFileStore.js'
import { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import { deserialize } from '../../protocol/serialization.js'
import { DEFAULT_CONFIG, resolveConfig, type CqrsConfig } from '../../types/config.js'
import { EnqueueCommand } from '../../types/index.js'
import { WorkerOrchestrator } from './WorkerOrchestrator.js'
import { RemoteSqliteDb } from './sqlite-worker/RemoteSqliteDb.js'

/**
 * Window TTL for liveness detection (30 seconds).
 */
const WINDOW_TTL_MS = 30000

/**
 * Liveness check interval (10 seconds).
 */
const LIVENESS_CHECK_INTERVAL_MS = 10000

/**
 * Web Locks lock name for active-tab election (must match SharedWorkerAdapter).
 */
const ACTIVE_TAB_LOCK_NAME = 'cqrs-client-active-tab'

/**
 * Max retry attempts for remoteDb.initialize() during tab changeover.
 * OPFS handles from the old worker may not be released yet.
 */
const REMOTE_DB_INIT_MAX_ATTEMPTS = 3

/**
 * Linear backoff step for remoteDb.initialize() retries (milliseconds).
 * Attempt 1: 500ms, attempt 2: 1000ms, attempt 3: 1500ms.
 */
const REMOTE_DB_INIT_BACKOFF_MS = 500

/**
 * Coordinator state machine.
 *
 * - `uninitialized`: No active tab has ever connected.
 * - `waiting-for-active`: Previously had an active tab, but it died.
 *   SQLite connection is stale — RPCs must not be served.
 * - `ready`: Active tab is live and SQLite connection is healthy.
 */
type CoordinatorState = 'uninitialized' | 'waiting-for-active' | 'ready'

/**
 * Coordinator message types sent from tabs to the SharedWorker.
 */
interface CoordinatorWorkerPortMessage {
  type: 'coordinator:worker-port'
  windowId: string
}

interface CoordinatorSetActiveMessage {
  type: 'coordinator:set-active'
  windowId: string
}

interface CoordinatorTabClosingMessage {
  type: 'coordinator:tab-closing'
  windowId: string
}

type CoordinatorMessage =
  | CoordinatorWorkerPortMessage
  | CoordinatorSetActiveMessage
  | CoordinatorTabClosingMessage

/**
 * Bootstrap a SharedWorker with CQRS orchestration.
 *
 * Creates the message handler, orchestrator, and coordinator logic for
 * managing per-tab SQLite workers and active tab routing.
 *
 * @param config - Shared CQRS config (same object the main thread uses)
 */
export function startSharedWorker<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(config: CqrsConfig<TLink, TCommand, TSchema, TEvent>): void {
  const self = globalThis as unknown as SharedWorkerGlobalScope

  // Set a default warn-level console logger so logProvider doesn't throw before consumer setup
  logProvider.setLogger(createConsoleLogger({ level: 'warn' }))

  // Surface uncaught errors — without this, worker crashes are silent
  self.addEventListener('error', (event) => {
    logProvider.log.error({ err: event.error }, '[shared-worker] Uncaught exception')
  })
  self.addEventListener('unhandledrejection', (event) => {
    logProvider.log.error({ reason: event.reason }, '[shared-worker] Unhandled rejection')
  })

  const resolved = resolveConfig(config)
  const messageHandler = new WorkerMessageHandler()
  const orchestrator = new WorkerOrchestrator<TLink, TCommand, TSchema, TEvent>(
    messageHandler,
    resolved,
  )

  // Per-tab SQLite worker ports: windowId → MessagePort to tab's DedicatedWorker
  const tabWorkerPorts = new Map<string, MessagePort>()

  // Active tab tracking
  let activeWindowId: string | undefined
  let remoteDb: RemoteSqliteDb | undefined
  let state: CoordinatorState = 'uninitialized'

  // Pending orchestrator.initialize requests waiting for first active tab
  const pendingInitCallbacks: Array<{
    resolve: () => void
    reject: (error: Error) => void
  }> = []

  // Register lifecycle methods
  messageHandler.registerMethod('orchestrator.initialize', async () => {
    if (state === 'ready') return
    return new Promise<void>((resolve, reject) => {
      pendingInitCallbacks.push({ resolve, reject })
    })
  })

  messageHandler.registerMethod('orchestrator.close', async () => {
    await orchestrator.close()
  })

  // Raw message hook: intercept coordinator protocol messages before standard handling.
  // These messages carry Transferable ports and use a separate serialization path.
  messageHandler.setRawMessageHook(
    (event: MessageEvent, port: MessagePort | undefined): boolean => {
      const raw = event.data
      const data = typeof raw === 'string' ? deserialize<CoordinatorMessage>(raw) : raw

      if (typeof data !== 'object' || data === null || typeof data.type !== 'string') {
        return false
      }

      const typed = data as { type: string }

      if (typed.type === 'coordinator:worker-port') {
        const msg = data as CoordinatorWorkerPortMessage
        const transferredPort = event.ports[0]
        if (transferredPort) {
          tabWorkerPorts.set(msg.windowId, transferredPort)
        }
        return true
      }

      if (typed.type === 'coordinator:set-active') {
        const msg = data as CoordinatorSetActiveMessage
        handleSetActive(msg.windowId).catch((err) => {
          logProvider.log.error({ err }, 'Failed to handle set-active')
        })
        return true
      }

      if (typed.type === 'coordinator:tab-closing') {
        const msg = data as CoordinatorTabClosingMessage
        handleTabClosing(msg.windowId)
        return true
      }

      return false
    },
  )

  /**
   * Handle a tab declaring itself as the active tab.
   */
  async function handleSetActive(windowId: string): Promise<void> {
    const workerPort = tabWorkerPorts.get(windowId)
    if (!workerPort) {
      logProvider.log.warn({ windowId }, 'Tab declared active but no worker port registered')
      return
    }

    activeWindowId = windowId

    if (state === 'uninitialized') {
      // First active tab: create RemoteSqliteDb and initialize orchestrator
      remoteDb = new RemoteSqliteDb(workerPort)
      await initializeRemoteDb(remoteDb)

      try {
        await orchestrator.initialize({
          externalDb: remoteDb,
          fileStore: new OpfsCommandFileStore(),
        })
        state = 'ready'

        // Resolve any pending orchestrator.initialize requests
        for (const pending of pendingInitCallbacks) {
          pending.resolve()
        }
        pendingInitCallbacks.length = 0
      } catch (err) {
        // Reject all pending init requests
        for (const pending of pendingInitCallbacks) {
          pending.reject(err instanceof Error ? err : new Error(String(err)))
        }
        pendingInitCallbacks.length = 0
        throw err
      }
    } else if (remoteDb) {
      // Subsequent active tab (or recovery from waiting-for-active): switch SQLite target.
      // Best-effort close on old port — helps release OPFS handles faster
      // if the old worker is still alive but slow to tear down.
      sendBestEffortClose(remoteDb)
      remoteDb.switchTarget(workerPort)
      await initializeRemoteDb(remoteDb)

      state = 'ready'

      // Resolve any pending orchestrator.initialize requests queued during waiting-for-active
      for (const pending of pendingInitCallbacks) {
        pending.resolve()
      }
      pendingInitCallbacks.length = 0
    }
  }

  /**
   * Handle a tab notifying it's closing.
   */
  function handleTabClosing(windowId: string): void {
    tabWorkerPorts.delete(windowId)
    // Release cache key holds immediately on graceful close (§10.4)
    // rather than waiting for heartbeat TTL to detect a dead window.
    messageHandler.removeWindow(windowId).catch((err) => {
      logProvider.log.error({ err, windowId }, 'Failed to release holds on tab close')
    })
    if (activeWindowId === windowId) {
      activeWindowId = undefined
      if (state === 'ready') {
        state = 'waiting-for-active'
      }
    }
  }

  // Start liveness check for dead windows
  setInterval(async () => {
    // Existing: clean up dead windows by heartbeat TTL
    const deadWindows = messageHandler.getDeadWindows(WINDOW_TTL_MS)
    for (const windowId of deadWindows) {
      messageHandler.removeWindow(windowId).catch((err) => {
        logProvider.log.error({ err }, 'Failed to remove dead window')
      })
      handleTabClosing(windowId)
    }

    // Detect active tab lock release (reliable even on crash/kill).
    // Web Locks are released when a context dies — responds within one
    // liveness interval instead of waiting for heartbeat TTL.
    if (activeWindowId && state === 'ready') {
      try {
        const snapshot = await navigator.locks.query()
        const lockHeld = snapshot.held?.some((lock) => lock.name === ACTIVE_TAB_LOCK_NAME) ?? false
        if (!lockHeld) {
          logProvider.log.info('Active tab lock released — resetting SQLite state')
          handleTabClosing(activeWindowId)
        }
      } catch {
        // navigator.locks.query() unavailable — fall back to heartbeat TTL
      }
    }
  }, LIVENESS_CHECK_INTERVAL_MS)

  // Handle connections
  self.onconnect = (event: MessageEvent) => {
    const port = event.ports[0]
    if (port) {
      messageHandler.handleConnect(port)
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Initialize RemoteSqliteDb with retry and linear backoff.
   *
   * OPFS file handles from the previous worker may not be released yet
   * when the new worker tries to open the database. Retrying covers
   * the brief gap between lock release and OPFS handle cleanup.
   */
  async function initializeRemoteDb(db: RemoteSqliteDb): Promise<void> {
    const dbName = resolved.storage.dbName ?? DEFAULT_CONFIG.storage.dbName
    const vfs = resolved.storage.vfs ?? 'opfs'

    for (let attempt = 1; attempt <= REMOTE_DB_INIT_MAX_ATTEMPTS; attempt++) {
      try {
        await db.initialize({ dbName, vfs })
        return
      } catch (err) {
        if (attempt === REMOTE_DB_INIT_MAX_ATTEMPTS) throw err
        const delay = attempt * REMOTE_DB_INIT_BACKOFF_MS
        logProvider.log.warn(
          { attempt, delay, err },
          'remoteDb.initialize() failed — retrying after backoff',
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Send a best-effort sqlite:close to the current port before switching targets.
   *
   * If the old worker is still alive (just slow to tear down), this helps
   * it release OPFS handles faster. The message is fire-and-forget because
   * the port may already be dead.
   */
  function sendBestEffortClose(db: RemoteSqliteDb): void {
    try {
      db.close().catch(() => {
        // Expected — port may be dead
      })
    } catch {
      // Synchronous postMessage failure — port is dead
    }
  }
}
