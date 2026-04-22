import type { IPersistedEvent, ServiceLink } from '@meticoeus/ddd-es'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestWriteQueue } from '../../testing/index.js'
import { EnqueueCommand } from '../../types/index.js'
import { deriveScopeKey } from '../cache-manager/index.js'
import { EventBus } from '../events/index.js'
import {
  SessionResetException,
  WriteQueueDestroyedException,
  WriteQueueException,
} from './IWriteQueue.js'
import type {
  ApplyGapRepairOp,
  ApplyRecordsOp,
  EvictCacheKeyOp,
  ReconcileWsEventsOp,
  WriteQueueOp,
} from './operations.js'

const DUMMY_EVENT = { id: 'evt-1' } as unknown as IPersistedEvent

const TODO_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

describe('WriteQueue', () => {
  let cleanup: (() => void)[] = []

  afterEach(() => {
    for (const fn of cleanup) fn()
    cleanup = []
  })

  describe('sequential execution', () => {
    it('processes items one at a time', async () => {
      const order: number[] = []
      const queue = createQueue({
        handler: async () => {
          order.push(order.length)
        },
      })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      await Promise.all([queue.enqueue(wsEvent), queue.enqueue(wsEvent), queue.enqueue(wsEvent)])

      expect(order).toEqual([0, 1, 2])
    })

    it('does not process next item until previous completes', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      const p1 = queue.enqueue(wsEvent)
      const p2 = queue.enqueue(wsEvent)
      await tick()

      expect(calls).toHaveLength(1)

      calls[0]!.resolve()
      await tick()

      expect(calls).toHaveLength(2)

      calls[1]!.resolve()
      await Promise.all([p1, p2])
    })
  })

  describe('enqueue', () => {
    it('resolves with Ok after handler completes', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      const p = queue.enqueue(wsEvent)
      await tick()

      calls[0]!.resolve()
      const result = await p
      expect(result.ok).toBe(true)
    })

    it('returns Err when destroyed', async () => {
      const queue = createQueue()
      queue.destroy()

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      const result = await queue.enqueue(wsEvent)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeInstanceOf(WriteQueueDestroyedException)
    })

    it('returns Err during active reset', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      queue.enqueue(wsEvent)
      await tick()

      // Start reset while op is in-flight
      const resetPromise = queue.resetSession('user-changed')

      // Enqueue during reset returns Err immediately
      const result = await queue.enqueue(wsEvent)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toBeInstanceOf(SessionResetException)

      // Clean up
      calls[0]!.resolve()
      await resetPromise
    })

    it('rejects with handler error', async () => {
      const queue = createQueue({
        handler: async () => {
          throw new Error('handler boom')
        },
      })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      await expect(queue.enqueue(wsEvent)).rejects.toThrow('handler boom')
    })

    it('handler error does not break the drain loop', async () => {
      let callCount = 0
      const queue = createQueue({
        handler: async () => {
          callCount++
          if (callCount === 1) throw new Error('first fails')
        },
      })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      const p1 = queue.enqueue(wsEvent)
      const p2 = queue.enqueue(wsEvent)

      await expect(p1).rejects.toThrow('first fails')
      const result = await p2
      expect(result.ok).toBe(true)
      expect(callCount).toBe(2)
    })
  })

  describe('resetSession', () => {
    it('discards pending ops with SessionResetException', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }
      const seedRecords: ApplyRecordsOp<ServiceLink> = {
        type: 'apply-records',
        collection: 'todos',
        cacheKey: TODO_CACHE_KEY,
        records: [],
        source: 'seed',
      }

      queue.enqueue(wsEvent)
      await tick()

      const p2 = queue.enqueue(seedRecords)
      const p3 = queue.enqueue(wsEvent)
      await tick()

      const resetPromise = queue.resetSession('user-changed')

      const r2 = await p2
      const r3 = await p3
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.error).toBeInstanceOf(SessionResetException)
      expect(r3.ok).toBe(false)
      if (!r3.ok) expect(r3.error).toBeInstanceOf(SessionResetException)

      // Resolve in-flight so reset can proceed
      calls[0]!.resolve()
      await resetPromise
    })

    it('waits for in-flight op to finish', async () => {
      const { handler, calls } = controllableHandler()
      const onReset = vi.fn(async () => {})
      const queue = createQueue({ handler, onSessionReset: onReset })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      queue.enqueue(wsEvent)
      await tick()

      const resetPromise = queue.resetSession('user-changed')
      await tick()

      // Reset callback should not have been called yet — op still in-flight
      expect(onReset).not.toHaveBeenCalled()

      calls[0]!.resolve()
      await resetPromise

      expect(onReset).toHaveBeenCalledWith('user-changed')
    })

    it('invokes onSessionReset callback', async () => {
      const onReset = vi.fn(async () => {})
      const queue = createQueue({ onSessionReset: onReset })

      await queue.resetSession('explicit')

      expect(onReset).toHaveBeenCalledWith('explicit')
    })

    it('concurrent resetSession calls return the same promise', async () => {
      const onReset = vi.fn(async () => {})
      const queue = createQueue({ onSessionReset: onReset })

      const p1 = queue.resetSession('user-changed')
      const p2 = queue.resetSession('user-changed')

      await Promise.all([p1, p2])

      expect(onReset).toHaveBeenCalledTimes(1)
    })

    it('allows enqueue after reset completes', async () => {
      const handler = vi.fn(async () => {})
      const queue = createQueue({ handler })

      await queue.resetSession('user-changed')

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      const result = await queue.enqueue(wsEvent)
      expect(result.ok).toBe(true)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('discards evict-cache-key ops along with other ops', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }
      const evict: EvictCacheKeyOp = { type: 'evict-cache-key', cacheKey: TODO_CACHE_KEY.key }

      queue.enqueue(wsEvent)
      await tick()

      const p2 = queue.enqueue(evict)
      const resetPromise = queue.resetSession('user-changed')

      const r2 = await p2
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.error).toBeInstanceOf(SessionResetException)

      calls[0]!.resolve()
      await resetPromise
    })

    it('is a no-op on destroyed queue', async () => {
      const onReset = vi.fn(async () => {})
      const queue = createQueue({ onSessionReset: onReset })
      queue.destroy()

      await queue.resetSession('user-changed')

      expect(onReset).not.toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('resolves pending ops with Err', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }
      const evict: EvictCacheKeyOp = { type: 'evict-cache-key', cacheKey: TODO_CACHE_KEY.key }

      queue.enqueue(wsEvent)
      await tick()

      const p2 = queue.enqueue(wsEvent)
      const p3 = queue.enqueue(evict)

      queue.destroy()

      const r2 = await p2
      const r3 = await p3
      expect(r2.ok).toBe(false)
      if (!r2.ok) expect(r2.error).toBeInstanceOf(WriteQueueDestroyedException)
      expect(r3.ok).toBe(false)
      if (!r3.ok) expect(r3.error).toBeInstanceOf(WriteQueueDestroyedException)

      calls[0]!.resolve()
    })
  })

  describe('eviction handlers', () => {
    it('fires eviction handler with SessionResetException on session reset', async () => {
      const { handler, calls } = controllableHandler()
      const evictionHandler = vi.fn()
      const queue = createQueue({ handler, evictionHandler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      // First op goes in-flight
      queue.enqueue(wsEvent)
      await tick()

      // These two are pending
      queue.enqueue(wsEvent)
      queue.enqueue(wsEvent)

      const resetPromise = queue.resetSession('user-changed')

      expect(evictionHandler).toHaveBeenCalledTimes(2)
      expect(evictionHandler.mock.calls[0]![1]).toBeInstanceOf(SessionResetException)

      calls[0]!.resolve()
      await resetPromise
    })

    it('fires eviction handler with WriteQueueDestroyedException on destroy', async () => {
      const { handler, calls } = controllableHandler()
      const evictionHandler = vi.fn()
      const queue = createQueue({ handler, evictionHandler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      queue.enqueue(wsEvent)
      await tick()

      queue.enqueue(wsEvent)
      queue.destroy()

      expect(evictionHandler).toHaveBeenCalledTimes(1)
      expect(evictionHandler.mock.calls[0]![1]).toBeInstanceOf(WriteQueueDestroyedException)

      calls[0]!.resolve()
    })

    it('does not fire eviction handler for in-flight op', async () => {
      const { handler, calls } = controllableHandler()
      const evictionHandler = vi.fn()
      const queue = createQueue({ handler, evictionHandler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      queue.enqueue(wsEvent)
      await tick()

      const resetPromise = queue.resetSession('user-changed')

      // In-flight op is not evicted
      expect(evictionHandler).not.toHaveBeenCalled()

      calls[0]!.resolve()
      await resetPromise
    })

    it('passes the discarded op to the eviction handler', async () => {
      const { handler, calls } = controllableHandler()
      const evictionHandler = vi.fn()
      const queue = createQueue({ handler, evictionHandler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      // Put one in-flight so the next ones are pending
      queue.enqueue(wsEvent)
      await tick()

      const gapRepair: ApplyGapRepairOp<ServiceLink> = {
        type: 'apply-gap-repair',
        streamId: 'stream-1',
        cacheKeys: [TODO_CACHE_KEY],
        events: [],
      }
      queue.enqueue(gapRepair)

      const resetPromise = queue.resetSession('user-changed')

      expect(evictionHandler).toHaveBeenCalledTimes(1)
      expect(evictionHandler.mock.calls[0]![0]).toBe(gapRepair)

      calls[0]!.resolve()
      await resetPromise
    })
  })

  describe('getDebugState', () => {
    it('reports idle when empty', () => {
      const queue = createQueue()
      const state = queue.getDebugState()

      expect(state.status).toBe('idle')
      expect(state.pendingCount).toBe(0)
      expect(state.currentOpType).toBeUndefined()
      expect(state.pendingByType).toEqual({})
    })

    it('reports processing with current op type', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const seedRecords: ApplyRecordsOp<ServiceLink> = {
        type: 'apply-records',
        collection: 'todos',
        cacheKey: TODO_CACHE_KEY,
        records: [],
        source: 'seed',
      }

      queue.enqueue(seedRecords)
      await tick()

      const state = queue.getDebugState()
      expect(state.status).toBe('processing')
      expect(state.currentOpType).toBe('apply-records')

      calls[0]!.resolve()
      await tick()
    })

    it('reports pending counts by type', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }
      const seedRecords: ApplyRecordsOp<ServiceLink> = {
        type: 'apply-records',
        collection: 'todos',
        cacheKey: TODO_CACHE_KEY,
        records: [],
        source: 'seed',
      }

      queue.enqueue(wsEvent)
      await tick()

      queue.enqueue(wsEvent)
      queue.enqueue(seedRecords)
      queue.enqueue(seedRecords)

      const state = queue.getDebugState()
      expect(state.pendingCount).toBe(3)
      expect(state.pendingByType).toEqual({
        'reconcile-ws-events': 1,
        'apply-records': 2,
      })

      // Clean up
      for (const call of calls) call.resolve()
      calls.length = 0
      await tick()
      for (const call of calls) call.resolve()
    })

    it('reports resetting status', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      const wsEvent: ReconcileWsEventsOp = {
        type: 'reconcile-ws-events',
      }

      queue.enqueue(wsEvent)
      await tick()

      const resetPromise = queue.resetSession('user-changed')

      expect(queue.getDebugState().status).toBe('resetting')

      calls[0]!.resolve()
      await resetPromise
    })
  })
  describe('priority', () => {
    const wsEvent: ReconcileWsEventsOp = {
      type: 'reconcile-ws-events',
    }

    const evictOp: EvictCacheKeyOp = {
      type: 'evict-cache-key',
      cacheKey: 'key-1',
    }

    it('default priority (0) preserves FIFO order', async () => {
      const order: string[] = []
      const queue = createQueue({
        handler: async (op) => {
          order.push(op.type)
        },
      })

      await Promise.all([queue.enqueue(wsEvent), queue.enqueue(evictOp), queue.enqueue(wsEvent)])

      expect(order).toEqual(['reconcile-ws-events', 'evict-cache-key', 'reconcile-ws-events'])
    })

    it('higher priority operations process before lower priority', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })
      const order: number[] = []

      // Enqueue first op to start processing (blocks the queue)
      queue.enqueue(wsEvent)
      await tick()

      // While first op is in-flight, enqueue low then high priority
      const lowPromise = queue.enqueue(wsEvent, { priority: 0 })
      const highPromise = queue.enqueue(evictOp, { priority: 10 })

      // Resolve the in-flight op
      calls[0]!.resolve()
      await tick()

      // High priority should process next (second call), then low priority (third call)
      calls[1]!.resolve()
      await tick()
      calls[2]!.resolve()

      await Promise.all([lowPromise, highPromise])

      expect(calls[1]!.op.type).toBe('evict-cache-key')
      expect(calls[2]!.op.type).toBe('reconcile-ws-events')
    })

    it('same priority preserves FIFO order', async () => {
      const { handler, calls } = controllableHandler()
      const queue = createQueue({ handler })

      // Block the queue with first op
      queue.enqueue(wsEvent)
      await tick()

      // Enqueue three ops at same priority
      queue.enqueue(wsEvent, { priority: 5 })
      queue.enqueue(evictOp, { priority: 5 })
      queue.enqueue(wsEvent, { priority: 5 })

      // Resolve all in sequence
      calls[0]!.resolve()
      await tick()
      calls[1]!.resolve()
      await tick()
      calls[2]!.resolve()
      await tick()
      calls[3]!.resolve()
      await tick()

      expect(calls[1]!.op.type).toBe('reconcile-ws-events')
      expect(calls[2]!.op.type).toBe('evict-cache-key')
      expect(calls[3]!.op.type).toBe('reconcile-ws-events')
    })

    it('session reset discards all pending regardless of priority', async () => {
      const { handler, calls } = controllableHandler()
      const evictionHandler = vi.fn()
      const queue = createQueue({ handler, evictionHandler })

      // Block the queue
      queue.enqueue(wsEvent)
      await tick()

      // Enqueue ops at different priorities
      const p1 = queue.enqueue(wsEvent, { priority: 0 })
      const p2 = queue.enqueue(evictOp, { priority: 10 })

      // Reset session
      const resetPromise = queue.resetSession('test')
      calls[0]!.resolve()
      await resetPromise

      const r1 = await p1
      const r2 = await p2
      expect(r1.ok).toBe(false)
      expect(r2.ok).toBe(false)
      expect(evictionHandler).toHaveBeenCalledTimes(2)
    })

    it('destroy discards all pending regardless of priority', async () => {
      const { handler, calls } = controllableHandler()
      const evictionHandler = vi.fn()
      const queue = createQueue({ handler, evictionHandler })

      // Block the queue
      queue.enqueue(wsEvent)
      await tick()

      // Enqueue at different priorities
      const p1 = queue.enqueue(wsEvent, { priority: 0 })
      const p2 = queue.enqueue(evictOp, { priority: 10 })

      queue.destroy()

      const r1 = await p1
      const r2 = await p2
      expect(r1.ok).toBe(false)
      expect(r2.ok).toBe(false)
      expect(evictionHandler).toHaveBeenCalledTimes(2)
    })
  })

  function createQueue(params?: {
    handler?: (op: WriteQueueOp<ServiceLink, EnqueueCommand>) => Promise<void>
    evictionHandler?: (
      op: WriteQueueOp<ServiceLink, EnqueueCommand>,
      reason: WriteQueueException,
    ) => void
    onSessionReset?: (reason: string) => Promise<void>
  }) {
    const eventBus = new EventBus<ServiceLink>()
    return createTestWriteQueue<ServiceLink, EnqueueCommand>(eventBus, cleanup, [], params)
  }
})

function controllableHandler() {
  const calls: Array<{
    op: WriteQueueOp<ServiceLink, EnqueueCommand>
    resolve: () => void
    reject: (err: Error) => void
  }> = []

  const handler = (op: WriteQueueOp<ServiceLink, EnqueueCommand>): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      calls.push({ op, resolve, reject })
    })
  }

  return { handler, calls }
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
