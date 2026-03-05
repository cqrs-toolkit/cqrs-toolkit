/**
 * Entry point function for a SharedWorker (Mode B).
 *
 * The consumer writes a small worker file that imports their shared config
 * and calls this function:
 *
 * ```ts
 * import { startSharedWorker } from '@cqrs-toolkit/client'
 * import { cqrsConfig } from './cqrs-config'
 *
 * startSharedWorker(cqrsConfig)
 * ```
 */

/// <reference lib="webworker" />

import { createConsoleLogger, logProvider } from '@meticoeus/ddd-es'
import { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { CqrsConfig } from '../../types/config.js'
import { resolveConfig } from '../../types/config.js'
import { WorkerOrchestrator } from './WorkerOrchestrator.js'

// Set a default warn-level console logger so logProvider doesn't throw before consumer setup
logProvider.setLogger(createConsoleLogger({ level: 'warn' }))

/**
 * Window TTL for liveness detection (30 seconds).
 */
const WINDOW_TTL_MS = 30000

/**
 * Liveness check interval (10 seconds).
 */
const LIVENESS_CHECK_INTERVAL_MS = 10000

/**
 * Bootstrap a SharedWorker with CQRS orchestration.
 *
 * Creates the message handler and orchestrator, sets up connection handling,
 * and starts liveness checks for dead windows. The main thread's adapter
 * calls `orchestrator.initialize` to trigger component creation, passing
 * the sqlite worker URL as an RPC argument.
 *
 * @param config - Shared CQRS config (same object the main thread uses)
 */
export function startSharedWorker(config: CqrsConfig): void {
  const resolved = resolveConfig(config)
  const messageHandler = new WorkerMessageHandler()
  new WorkerOrchestrator(messageHandler, resolved)

  const self = globalThis as unknown as SharedWorkerGlobalScope

  // Start liveness check for dead windows
  setInterval(() => {
    const deadWindows = messageHandler.getDeadWindows(WINDOW_TTL_MS)
    for (const windowId of deadWindows) {
      messageHandler.removeWindow(windowId).catch((err) => {
        logProvider.log.error({ err }, 'Failed to remove dead window')
      })
    }
  }, LIVENESS_CHECK_INTERVAL_MS)

  // Handle connections
  self.onconnect = (event: MessageEvent) => {
    const port = event.ports[0]
    if (port) {
      messageHandler.handleConnect(port)
    }
  }
}
