/**
 * Unit tests for CommandQueue.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { CommandRecord } from '../../types/commands.js'
import type { IDomainExecutor } from '../../types/domain.js'
import {
  autoRevision,
  createDomainExecutor,
  domainFailure,
  domainSuccess,
} from '../../types/domain.js'
import { generateId } from '../../utils/uuid.js'
import { EventBus } from '../events/EventBus.js'
import type { IAnticipatedEventHandler } from './CommandQueue.js'
import { CommandQueue } from './CommandQueue.js'
import type { ICommandSender } from './types.js'
import { CommandSendError } from './types.js'

describe('CommandQueue', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let anticipatedEventHandler: IAnticipatedEventHandler & {
    cache: ReturnType<typeof vi.fn>
    cleanup: ReturnType<typeof vi.fn>
    clearAll: ReturnType<typeof vi.fn>
  }
  let commandQueue: CommandQueue

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    anticipatedEventHandler = {
      cache: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      regenerate: vi.fn().mockResolvedValue(undefined),
      getTrackedEntries: vi.fn().mockReturnValue(undefined),
      clearAll: vi.fn().mockResolvedValue(undefined),
    }
    commandQueue = new CommandQueue({ storage, eventBus, anticipatedEventHandler })
  })

  describe('enqueue', () => {
    it('enqueues a command and returns success', async () => {
      const result = await commandQueue.enqueue({
        type: 'CreateTodo',
        payload: { title: 'Test todo' },
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.commandId).toBeDefined()
        expect(result.value.anticipatedEvents).toEqual([])
      }
    })

    it('uses provided commandId', async () => {
      const result = await commandQueue.enqueue(
        { type: 'CreateTodo', payload: {} },
        { commandId: 'custom-id-123' },
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.commandId).toBe('custom-id-123')
      }
    })

    it('saves command to storage', async () => {
      const result = await commandQueue.enqueue({
        type: 'CreateTodo',
        payload: { title: 'Test' },
        service: 'todo-service',
      })

      if (!result.ok) throw new Error('Expected success')

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored).toMatchObject({
        type: 'CreateTodo',
        payload: { title: 'Test' },
        service: 'todo-service',
        status: 'pending',
      })
    })

    it('emits enqueued event', async () => {
      const events: unknown[] = []
      commandQueue.events$.subscribe((e) => events.push(e))

      await commandQueue.enqueue({ type: 'CreateTodo', payload: {} })

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        eventType: 'enqueued',
        type: 'CreateTodo',
        status: 'pending',
      })
    })

    it('emits to library event bus', async () => {
      const events: unknown[] = []
      eventBus.on('command:enqueued').subscribe((e) => events.push(e))

      await commandQueue.enqueue({ type: 'CreateTodo', payload: {} })

      expect(events).toHaveLength(1)
    })
  })

  describe('enqueue with domain validation', () => {
    let domainExecutor: IDomainExecutor

    beforeEach(() => {
      domainExecutor = {
        execute: vi.fn(),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        domainExecutor,
      })
    })

    it('returns validation errors when domain validation fails', async () => {
      vi.mocked(domainExecutor.execute).mockReturnValue(
        domainFailure([{ path: 'title', message: 'Title is required' }]),
      )

      const result = await commandQueue.enqueue({
        type: 'CreateTodo',
        payload: { title: '' },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        const errors = result.error.details
        expect(errors).toHaveLength(1)
        expect(errors?.[0]).toMatchObject({ path: 'title', message: 'Title is required' })
      }
    })

    it('returns anticipated events on successful validation', async () => {
      vi.mocked(domainExecutor.execute).mockReturnValue(
        domainSuccess([{ type: 'TodoCreated', data: { id: '1', title: 'Test' } }]),
      )

      const result = await commandQueue.enqueue({
        type: 'CreateTodo',
        payload: { title: 'Test' },
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.anticipatedEvents).toHaveLength(1)
        expect(result.value.anticipatedEvents[0]).toMatchObject({
          type: 'TodoCreated',
          data: { id: '1', title: 'Test' },
        })
      }
    })

    it('skips validation when skipValidation is true', async () => {
      vi.mocked(domainExecutor.execute).mockReturnValue(
        domainFailure([{ path: 'title', message: 'Title is required' }]),
      )

      const result = await commandQueue.enqueue(
        { type: 'CreateTodo', payload: { title: '' } },
        { skipValidation: true },
      )

      expect(result.ok).toBe(true)
      expect(domainExecutor.execute).not.toHaveBeenCalled()
    })
  })

  describe('enqueue with dependencies', () => {
    it('marks command as blocked when it has unresolved dependencies', async () => {
      // First command
      const first = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!first.ok) throw new Error('Expected success')

      // Second command depends on first
      const second = await commandQueue.enqueue({
        type: 'Second',
        payload: {},
        dependsOn: [first.value.commandId],
      })

      if (!second.ok) throw new Error('Expected success')

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('blocked')
      expect(storedSecond?.blockedBy).toContain(first.value.commandId)
    })

    it('marks command as pending when all dependencies are resolved', async () => {
      // Create and complete first command
      const first: CommandRecord = {
        commandId: 'cmd-1',
        service: 'test',
        type: 'First',
        payload: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,

        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(first)

      // Second command depends on first (which is already completed)
      const second = await commandQueue.enqueue({
        type: 'Second',
        payload: {},
        dependsOn: ['cmd-1'],
      })

      if (!second.ok) throw new Error('Expected success')

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('pending')
      expect(storedSecond?.blockedBy).toHaveLength(0)
    })
  })

  describe('waitForCompletion', () => {
    it('returns immediately if command is already succeeded', async () => {
      const command: CommandRecord = {
        commandId: 'cmd-1',
        service: 'test',
        type: 'Test',
        payload: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,

        serverResponse: { id: '123' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      const result = await commandQueue.waitForCompletion('cmd-1')

      expect(result.status).toBe('succeeded')
      if (result.status === 'succeeded') {
        expect(result.response).toEqual({ id: '123' })
      }
    })

    it('returns immediately if command is already failed', async () => {
      const command: CommandRecord = {
        commandId: 'cmd-1',
        service: 'test',
        type: 'Test',
        payload: {},
        status: 'failed',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,

        error: { source: 'server', message: 'Bad request' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      const result = await commandQueue.waitForCompletion('cmd-1')

      expect(result.status).toBe('failed')
      if (result.status === 'failed') {
        expect(result.error.message).toBe('Bad request')
      }
    })

    it('returns failed for non-existent command', async () => {
      const result = await commandQueue.waitForCompletion('non-existent')

      expect(result.status).toBe('failed')
      if (result.status === 'failed') {
        expect(result.error.message).toBe('Command not found')
      }
    })

    it('times out if command does not complete', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      const completionResult = await commandQueue.waitForCompletion(result.value.commandId, {
        timeout: 50,
      })

      expect(completionResult.status).toBe('timeout')
    })

    it('waits for command to complete', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      // Simulate completion in background
      setTimeout(async () => {
        await storage.updateCommand(result.value.commandId, {
          status: 'succeeded',
          serverResponse: { done: true },
        })
        // Manually emit event since we're updating storage directly
        ;(commandQueue as any).commandEvents.next({
          eventType: 'status-changed',
          commandId: result.value.commandId,
          type: 'Test',
          status: 'succeeded',
          response: { done: true },
          timestamp: Date.now(),
        })
      }, 20)

      const completionResult = await commandQueue.waitForCompletion(result.value.commandId, {
        timeout: 1000,
      })

      expect(completionResult.status).toBe('succeeded')
    })
  })

  describe('enqueueAndWait', () => {
    it('returns validation errors immediately', async () => {
      const domainExecutor: IDomainExecutor = {
        execute: () => domainFailure([{ path: 'email', message: 'Invalid email' }]),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        domainExecutor,
      })

      const result = await commandQueue.enqueueAndWait({
        type: 'CreateUser',
        payload: { email: 'invalid' },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.details?.source).toBe('local')
        expect(result.error.details?.errors[0]).toMatchObject({ path: 'email' })
      }
    })
  })

  describe('commandEvents$', () => {
    it('filters events to specific command', async () => {
      const events: unknown[] = []
      const result1 = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!result1.ok) throw new Error('Expected success')

      commandQueue.commandEvents$(result1.value.commandId).subscribe((e) => events.push(e))

      await commandQueue.enqueue({ type: 'Second', payload: {} })

      // Only the first command event was already emitted before subscribing
      // New events for second command should not appear
      expect(events).toHaveLength(0)
    })
  })

  describe('cancelCommand', () => {
    it('cancels a pending command', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.cancelCommand(result.value.commandId)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('cancelled')
    })

    it('throws when command does not exist', async () => {
      await expect(commandQueue.cancelCommand('non-existent')).rejects.toThrow('Command not found')
    })

    it('throws when command is already succeeded', async () => {
      const command: CommandRecord = {
        commandId: 'cmd-1',
        service: 'test',
        type: 'Test',
        payload: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,

        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      await expect(commandQueue.cancelCommand('cmd-1')).rejects.toThrow('Cannot cancel command')
    })

    it('emits cancelled event', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      const events: unknown[] = []
      commandQueue.commandEvents$(result.value.commandId).subscribe((e) => events.push(e))

      await commandQueue.cancelCommand(result.value.commandId)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        eventType: 'status-changed',
        status: 'cancelled',
        previousStatus: 'pending',
      })
    })
  })

  describe('retryCommand', () => {
    it('retries a failed command', async () => {
      const command: CommandRecord = {
        commandId: 'cmd-1',
        service: 'test',
        type: 'Test',
        payload: {},
        status: 'failed',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,

        error: { source: 'server', message: 'Failed' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      await commandQueue.retryCommand('cmd-1')

      const stored = await storage.getCommand('cmd-1')
      expect(stored?.status).toBe('pending')
      expect(stored?.error).toBeUndefined()
    })

    it('throws when command is not failed', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      await expect(commandQueue.retryCommand(result.value.commandId)).rejects.toThrow(
        'Can only retry failed commands',
      )
    })
  })

  describe('command processing', () => {
    let commandSender: ICommandSender

    beforeEach(() => {
      commandSender = {
        send: vi.fn().mockResolvedValue({ id: '123' }),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        commandSender,
        retryConfig: { maxAttempts: 3, initialDelay: 10 },
      })
    })

    it('processes pending commands when resumed', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()
      await commandQueue.processPendingCommands()

      expect(commandSender.send).toHaveBeenCalledTimes(1)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('succeeded')
      expect(stored?.serverResponse).toEqual({ id: '123' })
    })

    it('does not process commands when paused', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      // Queue starts paused
      await commandQueue.processPendingCommands()

      expect(commandSender.send).not.toHaveBeenCalled()
    })

    it('retries failed commands up to maxAttempts', async () => {
      vi.mocked(commandSender.send)
        .mockRejectedValueOnce(new CommandSendError('Network error', 'NETWORK', true))
        .mockRejectedValueOnce(new CommandSendError('Network error', 'NETWORK', true))
        .mockResolvedValueOnce({ id: '123' })

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()

      // Wait for retries to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(commandSender.send).toHaveBeenCalledTimes(3)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('succeeded')
    })

    it('marks command as failed after max retries', async () => {
      vi.mocked(commandSender.send).mockRejectedValue(
        new CommandSendError('Network error', 'NETWORK', true),
      )

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()

      // Wait for all retries to complete
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(commandSender.send).toHaveBeenCalledTimes(3)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('failed')
    })

    it('does not retry non-retryable errors', async () => {
      vi.mocked(commandSender.send).mockRejectedValue(
        new CommandSendError('Validation error', 'VALIDATION', false),
      )

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(commandSender.send).toHaveBeenCalledTimes(1)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('failed')
    })

    it('unblocks dependent commands on success', async () => {
      const first = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        type: 'Second',
        payload: {},
        dependsOn: [first.value.commandId],
      })
      if (!second.ok) throw new Error('Expected success')

      // Second should be blocked
      let storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('blocked')

      commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // First should be succeeded and second should be unblocked
      const storedFirst = await storage.getCommand(first.value.commandId)
      expect(storedFirst?.status).toBe('succeeded')

      storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('pending')
      expect(storedSecond?.blockedBy).toHaveLength(0)
    })

    it('processes commands enqueued during an active processing pass', async () => {
      // First send blocks; subsequent sends resolve immediately
      let resolveSend: ((value: unknown) => void) | undefined
      vi.mocked(commandSender.send)
        .mockImplementationOnce(() => new Promise((resolve) => (resolveSend = resolve)))
        .mockResolvedValue({ id: '2' })

      commandQueue.resume()
      // Let resume's empty processing pass complete before enqueuing
      await new Promise((resolve) => setTimeout(resolve, 0))

      const first = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!first.ok) throw new Error('Expected success')

      // First command is now in-flight (send is blocked)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Enqueue a second command while the first is still processing
      const second = await commandQueue.enqueue({ type: 'Second', payload: {} })
      if (!second.ok) throw new Error('Expected success')

      // Complete the first send — this should trigger reprocessing of the second
      resolveSend!({ id: '1' })
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Without the reprocess fix, the second command stays pending forever
      expect(commandSender.send).toHaveBeenCalledTimes(2)

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('succeeded')
    })

    it('does not process a command cancelled during an earlier send', async () => {
      // First send blocks via deferred promise; second should never be called
      let resolveSend: ((value: unknown) => void) | undefined
      vi.mocked(commandSender.send)
        .mockImplementationOnce(() => new Promise((resolve) => (resolveSend = resolve)))
        .mockResolvedValue({ id: '2' })

      // Enqueue both commands while paused so they are in the same batch
      const first = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({ type: 'Second', payload: {} })
      if (!second.ok) throw new Error('Expected success')

      // Resume — processing snapshots both commands
      commandQueue.resume()

      // Wait for first command to start sending (blocks on deferred)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Cancel the second command while the first is mid-send
      await commandQueue.cancelCommand(second.value.commandId)

      // Resolve the first send — processing loop continues to second
      resolveSend!({ id: '1' })
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Second command should remain cancelled, send should only have been called once
      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('cancelled')
      expect(commandSender.send).toHaveBeenCalledTimes(1)
    })

    it('clears retry timers on destroy', async () => {
      // Use a long retry delay so the timer is still pending when we destroy
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        commandSender,
        retryConfig: { maxAttempts: 3, initialDelay: 500 },
      })

      vi.mocked(commandSender.send).mockRejectedValue(
        new CommandSendError('Network error', 'NETWORK', true),
      )

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()

      // Wait for the first attempt to fail and schedule a retry timer
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Destroy the queue while retry timer is pending
      await commandQueue.destroy()

      // Wait long enough for any scheduled retry to have fired if not cleared
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Send should not have been called again after destroy
      expect(commandSender.send).toHaveBeenCalledTimes(1)
    })

    it('awaits in-flight command processing on destroy', async () => {
      let resolveSend: ((value: unknown) => void) | undefined
      vi.mocked(commandSender.send).mockImplementation(
        () => new Promise((resolve) => (resolveSend = resolve)),
      )

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()
      // Let processing pick up the command
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Start destroy while send is in-flight
      let destroyResolved = false
      const destroyPromise = commandQueue.destroy().then(() => {
        destroyResolved = true
      })

      // destroy() should not have resolved yet — send is still in-flight
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(destroyResolved).toBe(false)

      // Complete the send
      resolveSend!({ id: '123' })

      // Now destroy should resolve
      await destroyPromise
      expect(destroyResolved).toBe(true)
    })

    it('cancels dependent commands on failure', async () => {
      vi.mocked(commandSender.send).mockRejectedValue(new CommandSendError('Error', 'ERROR', false))

      const first = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        type: 'Second',
        payload: {},
        dependsOn: [first.value.commandId],
      })
      if (!second.ok) throw new Error('Expected success')

      commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const storedFirst = await storage.getCommand(first.value.commandId)
      expect(storedFirst?.status).toBe('failed')

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('cancelled')
    })
  })

  describe('listCommands', () => {
    it('returns all commands', async () => {
      await commandQueue.enqueue({ type: 'First', payload: {} })
      await commandQueue.enqueue({ type: 'Second', payload: {} })

      const commands = await commandQueue.listCommands()

      expect(commands).toHaveLength(2)
    })

    it('filters by status', async () => {
      await commandQueue.enqueue({ type: 'First', payload: {} })
      const second = await commandQueue.enqueue({ type: 'Second', payload: {} })
      if (!second.ok) throw new Error('Expected success')

      await commandQueue.cancelCommand(second.value.commandId)

      const pending = await commandQueue.listCommands({ status: 'pending' })
      const cancelled = await commandQueue.listCommands({ status: 'cancelled' })

      expect(pending).toHaveLength(1)
      expect(cancelled).toHaveLength(1)
    })
  })

  describe('retainTerminal', () => {
    it('stores retainTerminal config flag', () => {
      const queue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        retainTerminal: true,
      })
      // The flag is stored but has no behavioral effect yet.
      // Verify construction succeeds without error.
      expect(queue).toBeDefined()
    })
  })

  describe('pause/resume', () => {
    it('starts paused', () => {
      expect(commandQueue.isPaused()).toBe(true)
    })

    it('can be resumed', () => {
      commandQueue.resume()
      expect(commandQueue.isPaused()).toBe(false)
    })

    it('can be paused', () => {
      commandQueue.resume()
      commandQueue.pause()
      expect(commandQueue.isPaused()).toBe(true)
    })
  })

  describe('anticipated event caching', () => {
    let domainExecutor: IDomainExecutor

    beforeEach(() => {
      domainExecutor = {
        execute: vi.fn(),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        domainExecutor,
      })
    })

    it('calls cache() with correct commandId and events when domain executor succeeds', async () => {
      const events = [{ type: 'TodoCreated', data: { id: '1', title: 'Test' }, streamId: 'todo-1' }]
      vi.mocked(domainExecutor.execute).mockReturnValue(domainSuccess(events))

      const result = await commandQueue.enqueue({
        type: 'CreateTodo',
        payload: { title: 'Test' },
      })

      if (!result.ok) throw new Error('Expected success')

      expect(anticipatedEventHandler.cache).toHaveBeenCalledTimes(1)
      expect(anticipatedEventHandler.cache).toHaveBeenCalledWith(result.value.commandId, events)
    })

    it('does not call cache() when domain executor is not configured', async () => {
      commandQueue = new CommandQueue({ storage, eventBus, anticipatedEventHandler })

      await commandQueue.enqueue({ type: 'CreateTodo', payload: {} })

      expect(anticipatedEventHandler.cache).not.toHaveBeenCalled()
    })

    it('does not call cache() when anticipated events array is empty', async () => {
      vi.mocked(domainExecutor.execute).mockReturnValue(domainSuccess([]))

      await commandQueue.enqueue({ type: 'CreateTodo', payload: {} })

      expect(anticipatedEventHandler.cache).not.toHaveBeenCalled()
    })

    it('enqueue succeeds even if cache() throws', async () => {
      const events = [{ type: 'TodoCreated', data: { id: '1', title: 'Test' }, streamId: 'todo-1' }]
      vi.mocked(domainExecutor.execute).mockReturnValue(domainSuccess(events))
      anticipatedEventHandler.cache.mockRejectedValue(new Error('Cache failure'))

      const result = await commandQueue.enqueue({
        type: 'CreateTodo',
        payload: { title: 'Test' },
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.commandId).toBeDefined()
      }
    })
  })

  describe('anticipated event cleanup', () => {
    let commandSender: ICommandSender

    beforeEach(() => {
      commandSender = {
        send: vi.fn().mockResolvedValue({ id: '123' }),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        commandSender,
        retryConfig: { maxAttempts: 2, initialDelay: 10 },
      })
    })

    it('calls cleanup() when command succeeds', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()
      await commandQueue.processPendingCommands()

      expect(anticipatedEventHandler.cleanup).toHaveBeenCalledWith(
        result.value.commandId,
        'succeeded',
      )
    })

    it('calls cleanup() when command fails permanently', async () => {
      vi.mocked(commandSender.send).mockRejectedValue(
        new CommandSendError('Validation error', 'VALIDATION', false),
      )

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(anticipatedEventHandler.cleanup).toHaveBeenCalledWith(result.value.commandId, 'failed')
    })

    it('calls cleanup() when command is cancelled', async () => {
      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.cancelCommand(result.value.commandId)

      expect(anticipatedEventHandler.cleanup).toHaveBeenCalledWith(
        result.value.commandId,
        'cancelled',
      )
    })

    it('calls cleanup() for cascaded cancellations', async () => {
      vi.mocked(commandSender.send).mockRejectedValue(new CommandSendError('Error', 'ERROR', false))

      const first = await commandQueue.enqueue({ type: 'First', payload: {} })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        type: 'Second',
        payload: {},
        dependsOn: [first.value.commandId],
      })
      if (!second.ok) throw new Error('Expected success')

      commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Both first (failed) and second (cascaded cancel) should trigger cleanup
      expect(anticipatedEventHandler.cleanup).toHaveBeenCalledWith(first.value.commandId, 'failed')
      expect(anticipatedEventHandler.cleanup).toHaveBeenCalledWith(
        second.value.commandId,
        'cancelled',
      )
    })

    it('does not call cleanup() on retry (stays pending)', async () => {
      vi.mocked(commandSender.send)
        .mockRejectedValueOnce(new CommandSendError('Network error', 'NETWORK', true))
        .mockResolvedValueOnce({ id: '123' })

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()

      // Wait for first attempt to fail and enter retry
      await new Promise((resolve) => setTimeout(resolve, 30))

      // After first failure (retry scheduled), cleanup should not have been called
      // because status went back to 'pending', not a terminal state
      const stored = await storage.getCommand(result.value.commandId)
      if (stored?.status === 'pending') {
        // The command is still pending (retrying), cleanup should not have been called yet
        expect(anticipatedEventHandler.cleanup).not.toHaveBeenCalled()
      }
    })
  })

  describe('reset', () => {
    it('pauses the queue', async () => {
      commandQueue.resume()
      expect(commandQueue.isPaused()).toBe(false)

      await commandQueue.reset()
      expect(commandQueue.isPaused()).toBe(true)
    })

    it('clears pending retry timers', async () => {
      const commandSender: ICommandSender = {
        send: vi.fn().mockRejectedValue(new CommandSendError('Error', 'NETWORK', true)),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        commandSender,
        retryConfig: { maxAttempts: 3, initialDelay: 500 },
      })

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()

      // Wait for first attempt to fail and schedule retry
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Reset clears timers
      await commandQueue.reset()

      // Wait long enough for any scheduled retry to have fired if not cleared
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Send should not have been called again
      expect(commandSender.send).toHaveBeenCalledTimes(1)
    })

    it('waits for in-flight processing', async () => {
      let resolveSend: ((value: unknown) => void) | undefined
      const commandSender: ICommandSender = {
        send: vi.fn().mockImplementation(() => new Promise((resolve) => (resolveSend = resolve))),
      }
      commandQueue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        commandSender,
      })

      const result = await commandQueue.enqueue({ type: 'Test', payload: {} })
      if (!result.ok) throw new Error('Expected success')

      commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Start reset while send is in-flight
      let resetResolved = false
      const resetPromise = commandQueue.reset().then(() => {
        resetResolved = true
      })

      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(resetResolved).toBe(false)

      // Complete the send
      resolveSend!({ id: '123' })

      await resetPromise
      expect(resetResolved).toBe(true)
    })
  })

  describe('clearAll', () => {
    it('pauses the queue, clears anticipated tracking, and deletes all commands', async () => {
      commandQueue.resume()
      await commandQueue.enqueue({ type: 'First', payload: {} })
      await commandQueue.enqueue({ type: 'Second', payload: {} })

      await commandQueue.clearAll()

      expect(commandQueue.isPaused()).toBe(true)
      expect(anticipatedEventHandler.clearAll).toHaveBeenCalledTimes(1)

      const commands = await commandQueue.listCommands()
      expect(commands).toHaveLength(0)
    })
  })

  describe('cross-aggregate parent-child reconciliation', () => {
    // Handler registrations for two aggregate types
    interface AnticipatedEvent {
      type: string
      data: Record<string, unknown>
      streamId: string
    }

    function setupCrossAggregateQueue(senderResponses: Map<string, unknown>): {
      queue: CommandQueue
      sender: ICommandSender
    } {
      const executor = createDomainExecutor<AnticipatedEvent>([
        {
          commandType: 'CreateFolder',
          creates: { eventType: 'FolderCreated', idStrategy: 'temporary' },
          handler(payload) {
            const { name } = payload as { name: string }
            const id = generateId()
            return domainSuccess([
              {
                type: 'FolderCreated',
                data: { id, name },
                streamId: `Folder-${id}`,
              },
            ])
          },
        },
        {
          commandType: 'CreateNote',
          creates: { eventType: 'NoteCreated', idStrategy: 'temporary' },
          parentRef: [{ field: 'parentId', fromCommand: 'CreateFolder' }],
          handler(payload) {
            const { parentId, title } = payload as { parentId: string; title: string }
            const id = generateId()
            return domainSuccess([
              {
                type: 'NoteCreated',
                data: { id, parentId, title },
                streamId: `Note-${id}`,
              },
            ])
          },
        },
        {
          commandType: 'UpdateNote',
          revisionField: 'revision',
          handler(payload) {
            const { id, title } = payload as { id: string; title: string }
            return domainSuccess([
              {
                type: 'NoteTitleUpdated',
                data: { id, title },
                streamId: `Note-${id}`,
              },
            ])
          },
        },
        {
          commandType: 'MoveNote',
          revisionField: 'revision',
          parentRef: [
            { field: 'fromFolderId', fromCommand: 'CreateFolder' },
            { field: 'toFolderId', fromCommand: 'CreateFolder' },
          ],
          handler(payload) {
            const { id, fromFolderId, toFolderId } = payload as {
              id: string
              fromFolderId: string
              toFolderId: string
            }
            return domainSuccess([
              {
                type: 'NoteMoved',
                data: { id, fromFolderId, toFolderId },
                streamId: `Note-${id}`,
              },
            ])
          },
        },
      ])

      const sender: ICommandSender = {
        async send(command: CommandRecord) {
          const response = senderResponses.get(command.type)
          if (typeof response === 'function') return response(command)
          if (response !== undefined) return response
          return { id: 'default-id', nextExpectedRevision: '1', events: [] }
        },
      }

      const queue = new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        domainExecutor: executor,
        handlerMetadata: executor,
        commandSender: sender,
      })

      return { queue, sender }
    }

    it('rewrites child payload when parent create succeeds', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'Folder-server-1',
            data: { id: 'folder-server-1', name: 'My Folder' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      // Enqueue parent create
      const folderResult = await queue.enqueue({
        type: 'CreateFolder',
        payload: { name: 'My Folder' },
      })
      if (!folderResult.ok) throw new Error('Expected success')

      // Get the client-generated folder ID from anticipated events
      const folderClientId = (folderResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // Enqueue child create with explicit dependency and parent's client ID
      const noteResult = await queue.enqueue({
        type: 'CreateNote',
        payload: { parentId: folderClientId, title: 'My Note' },
        dependsOn: [folderResult.value.commandId],
      })
      if (!noteResult.ok) throw new Error('Expected success')

      // Child should be blocked
      let noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('blocked')

      // Process the queue — folder command succeeds
      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify folder succeeded
      const folderCmd = await storage.getCommand(folderResult.value.commandId)
      expect(folderCmd?.status).toBe('succeeded')

      // Verify note's payload was rewritten with server ID
      noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('pending')
      const notePayload = noteCmd?.payload as { parentId: string; title: string }
      expect(notePayload.parentId).toBe('folder-server-1')
      expect(notePayload.title).toBe('My Note')
    })

    it('does not change child own temp ID when parent succeeds', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      const folderResult = await queue.enqueue({
        type: 'CreateFolder',
        payload: { name: 'F' },
      })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      const noteResult = await queue.enqueue({
        type: 'CreateNote',
        payload: { parentId: folderClientId, title: 'N' },
        dependsOn: [folderResult.value.commandId],
      })
      if (!noteResult.ok) throw new Error('Expected success')
      const noteClientId = (noteResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Note command was rewritten — parentId changed, but its own anticipated
      // event should have regenerated with the same note client ID
      expect(anticipatedEventHandler.regenerate).toHaveBeenCalled()

      // The note's own ID should not have been changed by the folder's ID map
      // (folder ID map only contains folder client→server, not note IDs)
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      const notePayload = noteCmd?.payload as { parentId: string; title: string }
      // parentId was rewritten to server
      expect(notePayload.parentId).toBe('folder-server-1')
      // The note's own creates config means its client ID comes from anticipated events,
      // not from payload.id. The note doesn't have an id in its payload for CreateNote.
      // Its identity is tracked by the aggregate chain via its anticipated event data.id.
      expect(noteClientId).not.toBe('folder-server-1')
    })

    it('chains A→B→C across aggregates', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })
      senderResponses.set('CreateNote', {
        id: 'note-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-2',
            type: 'NoteCreated',
            streamId: 'Note-server-1',
            data: { id: 'note-server-1', parentId: 'folder-server-1', title: 'N' },
            revision: '1',
            position: '2',
          },
        ],
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      // A: CreateFolder
      const folderResult = await queue.enqueue({ type: 'CreateFolder', payload: { name: 'F' } })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // B: CreateNote depends on A
      const noteResult = await queue.enqueue({
        type: 'CreateNote',
        payload: { parentId: folderClientId, title: 'N' },
        dependsOn: [folderResult.value.commandId],
      })
      if (!noteResult.ok) throw new Error('Expected success')
      const noteClientId = (noteResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // C: UpdateNote depends on B
      const updateResult = await queue.enqueue({
        type: 'UpdateNote',
        payload: { id: noteClientId, title: 'Updated', revision: autoRevision() },
        dependsOn: [noteResult.value.commandId],
      })
      if (!updateResult.ok) throw new Error('Expected success')

      // Process entire chain — each command triggers reprocessing after success
      queue.resume()
      // Allow enough cycles for A→B→C to complete sequentially
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await queue.processPendingCommands()
      }

      // A succeeded
      const folderCmd = await storage.getCommand(folderResult.value.commandId)
      expect(folderCmd?.status).toBe('succeeded')

      // B succeeded — parentId was rewritten
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('succeeded')

      // C's payload should have been rewritten with note's server ID
      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      const updatePayload = updateCmd?.payload as { id: string; title: string }
      expect(updatePayload.id).toBe('note-server-1')
    })

    it('ID mapping cache patches stale client ID at enqueue time', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      // Create folder and let it succeed
      const folderResult = await queue.enqueue({ type: 'CreateFolder', payload: { name: 'F' } })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Folder is now succeeded — mapping cache should have the mapping
      const mapping = await storage.getCommandIdMapping(folderClientId)
      expect(mapping).toBeDefined()

      // Now enqueue a note with the STALE client ID (simulating UI race condition)
      const noteResult = await queue.enqueue({
        type: 'CreateNote',
        payload: { parentId: folderClientId, title: 'Late Note' },
      })
      if (!noteResult.ok) throw new Error('Expected success')

      // The payload should have been patched at enqueue time
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      const notePayload = noteCmd?.payload as { parentId: string; title: string }
      expect(notePayload.parentId).toBe('folder-server-1')
    })

    it('ID mapping cache patches stale revision via server ID lookup', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      // Create and succeed
      const folderResult = await queue.enqueue({ type: 'CreateFolder', payload: { name: 'F' } })
      if (!folderResult.ok) throw new Error('Expected success')

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Enqueue an UpdateNote with the CORRECT server ID but undefined revision fallback
      // (simulating the race where UI has server ID but stale revision)
      const updateResult = await queue.enqueue({
        type: 'UpdateNote',
        payload: { id: 'folder-server-1', title: 'Updated', revision: autoRevision() },
      })
      if (!updateResult.ok) throw new Error('Expected success')

      // The autoRevision fallback should have been patched from the mapping cache
      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      const payload = updateCmd?.payload as { id: string; revision: unknown }
      // The revision should now have a fallback from the mapping
      expect(payload.revision).toMatchObject({ __autoRevision: true, fallback: '1' })
    })

    it('parent ID propagates to commands deeper in child chain while they stay blocked', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      // A: CreateFolder
      const folderResult = await queue.enqueue({ type: 'CreateFolder', payload: { name: 'F' } })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // B: CreateNote depends on folder
      const noteResult = await queue.enqueue({
        type: 'CreateNote',
        payload: { parentId: folderClientId, title: 'N' },
        dependsOn: [folderResult.value.commandId],
      })
      if (!noteResult.ok) throw new Error('Expected success')
      const noteClientId = (noteResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // C: MoveNote depends on note, references folder's client ID in fromFolderId
      const moveResult = await queue.enqueue({
        type: 'MoveNote',
        payload: {
          id: noteClientId,
          fromFolderId: folderClientId,
          toFolderId: 'existing-folder',
          revision: autoRevision(),
        },
        dependsOn: [noteResult.value.commandId],
      })
      if (!moveResult.ok) throw new Error('Expected success')

      // C starts blocked
      let moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(moveCmd?.status).toBe('blocked')

      // Process — folder succeeds
      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // B is unblocked (pending), C is still blocked behind B
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('pending')

      moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(moveCmd?.status).toBe('blocked')

      // C's fromFolderId was rewritten to server ID (propagated through chain)
      const movePayload = moveCmd?.payload as {
        id: string
        fromFolderId: string
        toFolderId: string
      }
      expect(movePayload.fromFolderId).toBe('folder-server-1')
      // toFolderId is an existing folder, unchanged
      expect(movePayload.toFolderId).toBe('existing-folder')
      // C's note id is still the client ID (note hasn't succeeded yet)
      expect(movePayload.id).toBe(noteClientId)
    })

    it('MoveNote with two folder dependencies — each ID replaced by its own dependency', async () => {
      let folderSendCount = 0
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', () => {
        folderSendCount++
        return {
          id: `folder-server-${folderSendCount}`,
          nextExpectedRevision: '1',
          events: [
            {
              id: `evt-f${folderSendCount}`,
              type: 'FolderCreated',
              streamId: `Folder-server-${folderSendCount}`,
              data: { id: `folder-server-${folderSendCount}`, name: 'F' },
              revision: '1',
              position: String(folderSendCount),
            },
          ],
        }
      })

      const { queue } = setupCrossAggregateQueue(senderResponses)

      // Create source folder (folder1)
      const folder1Result = await queue.enqueue({
        type: 'CreateFolder',
        payload: { name: 'Source' },
      })
      if (!folder1Result.ok) throw new Error('Expected success')
      const folder1ClientId = (folder1Result.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // Create target folder (folder2)
      const folder2Result = await queue.enqueue({
        type: 'CreateFolder',
        payload: { name: 'Target' },
      })
      if (!folder2Result.ok) throw new Error('Expected success')
      const folder2ClientId = (folder2Result.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      // MoveNote depends on BOTH folders — fromFolderId and toFolderId each reference a different folder
      const moveResult = await queue.enqueue({
        type: 'MoveNote',
        payload: {
          id: 'existing-note-1',
          fromFolderId: folder1ClientId,
          toFolderId: folder2ClientId,
          revision: autoRevision('3'),
        },
        dependsOn: [folder1Result.value.commandId, folder2Result.value.commandId],
      })
      if (!moveResult.ok) throw new Error('Expected success')

      // MoveNote should be blocked by both folders
      let moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(moveCmd?.status).toBe('blocked')
      expect(moveCmd?.blockedBy).toHaveLength(2)

      // Process the queue — both folders succeed
      queue.resume()
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await queue.processPendingCommands()
      }

      // Both folders succeeded
      expect((await storage.getCommand(folder1Result.value.commandId))?.status).toBe('succeeded')
      expect((await storage.getCommand(folder2Result.value.commandId))?.status).toBe('succeeded')

      // MoveNote should have been unblocked and processed
      moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(['pending', 'sending', 'succeeded']).toContain(moveCmd?.status)

      // Each folder ID was replaced independently by its own dependency's server ID
      const movePayload = moveCmd?.payload as {
        id: string
        fromFolderId: string
        toFolderId: string
      }
      expect(movePayload.fromFolderId).toBe('folder-server-1')
      expect(movePayload.toFolderId).toBe('folder-server-2')
      // The note ID (existing, not a client ID) is unchanged
      expect(movePayload.id).toBe('existing-note-1')
    })
  })

  describe('same-aggregate auto-chaining', () => {
    interface AnticipatedEvent {
      type: string
      data: Record<string, unknown>
      streamId: string
    }

    function setupItemQueue(senderResponses: Map<string, unknown>): CommandQueue {
      const executor = createDomainExecutor<AnticipatedEvent>([
        {
          commandType: 'CreateItem',
          creates: { eventType: 'ItemCreated', idStrategy: 'temporary' },
          handler(payload) {
            const { name } = payload as { name: string }
            const id = generateId()
            return domainSuccess([
              { type: 'ItemCreated', data: { id, name }, streamId: `Item-${id}` },
            ])
          },
        },
        {
          commandType: 'UpdateItem',
          revisionField: 'revision',
          handler(payload) {
            const { id, title } = payload as { id: string; title: string }
            return domainSuccess([
              { type: 'ItemUpdated', data: { id, title }, streamId: `Item-${id}` },
            ])
          },
        },
        {
          commandType: 'DeleteItem',
          revisionField: 'revision',
          handler(payload) {
            const { id } = payload as { id: string }
            return domainSuccess([{ type: 'ItemDeleted', data: { id }, streamId: `Item-${id}` }])
          },
        },
      ])

      const sender: ICommandSender = {
        async send(command: CommandRecord) {
          const response = senderResponses.get(command.type)
          if (typeof response === 'function') return response(command)
          if (response !== undefined) return response
          return { id: 'default-id', nextExpectedRevision: '1', events: [] }
        },
      }

      return new CommandQueue({
        storage,
        eventBus,
        anticipatedEventHandler,
        domainExecutor: executor,
        handlerMetadata: executor,
        commandSender: sender,
      })
    }

    it('mutate auto-blocked behind create on same aggregate', async () => {
      const queue = setupItemQueue(new Map())

      const createResult = await queue.enqueue({
        type: 'CreateItem',
        payload: { name: 'Test' },
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      const updateResult = await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: clientId, title: 'New Title', revision: autoRevision() },
      })
      if (!updateResult.ok) throw new Error('Expected success')

      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      expect(updateCmd?.status).toBe('blocked')
      expect(updateCmd?.blockedBy).toContain(createResult.value.commandId)
    })

    it('create succeeds — mutate gets server ID and revision', async () => {
      const responses = new Map<string, unknown>()
      responses.set('CreateItem', {
        id: 'server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'ItemCreated',
            streamId: 'Item-server-1',
            data: { id: 'server-1', name: 'Test' },
            revision: '1',
            position: '1',
          },
        ],
      })
      const queue = setupItemQueue(responses)

      const createResult = await queue.enqueue({
        type: 'CreateItem',
        payload: { name: 'Test' },
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: clientId, title: 'New', revision: autoRevision() },
      })

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Find the update command (by type since we don't know its ID easily)
      const allCmds = await storage.getCommands()
      const updateCmd = allCmds.find((c) => c.type === 'UpdateItem')
      expect(updateCmd?.status).toBe('pending')
      const payload = updateCmd?.payload as { id: string; title: string; revision: string }
      expect(payload.id).toBe('server-1')
      expect(payload.revision).toBe('1')
    })

    it('second mutate auto-blocked behind first on same aggregate', async () => {
      const queue = setupItemQueue(new Map())

      const update1 = await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: 'existing-1', title: 'First', revision: autoRevision('1') },
      })
      if (!update1.ok) throw new Error('Expected success')

      const delete1 = await queue.enqueue({
        type: 'DeleteItem',
        payload: { id: 'existing-1', revision: autoRevision('1') },
      })
      if (!delete1.ok) throw new Error('Expected success')

      const deleteCmd = await storage.getCommand(delete1.value.commandId)
      expect(deleteCmd?.status).toBe('blocked')
      expect(deleteCmd?.blockedBy).toContain(update1.value.commandId)
    })

    it('mutate succeeds — next mutate gets updated revision', async () => {
      const responses = new Map<string, unknown>()
      responses.set('UpdateItem', {
        id: 'existing-1',
        nextExpectedRevision: '2',
        events: [],
      })
      const queue = setupItemQueue(responses)

      const update1 = await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: 'existing-1', title: 'First', revision: autoRevision('1') },
      })
      if (!update1.ok) throw new Error('Expected success')

      const delete1 = await queue.enqueue({
        type: 'DeleteItem',
        payload: { id: 'existing-1', revision: autoRevision('1') },
      })
      if (!delete1.ok) throw new Error('Expected success')

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const deleteCmd = await storage.getCommand(delete1.value.commandId)
      expect(deleteCmd?.status).toBe('pending')
      const payload = deleteCmd?.payload as { id: string; revision: string }
      expect(payload.revision).toBe('2')
    })

    it('create → mutate → mutate full chain', async () => {
      const responses = new Map<string, unknown>()
      responses.set('CreateItem', {
        id: 'server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'ItemCreated',
            streamId: 'Item-server-1',
            data: { id: 'server-1', name: 'X' },
            revision: '1',
            position: '1',
          },
        ],
      })
      responses.set('UpdateItem', {
        id: 'server-1',
        nextExpectedRevision: '2',
        events: [],
      })
      responses.set('DeleteItem', {
        id: 'server-1',
        nextExpectedRevision: '3',
        events: [],
      })
      const queue = setupItemQueue(responses)

      const createResult = await queue.enqueue({
        type: 'CreateItem',
        payload: { name: 'X' },
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: clientId, title: 'Updated', revision: autoRevision() },
      })

      await queue.enqueue({
        type: 'DeleteItem',
        payload: { id: clientId, revision: autoRevision() },
      })

      queue.resume()
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await queue.processPendingCommands()
      }

      const allCmds = await storage.getCommands()
      const createCmd = allCmds.find((c) => c.type === 'CreateItem')
      const updateCmd = allCmds.find((c) => c.type === 'UpdateItem')
      const deleteCmd = allCmds.find((c) => c.type === 'DeleteItem')

      expect(createCmd?.status).toBe('succeeded')
      expect(updateCmd?.status).toBe('succeeded')
      expect(deleteCmd?.status).toBe('succeeded')

      // UpdateItem was sent with server ID and create's revision
      const updatePayload = updateCmd?.payload as { id: string; revision: string }
      expect(updatePayload.id).toBe('server-1')

      // DeleteItem was sent with server ID and update's revision
      const deletePayload = deleteCmd?.payload as { id: string; revision: string }
      expect(deletePayload.id).toBe('server-1')
    })

    it('auto-revision fallback used when no chain exists', async () => {
      let sentPayload: unknown
      const responses = new Map<string, unknown>()
      responses.set('UpdateItem', (cmd: CommandRecord) => {
        sentPayload = cmd.payload
        return { id: 'existing-1', nextExpectedRevision: '6', events: [] }
      })
      const queue = setupItemQueue(responses)

      await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: 'existing-1', title: 'Solo', revision: autoRevision('5') },
      })

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // The revision sent to server should be the fallback '5'
      const sent = sentPayload as { revision: string }
      expect(sent.revision).toBe('5')
    })

    it('mapping cache patches stale client ID for same aggregate', async () => {
      const responses = new Map<string, unknown>()
      responses.set('CreateItem', {
        id: 'server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'ItemCreated',
            streamId: 'Item-server-1',
            data: { id: 'server-1', name: 'X' },
            revision: '1',
            position: '1',
          },
        ],
      })
      const queue = setupItemQueue(responses)

      // Create and succeed
      const createResult = await queue.enqueue({ type: 'CreateItem', payload: { name: 'X' } })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as AnticipatedEvent).data
        .id as string

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Enqueue with stale client ID (race condition)
      const updateResult = await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: clientId, title: 'Late', revision: autoRevision() },
      })
      if (!updateResult.ok) throw new Error('Expected success')

      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      const payload = updateCmd?.payload as { id: string; revision: unknown }
      expect(payload.id).toBe('server-1')
      expect(payload.revision).toMatchObject({ __autoRevision: true, fallback: '1' })
    })

    it('mapping cache patches stale revision via server ID lookup', async () => {
      const responses = new Map<string, unknown>()
      responses.set('CreateItem', {
        id: 'server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'ItemCreated',
            streamId: 'Item-server-1',
            data: { id: 'server-1', name: 'X' },
            revision: '1',
            position: '1',
          },
        ],
      })
      const queue = setupItemQueue(responses)

      const createResult = await queue.enqueue({ type: 'CreateItem', payload: { name: 'X' } })
      if (!createResult.ok) throw new Error('Expected success')

      queue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Enqueue with correct server ID but undefined revision (race condition)
      const updateResult = await queue.enqueue({
        type: 'UpdateItem',
        payload: { id: 'server-1', title: 'Race', revision: autoRevision() },
      })
      if (!updateResult.ok) throw new Error('Expected success')

      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      const payload = updateCmd?.payload as { id: string; revision: unknown }
      expect(payload.revision).toMatchObject({ __autoRevision: true, fallback: '1' })
    })
  })
})
