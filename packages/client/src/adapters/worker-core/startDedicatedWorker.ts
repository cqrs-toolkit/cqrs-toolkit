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

import { type Link, createConsoleLogger, logProvider } from '@meticoeus/ddd-es'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { OpfsCommandFileStore } from '../../core/command-queue/file-store/OpfsCommandFileStore.js'
import { WorkerMessageHandler } from '../../protocol/MessageChannel.js'
import type { CqrsConfig } from '../../types/config.js'
import { resolveConfig } from '../../types/config.js'
import { EnqueueCommand } from '../../types/index.js'
import { WorkerOrchestrator } from './WorkerOrchestrator.js'

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
export function startDedicatedWorker<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(config: CqrsConfig<TLink, TCommand, TSchema, TEvent>): void {
  const self = globalThis as unknown as DedicatedWorkerGlobalScope

  // Set a default warn-level console logger so logProvider doesn't throw before consumer setup
  logProvider.setLogger(createConsoleLogger({ level: 'warn' }))

  // Surface uncaught errors — without this, worker crashes are silent
  self.addEventListener('error', (event) => {
    logProvider.log.error({ err: event.error }, '[dedicated-worker] Uncaught exception')
  })
  self.addEventListener('unhandledrejection', (event) => {
    logProvider.log.error({ reason: event.reason }, '[dedicated-worker] Unhandled rejection')
  })

  const resolved = resolveConfig(config)
  const messageHandler = new WorkerMessageHandler()
  const orchestrator = new WorkerOrchestrator<TLink, TCommand, TSchema, TEvent>(
    messageHandler,
    resolved,
  )

  // Register Mode B lifecycle methods
  messageHandler.registerMethod('orchestrator.initialize', async () => {
    await orchestrator.initialize({ fileStore: new OpfsCommandFileStore() })
  })
  messageHandler.registerMethod('orchestrator.close', async () => {
    await orchestrator.close()
  })

  // Handle messages from the main thread
  self.onmessage = (event: MessageEvent) => {
    messageHandler.handleMessageEvent(event)
  }

  // Send worker-instance on startup (delivered async via postMessage,
  // arrives after the window's channel.connect() sets up its listener)
  messageHandler.sendWorkerInstance()
}
