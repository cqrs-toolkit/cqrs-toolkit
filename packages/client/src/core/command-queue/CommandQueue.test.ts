/**
 * Unit tests for CommandQueue.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { CommandRecord } from '../../types/commands.js'
import type { IDomainExecutor } from '../../types/domain.js'
import { domainFailure, domainSuccess } from '../../types/domain.js'
import { EventBus } from '../events/EventBus.js'
import { CommandQueue } from './CommandQueue.js'
import type { ICommandSender } from './types.js'
import { CommandSendError } from './types.js'

describe('CommandQueue', () => {
  let storage: InMemoryStorage
  let eventBus: EventBus
  let commandQueue: CommandQueue

  beforeEach(async () => {
    storage = new InMemoryStorage()
    await storage.initialize()
    eventBus = new EventBus()
    commandQueue = new CommandQueue({ storage, eventBus })
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
      commandQueue = new CommandQueue({ storage, eventBus, domainExecutor })
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
      commandQueue = new CommandQueue({ storage, eventBus, domainExecutor })

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
      commandQueue.destroy()

      // Wait long enough for any scheduled retry to have fired if not cleared
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Send should not have been called again after destroy
      expect(commandSender.send).toHaveBeenCalledTimes(1)
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
      const queue = new CommandQueue({ storage, eventBus, retainTerminal: true })
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
})
