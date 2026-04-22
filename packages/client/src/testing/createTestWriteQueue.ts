/**
 * Shared test helper for creating a WriteQueue with proper cleanup.
 *
 * Creates the queue, pushes destroy to the cleanup array, and registers
 * no-op handlers for all op types except those owned by real components.
 */

import { noop } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import { vi } from 'vitest'
import { EventBus } from '../core/events/EventBus.js'
import { WriteQueueException } from '../core/write-queue/IWriteQueue.js'
import { WriteQueue } from '../core/write-queue/WriteQueue.js'
import type { WriteQueueOp } from '../core/write-queue/operations.js'
import { ALL_OP_TYPES } from '../core/write-queue/operations.js'
import type { EnqueueCommand } from '../types/index.js'

/**
 * Create a WriteQueue for tests with proper lifecycle management.
 *
 * @param eventBus - EventBus instance
 * @param cleanup - Cleanup array to push destroy callback to
 * @param ownedTypes - Op types registered by real components (skipped from no-op registration).
 *   Example: `['flush-cache-keys']` when CacheManager registers via `setWriteQueue`.
 */
export function createTestWriteQueue<TLink extends Link, TCommand extends EnqueueCommand>(
  eventBus: EventBus<TLink>,
  cleanup: (() => void)[],
  ownedTypes: WriteQueueOp<TLink, TCommand>['type'][] = [],
  params?: {
    handler?: (op: WriteQueueOp<TLink, TCommand>) => Promise<void>
    evictionHandler?: (op: WriteQueueOp<TLink, TCommand>, reason: WriteQueueException) => void
    onSessionReset?: ((reason: string) => Promise<void>) | 'unset'
  },
): WriteQueue<TLink, TCommand> {
  const writeQueue = new WriteQueue<TLink, TCommand>(eventBus)
  cleanup.push(() => writeQueue.destroy())
  if (params?.onSessionReset !== 'unset') {
    writeQueue.setSessionResetHandler(params?.onSessionReset ?? vi.fn(async () => {}))
  }
  const skip = new Set<string>(ownedTypes)
  const handler = params?.handler ?? vi.fn(async () => {})
  for (const type of ALL_OP_TYPES) {
    if (skip.has(type)) continue
    writeQueue.register(type, handler)
    writeQueue.registerEviction(type, params?.evictionHandler ?? noop)
  }
  return writeQueue
}
