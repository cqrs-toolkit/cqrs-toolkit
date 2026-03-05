/**
 * Entry point function for a Dedicated Worker (Mode B).
 *
 * The consumer writes a small worker file that imports their shared config
 * and calls this function:
 *
 * ```ts
 * import { startDedicatedWorker } from '@cqrs-toolkit/client'
 * import { cqrsConfig } from './cqrs-config'
 *
 * startDedicatedWorker(cqrsConfig)
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
 * Bootstrap a Dedicated Worker with CQRS orchestration.
 *
 * Creates the message handler and orchestrator, registers lifecycle RPC
 * methods, sets up message handling, and signals readiness to the main
 * thread. The main thread's adapter calls `orchestrator.initialize` to
 * trigger component creation (includes OPFS probe for Mode B).
 *
 * @param config - Shared CQRS config (same object the main thread uses)
 */
export function startDedicatedWorker(config: CqrsConfig): void {
  const resolved = resolveConfig(config)
  const messageHandler = new WorkerMessageHandler()
  const orchestrator = new WorkerOrchestrator(messageHandler, resolved)

  // Register Mode B lifecycle methods
  messageHandler.registerMethod('orchestrator.initialize', async () => {
    await orchestrator.initialize() // No external DB — probes OPFS, creates local
  })
  messageHandler.registerMethod('orchestrator.close', async () => {
    await orchestrator.close()
  })

  const self = globalThis as unknown as DedicatedWorkerGlobalScope

  // Handle messages from the main thread
  self.onmessage = (event: MessageEvent) => {
    messageHandler.handleMessageEvent(event)
  }

  // Send worker-instance on startup (delivered async via postMessage,
  // arrives after the window's channel.connect() sets up its listener)
  messageHandler.sendWorkerInstance()
}
