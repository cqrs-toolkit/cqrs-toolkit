/**
 * Unit tests for CommandQueue.
 */

import { Err, Ok, type AggregateEventData, type Result, type ServiceLink } from '@meticoeus/ddd-es'
import { Subject } from 'rxjs'
import { describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import { crossAggregateDomainExecutor, itemDomainExecutor } from '../../testing/domainExecutor.js'
import {
  FolderAggregate,
  ItemAggregate,
  NoteAggregate,
  NotebookAggregate,
  parseTestStreamId,
  TodoAggregate,
} from '../../testing/index.js'
import { IClientAggregates } from '../../types/aggregates.js'
import type { CommandEvent, CommandRecord, EnqueueCommand } from '../../types/commands.js'
import { CommandFailedException } from '../../types/commands.js'
import { autoRevision, domainFailure, domainSuccess, IDomainExecutor } from '../../types/domain.js'
import { isValidationException } from '../../types/validation.js'
import { deriveScopeKey } from '../cache-manager/CacheKey.js'
import { CommandIdMappingStore } from '../command-id-mapping-store/CommandIdMappingStore.js'
import { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type { IAnticipatedEventHandler } from '../command-lifecycle/IAnticipatedEventHandler.js'
import { CommandStore } from '../command-store/CommandStore.js'
import { EventBus } from '../events/EventBus.js'
import { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import type { CommandQueueConfig } from './CommandQueue.js'
import { CommandQueue } from './CommandQueue.js'
import type { ICommandFileStore } from './file-store/ICommandFileStore.js'
import { InMemoryCommandFileStore } from './file-store/InMemoryCommandFileStore.js'
import type { ICommandSender } from './types.js'
import { CommandSendException } from './types.js'

const TODOS_CACHE_KEY = deriveScopeKey({ scopeType: 'todos' })

// Minimal registration for tests that mock the domain executor. The library now
// requires a registration entry for the library pipeline (patch → strip →
// validate → handle → aggregate derivation) to run; without one, the command
// becomes a server-only pass-through and the test's mocked validate/handle
// never fire. Tests that need the executor exercised return this from
// `getRegistration`.
const mockRegistration = {
  commandType: '',
  aggregate: TodoAggregate,
  commandIdReferences: [],
  handler: () => domainSuccess([]),
}

class TestCommandQueue extends CommandQueue<
  ServiceLink,
  EnqueueCommand,
  unknown,
  IAnticipatedEvent
> {
  getCommandEvents(): Subject<CommandEvent> {
    return this.commandEvents
  }

  /** Expose the private rebuildChains for direct invocation in rebuild tests. */
  rebuildChainsForTest(): Promise<void> {
    return this.rebuildChains()
  }

  /** Inspect the chain registry after a rebuild. */
  getChainByStreamId(streamId: string) {
    return this.chains.get(streamId)
  }

  getChainCount(): number {
    return this.chains.size
  }
}

describe('CommandQueue', () => {
  interface BootstrapParams extends CommandQueueConfig<
    ServiceLink,
    EnqueueCommand,
    unknown,
    IAnticipatedEvent
  > {}

  interface BootstrapResult {
    storage: InMemoryStorage<ServiceLink, EnqueueCommand>
    eventBus: EventBus<ServiceLink>
    anticipatedEventHandler: IAnticipatedEventHandler<ServiceLink, EnqueueCommand> & {
      cache: ReturnType<typeof vi.fn>
      cleanupOnSucceeded: ReturnType<typeof vi.fn>
      cleanupOnAppliedBatch: ReturnType<typeof vi.fn>
      cleanupOnFailure: ReturnType<typeof vi.fn>
      clearAll: ReturnType<typeof vi.fn>
    }
    fileStore: ICommandFileStore
    readModelStore: ReadModelStore<ServiceLink, EnqueueCommand>
    commandStore: CommandStore<ServiceLink, EnqueueCommand>
    mappingStore: CommandIdMappingStore<ServiceLink, EnqueueCommand>
  }

  /**
   * Optional hook: pre-populate raw storage before any in-memory store
   * initializes. Runs after `storage.initialize()` and before the mapping /
   * command stores load their indices — the same point at which a worker
   * restart would see pre-existing persisted state.
   */
  type SeedStorage = (storage: InMemoryStorage<ServiceLink, EnqueueCommand>) => Promise<void> | void

  async function bootstrap(
    params: BootstrapParams & { customCommandQueue: true; seedStorage?: SeedStorage },
  ): Promise<BootstrapResult & { commandQueue: undefined }>
  async function bootstrap(
    params?: BootstrapParams & { seedStorage?: SeedStorage },
  ): Promise<BootstrapResult & { commandQueue: TestCommandQueue }>
  async function bootstrap(
    params?: BootstrapParams & {
      customCommandQueue?: boolean
      seedStorage?: SeedStorage
    },
  ): Promise<BootstrapResult & { commandQueue: TestCommandQueue | undefined }> {
    const { customCommandQueue, seedStorage, ...config } = params ?? {}
    const storage = new InMemoryStorage<ServiceLink, EnqueueCommand>()
    await storage.initialize()

    if (seedStorage) {
      await seedStorage(storage)
    }

    const eventBus = new EventBus<ServiceLink>()

    const anticipatedEventHandler: BootstrapResult['anticipatedEventHandler'] = {
      cache: vi.fn().mockResolvedValue(undefined),
      cleanupOnSucceeded: vi.fn().mockResolvedValue(undefined),
      cleanupOnAppliedBatch: vi.fn().mockResolvedValue(undefined),
      cleanupOnFailure: vi.fn().mockResolvedValue(undefined),
      regenerate: vi.fn().mockResolvedValue(undefined),
      getTrackedEntries: vi.fn().mockReturnValue(undefined),
      setTrackedEntries: vi.fn(),
      clearAll: vi.fn().mockResolvedValue(undefined),
    }

    const fileStore = new InMemoryCommandFileStore()

    const aggregates: IClientAggregates<ServiceLink> = {
      aggregates: [TodoAggregate, NoteAggregate, NotebookAggregate, ItemAggregate, FolderAggregate],
      parseStreamId: parseTestStreamId,
    }

    const mappingStore = new CommandIdMappingStore<ServiceLink, EnqueueCommand>(storage)
    await mappingStore.initialize()

    const readModelStore = new ReadModelStore<ServiceLink, EnqueueCommand>(
      eventBus,
      storage,
      mappingStore,
    )

    const commandStore = new CommandStore(storage)
    await commandStore.initialize()

    const commandQueue = params?.customCommandQueue
      ? undefined
      : new TestCommandQueue(
          eventBus,
          storage,
          fileStore,
          anticipatedEventHandler,
          aggregates,
          readModelStore,
          commandStore,
          mappingStore,
          config,
        )

    return {
      storage,
      eventBus,
      anticipatedEventHandler,
      fileStore,
      readModelStore,
      commandStore,
      mappingStore,
      commandQueue,
    }
  }

  describe('enqueue', () => {
    it('enqueues a command and returns success', async () => {
      const { commandQueue } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: 'Test todo' } },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.commandId).toBeDefined()
        expect(result.value.anticipatedEvents).toEqual([])
      }
    })

    it('uses provided commandId', async () => {
      const { commandQueue } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: {} },
        commandId: 'custom-id-123',
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.commandId).toBe('custom-id-123')
      }
    })

    it('saves command to storage', async () => {
      const { commandQueue, storage } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: 'Test' }, service: 'todo-service' },
        cacheKey: TODOS_CACHE_KEY,
      })

      if (!result.ok) throw new Error('Expected success')

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored).toMatchObject({
        type: 'CreateTodo',
        data: { title: 'Test' },
        service: 'todo-service',
        status: 'pending',
      })
    })

    it('emits enqueued event', async () => {
      const { commandQueue } = await bootstrap()
      const events: unknown[] = []
      commandQueue.events$.subscribe((e) => events.push(e))

      await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        eventType: 'enqueued',
        type: 'CreateTodo',
        status: 'pending',
      })
    })

    it('emits to library event bus', async () => {
      const { commandQueue, eventBus } = await bootstrap()
      const events: unknown[] = []
      eventBus.on('command:enqueued').subscribe((e) => events.push(e))

      await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(events).toHaveLength(1)
    })
  })

  describe('enqueue with domain validation', () => {
    it('returns validation errors when domain validation fails', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })
      vi.mocked(domainExecutor.validate).mockReturnValue(
        Promise.resolve(
          domainFailure([
            { path: 'title', code: 'required', message: 'Title is required', params: {} },
          ]),
        ),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: '' } },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(isValidationException(result.error)).toBe(true)
        if (!isValidationException(result.error)) return
        expect(result.error.details).toHaveLength(1)
        expect(result.error.details?.[0]).toMatchObject({
          path: 'title',
          code: 'required',
          message: 'Title is required',
          params: {},
        })
      }
    })

    it('returns anticipated events on successful validation', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent<'TodoCreated', { id: string; title: string }>
      > = {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })
      const events: IAnticipatedEvent<'TodoCreated', { id: string; title: string }>[] = [
        {
          streamId: 'nb.Todo-1',
          type: 'TodoCreated',
          data: { id: '1', title: 'Test' },
        },
      ]
      vi.mocked(domainExecutor.validate).mockResolvedValue(Ok({ title: 'Test' }))
      vi.mocked(domainExecutor.handle).mockReturnValue(domainSuccess(events))

      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: 'Test' } },
        cacheKey: TODOS_CACHE_KEY,
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
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })
      vi.mocked(domainExecutor.validate).mockResolvedValue(
        domainFailure([
          { path: 'title', code: 'required', message: 'Title is required', params: {} },
        ]),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: '' } },
        skipValidation: true,
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.ok).toBe(true)
      expect(domainExecutor.validate).not.toHaveBeenCalled()
    })
  })

  describe('enqueue with modelState', () => {
    it('forwards modelState from params to domainExecutor.validate', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn().mockResolvedValue(Ok({})),
        handle: vi.fn().mockReturnValue(domainSuccess([])),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })

      const snapshot = { id: 'todo-1', title: 'Before edit' }
      await commandQueue.enqueue({
        command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'After edit' } },
        cacheKey: TODOS_CACHE_KEY,
        modelState: snapshot,
      })

      expect(domainExecutor.validate).toHaveBeenCalledTimes(1)
      expect(vi.mocked(domainExecutor.validate).mock.calls[0]?.[1]).toBe(snapshot)
    })

    it('forwards modelState from params to domainExecutor.handle', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn().mockResolvedValue(Ok({})),
        handle: vi.fn().mockReturnValue(domainSuccess([])),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })

      const snapshot = { id: 'todo-1', title: 'Before edit' }
      await commandQueue.enqueue({
        command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'After edit' } },
        cacheKey: TODOS_CACHE_KEY,
        modelState: snapshot,
      })

      expect(domainExecutor.handle).toHaveBeenCalledTimes(1)
      expect(vi.mocked(domainExecutor.handle).mock.calls[0]?.[1]).toBe(snapshot)
    })

    it('persists modelState on the command record for pipeline re-runs', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn().mockResolvedValue(Ok({})),
        handle: vi.fn().mockReturnValue(domainSuccess([])),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue, storage } = await bootstrap({ domainExecutor })

      const snapshot = { id: 'todo-1', title: 'Before edit' }
      const result = await commandQueue.enqueue({
        command: { type: 'UpdateTodo', data: { id: 'todo-1', title: 'After edit' } },
        cacheKey: TODOS_CACHE_KEY,
        modelState: snapshot,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.modelState).toEqual(snapshot)
    })

    it('passes undefined for modelState when the caller omits it', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn().mockResolvedValue(Ok({})),
        handle: vi.fn().mockReturnValue(domainSuccess([])),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })

      await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: 'Fresh' } },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(domainExecutor.validate).toHaveBeenCalledTimes(1)
      expect(vi.mocked(domainExecutor.validate).mock.calls[0]?.[1]).toBeUndefined()
      expect(domainExecutor.handle).toHaveBeenCalledTimes(1)
      expect(vi.mocked(domainExecutor.handle).mock.calls[0]?.[1]).toBeUndefined()
    })
  })

  describe('enqueue with dependencies', () => {
    it('marks command as blocked when it has unresolved dependencies', async () => {
      const { commandQueue, storage } = await bootstrap()
      // First command
      const first = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!first.ok) throw new Error('Expected success')

      // Second command depends on first
      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {}, dependsOn: [first.value.commandId] },
        cacheKey: TODOS_CACHE_KEY,
      })

      if (!second.ok) throw new Error('Expected success')

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('blocked')
      expect(storedSecond?.blockedBy).toContain(first.value.commandId)
    })

    it('marks command as pending when all dependencies are resolved', async () => {
      const { commandQueue, storage } = await bootstrap()
      // Create and complete first command
      const first: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId: 'cmd-1',
        cacheKey: TODOS_CACHE_KEY,
        service: 'test',
        type: 'First',
        data: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        seq: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(first)

      // Second command depends on first (which is already completed)
      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {}, dependsOn: ['cmd-1'] },
        cacheKey: TODOS_CACHE_KEY,
      })

      if (!second.ok) throw new Error('Expected success')

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('pending')
      expect(storedSecond?.blockedBy).toHaveLength(0)
    })
  })

  describe('waitForCompletion', () => {
    it('returns immediately if command is already succeeded', async () => {
      const { commandQueue, storage } = await bootstrap()
      const command: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId: 'cmd-1',
        cacheKey: TODOS_CACHE_KEY,
        service: 'test',
        type: 'Test',
        data: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        seq: 0,
        serverResponse: { id: '123' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      const result = await commandQueue.waitForCompletion('cmd-1')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual({ id: '123' })
      }
    })

    it('returns immediately if command is already failed', async () => {
      const { commandQueue, storage } = await bootstrap()
      const command: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId: 'cmd-1',
        cacheKey: TODOS_CACHE_KEY,
        service: 'test',
        type: 'Test',
        data: {},
        status: 'failed',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        seq: 0,
        error: new CommandFailedException('server', 'Bad request'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      const result = await commandQueue.waitForCompletion('cmd-1')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toBe('Bad request')
      }
    })

    it('returns failed for non-existent command', async () => {
      const { commandQueue } = await bootstrap()
      const result = await commandQueue.waitForCompletion('non-existent')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('Command not found')
      }
    })

    it('times out if command does not complete', async () => {
      const { commandQueue, storage } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      const completionResult = await commandQueue.waitForCompletion(result.value.commandId, {
        timeout: 50,
      })

      expect(completionResult.ok).toBe(false)
      if (!completionResult.ok) {
        expect(completionResult.error.name).toBe('CommandTimeout')
      }
    })

    it('waits for command to complete', async () => {
      const { commandQueue, storage } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      // Simulate completion in background
      setTimeout(async () => {
        await storage.updateCommand(result.value.commandId, {
          status: 'succeeded',
          serverResponse: { done: true },
        })
        commandQueue.getCommandEvents().next({
          eventType: 'completed',
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

      expect(completionResult.ok).toBe(true)
    })
  })

  describe('enqueueAndWait', () => {
    it('returns validation errors immediately', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: async () =>
          domainFailure([{ path: 'email', code: 'invalid', message: 'Invalid email', params: {} }]),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { commandQueue } = await bootstrap({ domainExecutor })

      const result = await commandQueue.enqueueAndWait({
        command: { type: 'CreateUser', data: { email: 'invalid' } },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(isValidationException(result.error)).toBe(true)
        if (!isValidationException(result.error)) return
        expect(result.error.details?.[0]).toMatchObject({ path: 'email' })
      }
    })
  })

  describe('commandEvents$', () => {
    it('filters events to specific command', async () => {
      const { commandQueue } = await bootstrap()
      const events: unknown[] = []
      const result1 = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result1.ok) throw new Error('Expected success')

      commandQueue.commandEvents$(result1.value.commandId).subscribe((e) => events.push(e))

      await commandQueue.enqueue({
        command: { type: 'Second', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      // Only the first command event was already emitted before subscribing
      // New events for second command should not appear
      expect(events).toHaveLength(0)
    })
  })

  describe('cancelCommand', () => {
    it('cancels a pending command', async () => {
      const { commandQueue, storage } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.cancelCommand(result.value.commandId)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('cancelled')
    })

    it('returns error when command does not exist', async () => {
      const { commandQueue } = await bootstrap()
      const result = await commandQueue.cancelCommand('non-existent')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.name).toBe('CommandNotFound')
      }
    })

    it('returns error when command is already succeeded', async () => {
      const { commandQueue, storage } = await bootstrap()
      const command: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId: 'cmd-1',
        cacheKey: TODOS_CACHE_KEY,
        service: 'test',
        type: 'Test',
        data: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        seq: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await storage.saveCommand(command)

      const result = await commandQueue.cancelCommand('cmd-1')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.name).toBe('InvalidCommandStatus')
      }
    })

    it('emits cancelled event', async () => {
      const { commandQueue } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      const events: unknown[] = []
      commandQueue.commandEvents$(result.value.commandId).subscribe((e) => events.push(e))

      await commandQueue.cancelCommand(result.value.commandId)

      // Two events fire per cancel: the `status-changed` at the status flip
      // and the terminal `cancelled` CommandEvent after — the latter is
      // what `waitForCompletion` subscribers use.
      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({
        eventType: 'status-changed',
        status: 'cancelled',
        previousStatus: 'pending',
      })
      expect(events[1]).toMatchObject({
        eventType: 'cancelled',
        status: 'cancelled',
      })
    })

    it('emits command:status-changed to library event bus', async () => {
      const { commandQueue, eventBus } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      const events: unknown[] = []
      eventBus.on('command:status-changed').subscribe((e) => events.push(e))

      await commandQueue.cancelCommand(result.value.commandId)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'command:status-changed',
        data: {
          commandId: result.value.commandId,
          status: 'cancelled',
          previousStatus: 'pending',
        },
      })
    })
  })

  describe('retryCommand', () => {
    it('retries a failed command', async () => {
      const { commandQueue, storage } = await bootstrap()
      const command: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId: 'cmd-1',
        cacheKey: TODOS_CACHE_KEY,
        service: 'test',
        type: 'Test',
        data: {},
        status: 'failed',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        seq: 0,
        error: new CommandFailedException('server', 'Failed'),
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
      const { commandQueue } = await bootstrap()
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      const retryResult = await commandQueue.retryCommand(result.value.commandId)
      expect(retryResult.ok).toBe(false)
      if (!retryResult.ok) {
        expect(retryResult.error.name).toBe('InvalidCommandStatus')
      }
    })
  })

  describe('command processing', () => {
    function buildTestConfig() {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      return {
        commandSender,
        retryConfig: { maxAttempts: 3, initialDelay: 10 },
      } satisfies BootstrapParams
    }

    it('processes pending commands when resumed', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await commandQueue.processPendingCommands()

      expect(commandSender.send).toHaveBeenCalledTimes(1)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('succeeded')
      expect(stored?.serverResponse).toEqual({ id: '123' })
    })

    it('does not process commands when paused', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      // Queue starts paused
      await commandQueue.processPendingCommands()

      expect(commandSender.send).not.toHaveBeenCalled()
    })

    it('retries failed commands up to maxAttempts', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      vi.mocked(commandSender.send)
        .mockResolvedValueOnce(Err(new CommandSendException('Network error', 'NETWORK', true)))
        .mockResolvedValueOnce(Err(new CommandSendException('Network error', 'NETWORK', true)))
        .mockResolvedValueOnce(Ok({ id: '123' }))

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()

      // Wait for retries to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(commandSender.send).toHaveBeenCalledTimes(3)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('succeeded')
    })

    it('marks command as failed after max retries', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      vi.mocked(commandSender.send).mockResolvedValue(
        Err(new CommandSendException('Network error', 'NETWORK', true)),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()

      // Wait for all retries to complete
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(commandSender.send).toHaveBeenCalledTimes(3)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('failed')
    })

    it('does not retry non-retryable errors', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      vi.mocked(commandSender.send).mockResolvedValue(
        Err(new CommandSendException('Validation error', 'VALIDATION', false)),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(commandSender.send).toHaveBeenCalledTimes(1)

      const stored = await storage.getCommand(result.value.commandId)
      expect(stored?.status).toBe('failed')
    })

    it('unblocks dependent commands on success', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      const first = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {}, dependsOn: [first.value.commandId] },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!second.ok) throw new Error('Expected success')

      // Second should be blocked
      let storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('blocked')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // First should be succeeded and second should be unblocked
      const storedFirst = await storage.getCommand(first.value.commandId)
      expect(storedFirst?.status).toBe('succeeded')

      storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('pending')
      expect(storedSecond?.blockedBy).toHaveLength(0)
    })

    it('processes commands enqueued during an active processing pass', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      // First send blocks; subsequent sends resolve immediately
      let resolveSend: ((value: Result<unknown, CommandSendException>) => void) | undefined
      vi.mocked(commandSender.send)
        .mockImplementationOnce(() => new Promise((resolve) => (resolveSend = resolve)))
        .mockResolvedValue(Ok({ id: '2' }))

      await commandQueue.resume()
      // Let resume's empty processing pass complete before enqueuing
      await new Promise((resolve) => setTimeout(resolve, 0))

      const first = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!first.ok) throw new Error('Expected success')

      // First command is now in-flight (send is blocked)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Enqueue a second command while the first is still processing
      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!second.ok) throw new Error('Expected success')

      // Complete the first send — this should trigger reprocessing of the second
      resolveSend!(Ok({ id: '1' }))
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Without the reprocess fix, the second command stays pending forever
      expect(commandSender.send).toHaveBeenCalledTimes(2)

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('succeeded')
    })

    it('does not process a command cancelled during an earlier send', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      // First send blocks via deferred promise; second should never be called
      let resolveSend: ((value: Result<unknown, CommandSendException>) => void) | undefined
      vi.mocked(commandSender.send)
        .mockImplementationOnce(() => new Promise((resolve) => (resolveSend = resolve)))
        .mockResolvedValue(Ok({ id: '2' }))

      // Enqueue both commands while paused so they are in the same batch
      const first = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!second.ok) throw new Error('Expected success')

      // Resume — processing snapshots both commands. Do not await: resume
      // awaits drain, and the first send is deferred, so the mid-flight
      // inspection below would deadlock.
      const resumePromise = commandQueue.resume()

      // Wait for first command to start sending (blocks on deferred)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(commandSender.send).toHaveBeenCalledTimes(1)

      // Cancel the second command while the first is mid-send
      await commandQueue.cancelCommand(second.value.commandId)

      // Resolve the first send — processing loop continues to second
      resolveSend!(Ok({ id: '1' }))
      await resumePromise

      // Second command should remain cancelled, send should only have been called once
      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('cancelled')
      expect(commandSender.send).toHaveBeenCalledTimes(1)
    })

    it('clears retry timers on destroy', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      const { commandQueue, storage } = await bootstrap({
        commandSender,
        // Use a long retry delay so the timer is still pending when we destroy
        retryConfig: { maxAttempts: 3, initialDelay: 500 },
      })

      vi.mocked(commandSender.send).mockResolvedValue(
        Err(new CommandSendException('Network error', 'NETWORK', true)),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()

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
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      let resolveSend: ((value: Result<unknown, CommandSendException>) => void) | undefined
      vi.mocked(commandSender.send).mockImplementation(
        () => new Promise((resolve) => (resolveSend = resolve)),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      // Resume drains the queue, but the first send is deferred, so do not
      // await: destroy-during-in-flight is the scenario under test.
      const resumePromise = commandQueue.resume()
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
      resolveSend!(Ok({ id: '123' }))

      // Now destroy should resolve
      await destroyPromise
      await resumePromise
      expect(destroyResolved).toBe(true)
    })

    it('cancels dependent commands on failure', async () => {
      const config = buildTestConfig()
      const { commandSender } = config
      const { commandQueue, storage } = await bootstrap(config)
      vi.mocked(commandSender.send).mockResolvedValue(
        Err(new CommandSendException('Error', 'ERROR', false)),
      )

      const first = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {}, dependsOn: [first.value.commandId] },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!second.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const storedFirst = await storage.getCommand(first.value.commandId)
      expect(storedFirst?.status).toBe('failed')

      const storedSecond = await storage.getCommand(second.value.commandId)
      expect(storedSecond?.status).toBe('cancelled')
    })
  })

  describe('listCommands', () => {
    it('returns all commands', async () => {
      const { commandQueue } = await bootstrap()
      await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      await commandQueue.enqueue({
        command: { type: 'Second', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      const commands = await commandQueue.listCommands()

      expect(commands).toHaveLength(2)
    })

    it('filters by status', async () => {
      const { commandQueue } = await bootstrap()
      await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!second.ok) throw new Error('Expected success')

      await commandQueue.cancelCommand(second.value.commandId)

      const pending = await commandQueue.listCommands({ status: 'pending' })
      const cancelled = await commandQueue.listCommands({ status: 'cancelled' })

      expect(pending).toHaveLength(1)
      expect(cancelled).toHaveLength(1)
    })
  })

  describe('pause/resume', () => {
    it('starts paused', async () => {
      const { commandQueue } = await bootstrap()
      expect(commandQueue.isPaused()).toBe(true)
    })

    it('can be resumed', async () => {
      const { commandQueue } = await bootstrap()
      await commandQueue.resume()
      expect(commandQueue.isPaused()).toBe(false)
    })

    it('can be paused', async () => {
      const { commandQueue } = await bootstrap()
      await commandQueue.resume()
      await commandQueue.pause()
      expect(commandQueue.isPaused()).toBe(true)
    })
  })

  describe('anticipated event caching', () => {
    it('calls cache() with correct commandId and events when domain executor succeeds', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({ domainExecutor })
      const events = [
        { type: 'TodoCreated', data: { id: '1', title: 'Test' }, streamId: 'nb.Todo-1' },
      ]
      vi.mocked(domainExecutor.validate).mockResolvedValue(Ok({ title: 'Test' }))
      vi.mocked(domainExecutor.handle).mockReturnValue(domainSuccess(events))

      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: 'Test' } },
        cacheKey: TODOS_CACHE_KEY,
      })

      if (!result.ok) throw new Error('Expected success')

      expect(anticipatedEventHandler.cache).toHaveBeenCalledTimes(1)
      const cacheCall = vi.mocked(anticipatedEventHandler.cache).mock.calls[0]![0]
      expect(cacheCall.command.commandId).toBe(result.value.commandId)
      expect(cacheCall.command.cacheKey.key).toBe(TODOS_CACHE_KEY.key)
      expect(cacheCall.events).toEqual(events)
      expect(cacheCall.clientId).toBeUndefined()
    })

    it('does not call cache() when domain executor is not configured', async () => {
      const { anticipatedEventHandler, commandQueue } = await bootstrap()

      await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(anticipatedEventHandler.cache).not.toHaveBeenCalled()
    })

    it('does not call cache() when anticipated events array is empty', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({ domainExecutor })
      vi.mocked(domainExecutor.validate).mockResolvedValue(Ok({}))
      vi.mocked(domainExecutor.handle).mockReturnValue(domainSuccess([]))

      await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(anticipatedEventHandler.cache).not.toHaveBeenCalled()
    })

    it('enqueue succeeds even if cache() throws', async () => {
      const domainExecutor: IDomainExecutor<
        ServiceLink,
        EnqueueCommand,
        unknown,
        IAnticipatedEvent
      > = {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(mockRegistration),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({ domainExecutor })
      const events = [
        { type: 'TodoCreated', data: { id: '1', title: 'Test' }, streamId: 'nb.Todo-1' },
      ]
      vi.mocked(domainExecutor.validate).mockResolvedValue(Ok({ title: 'Test' }))
      vi.mocked(domainExecutor.handle).mockReturnValue(domainSuccess(events))
      anticipatedEventHandler.cache.mockRejectedValue(new Error('Cache failure'))

      const result = await commandQueue.enqueue({
        command: { type: 'CreateTodo', data: { title: 'Test' } },
        cacheKey: TODOS_CACHE_KEY,
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.commandId).toBeDefined()
      }
    })
  })

  describe('anticipated event cleanup', () => {
    it('calls cleanup() when command succeeds', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({
        commandSender,
        retryConfig: { maxAttempts: 2, initialDelay: 10 },
      })
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await commandQueue.processPendingCommands()

      expect(anticipatedEventHandler.cleanupOnSucceeded).toHaveBeenCalledWith(
        result.value.commandId,
      )
    })

    it('calls cleanup() when command fails permanently', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({
        commandSender,
        retryConfig: { maxAttempts: 2, initialDelay: 10 },
      })
      vi.mocked(commandSender.send).mockResolvedValue(
        Err(new CommandSendException('Validation error', 'VALIDATION', false)),
      )

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(anticipatedEventHandler.cleanupOnFailure).toHaveBeenCalledWith(result.value.commandId)
    })

    it('calls cleanup() when command is cancelled', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({
        commandSender,
        retryConfig: { maxAttempts: 2, initialDelay: 10 },
      })
      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.cancelCommand(result.value.commandId)

      expect(anticipatedEventHandler.cleanupOnFailure).toHaveBeenCalledWith(result.value.commandId)
    })

    it('calls cleanup() for cascaded cancellations', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({
        commandSender,
        retryConfig: { maxAttempts: 2, initialDelay: 10 },
      })
      vi.mocked(commandSender.send).mockResolvedValue(
        Err(new CommandSendException('Error', 'ERROR', false)),
      )

      const first = await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!first.ok) throw new Error('Expected success')

      const second = await commandQueue.enqueue({
        command: { type: 'Second', data: {}, dependsOn: [first.value.commandId] },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!second.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Both first (failed) and second (cascaded cancel) route through cleanupOnFailure
      expect(anticipatedEventHandler.cleanupOnFailure).toHaveBeenCalledWith(first.value.commandId)
      expect(anticipatedEventHandler.cleanupOnFailure).toHaveBeenCalledWith(second.value.commandId)
    })

    it('does not call cleanup() on retry (stays pending)', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Ok({ id: '123' })),
      }
      const { anticipatedEventHandler, commandQueue, storage } = await bootstrap({
        commandSender,
        retryConfig: { maxAttempts: 2, initialDelay: 10 },
      })
      vi.mocked(commandSender.send)
        .mockResolvedValueOnce(Err(new CommandSendException('Network error', 'NETWORK', true)))
        .mockResolvedValueOnce(Ok({ id: '123' }))

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()

      // Wait for first attempt to fail and enter retry
      await new Promise((resolve) => setTimeout(resolve, 30))

      // After first failure (retry scheduled), cleanup should not have been called
      // because status went back to 'pending', not a terminal state
      const stored = await storage.getCommand(result.value.commandId)
      if (stored?.status === 'pending') {
        // The command is still pending (retrying), cleanup should not have been called yet
        expect(anticipatedEventHandler.cleanupOnSucceeded).not.toHaveBeenCalled()
        expect(anticipatedEventHandler.cleanupOnFailure).not.toHaveBeenCalled()
      }
    })
  })

  describe('batchUpdateSyncStatus', () => {
    async function seedSucceeded(
      cs: CommandStore<ServiceLink, EnqueueCommand>,
      commandId: string,
      coverage: string,
    ): Promise<CommandRecord<ServiceLink, EnqueueCommand>> {
      const record: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId,
        cacheKey: TODOS_CACHE_KEY,
        service: 'default',
        type: 'CreateTodo',
        data: {},
        status: 'succeeded',
        dependsOn: [],
        blockedBy: [],
        attempts: 1,
        serverResponse: { id: commandId },
        pendingAggregateCoverage: coverage,
        seq: 0,
        createdAt: 1000,
        updatedAt: 1000,
      }
      await cs.save(record)
      return record
    }

    it('transitions applied commands to applied status and clears pendingAggregateCoverage', async () => {
      const { commandQueue, commandStore } = await bootstrap()
      const record = await seedSucceeded(commandStore, 'cmd-applied', JSON.stringify('events'))

      await commandQueue.batchUpdateSyncStatus({ applied: [record] })
      await commandStore.flush()

      expect(record.status).toBe('applied')
      expect(record.pendingAggregateCoverage).toBeUndefined()
    })

    it('keeps updated commands in succeeded status and persists the new coverage', async () => {
      const { commandQueue, commandStore } = await bootstrap()
      const record = await seedSucceeded(
        commandStore,
        'cmd-updated',
        JSON.stringify({ 'nb.Todo-1': '42' }),
      )

      await commandQueue.batchUpdateSyncStatus({
        updated: [{ ...record, pendingAggregateCoverage: JSON.stringify({ 'nb.Todo-1': '100' }) }],
      })
      await commandStore.flush()

      expect(record.status).toBe('succeeded')
      expect(record.pendingAggregateCoverage).toBe(JSON.stringify({ 'nb.Todo-1': '100' }))
    })

    it('emits one status-changed event per applied command, none for updated', async () => {
      const { commandQueue, commandStore } = await bootstrap()
      const applied = await seedSucceeded(commandStore, 'cmd-a', JSON.stringify('events'))
      const updated = await seedSucceeded(commandStore, 'cmd-b', JSON.stringify({ s1: '1' }))

      const events: CommandEvent[] = []
      commandQueue.events$.subscribe((e) => events.push(e))

      await commandQueue.batchUpdateSyncStatus({ applied: [applied], updated: [updated] })

      const statusChanges = events.filter((e) => e.eventType === 'status-changed')
      expect(statusChanges).toHaveLength(1)
      expect(statusChanges[0]?.commandId).toBe('cmd-a')
      expect(statusChanges[0]?.status).toBe('applied')
      expect(statusChanges[0]?.previousStatus).toBe('succeeded')
    })

    it('is a no-op when both sets are empty or absent', async () => {
      const { commandQueue, storage } = await bootstrap()
      const updateSpy = vi.spyOn(storage, 'updateCommands')

      await commandQueue.batchUpdateSyncStatus({})
      await commandQueue.batchUpdateSyncStatus({ applied: [], updated: [] })

      expect(updateSpy).not.toHaveBeenCalled()
    })

    it('accepts arbitrary iterables', async () => {
      const { commandQueue, commandStore } = await bootstrap()
      const a = await seedSucceeded(commandStore, 'cmd-iter', JSON.stringify('events'))
      const appliedSet = new Set([a])

      await commandQueue.batchUpdateSyncStatus({ applied: appliedSet })

      expect(a.status).toBe('applied')
    })
  })

  describe('reset', () => {
    it('pauses the queue', async () => {
      const { commandQueue } = await bootstrap()
      await commandQueue.resume()
      expect(commandQueue.isPaused()).toBe(false)

      await commandQueue.reset()
      expect(commandQueue.isPaused()).toBe(true)
    })

    it('clears pending retry timers', async () => {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockResolvedValue(Err(new CommandSendException('Error', 'NETWORK', true))),
      }
      const { anticipatedEventHandler, commandQueue } = await bootstrap({
        commandSender,
        retryConfig: { maxAttempts: 3, initialDelay: 500 },
      })

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      await commandQueue.resume()

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
      let resolveSend: ((value: Result<unknown, CommandSendException>) => void) | undefined
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        send: vi.fn().mockImplementation(() => new Promise((resolve) => (resolveSend = resolve))),
      }
      const { commandQueue } = await bootstrap({
        commandSender,
      })

      const result = await commandQueue.enqueue({
        command: { type: 'Test', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!result.ok) throw new Error('Expected success')

      // Deferred send means resume's drain will not settle until the send is
      // resolved below — store the promise and await after reset completes.
      const resumePromise = commandQueue.resume()
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
      resolveSend?.(Ok({ id: '123' }))

      await resetPromise
      await resumePromise
      expect(resetResolved).toBe(true)
    })
  })

  describe('clearAll', () => {
    it('pauses the queue, clears anticipated tracking, and deletes all commands', async () => {
      const { anticipatedEventHandler, commandQueue } = await bootstrap()
      await commandQueue.resume()
      await commandQueue.enqueue({
        command: { type: 'First', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })
      await commandQueue.enqueue({
        command: { type: 'Second', data: {} },
        cacheKey: TODOS_CACHE_KEY,
      })

      await commandQueue.clearAll()

      expect(commandQueue.isPaused()).toBe(true)
      expect(anticipatedEventHandler.clearAll).toHaveBeenCalledTimes(1)

      const commands = await commandQueue.listCommands()
      expect(commands).toHaveLength(0)
    })
  })

  describe('cross-aggregate parent-child reconciliation', async () => {
    function setupCrossAggregateQueue(senderResponses: Map<string, unknown>): BootstrapParams {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        async send(command: CommandRecord<ServiceLink, EnqueueCommand>) {
          const response = senderResponses.get(command.type)
          if (typeof response === 'function') return Ok(response(command))
          if (response !== undefined) return Ok(response)
          return Ok({ id: 'default-id', nextExpectedRevision: '1', events: [] })
        },
      }

      return { domainExecutor: crossAggregateDomainExecutor, commandSender }
    }

    it('regenerating child create after parent succeeds preserves the original client ID', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'nb.Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { anticipatedEventHandler, commandQueue } = await bootstrap(
        setupCrossAggregateQueue(senderResponses),
      )

      // Enqueue parent create
      const folderResult = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'F' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = folderResult.value.anticipatedEvents[0]!.data.id

      // Enqueue child create with dependency on parent
      const noteResult = await commandQueue.enqueue({
        command: {
          type: 'CreateNote',
          data: { parentId: folderClientId, title: 'N' },
          dependsOn: [folderResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!noteResult.ok) throw new Error('Expected success')

      // Capture the original client ID from the child's anticipated events
      const originalNoteClientId = noteResult.value.anticipatedEvents[0]!.data.id

      // Process — folder succeeds, triggers regeneration of note's anticipated events
      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Find the regenerate call for the note command
      const regenerateCalls = vi.mocked(anticipatedEventHandler.regenerate).mock.calls
      const noteRegenerateCall = regenerateCalls.find(
        (call) => call[0]?.commandId === noteResult.value.commandId,
      )
      expect(noteRegenerateCall).toBeDefined()

      // Extract the NoteCreated event from the regenerated anticipated events
      const regeneratedEvents = noteRegenerateCall![1] as IAnticipatedEvent<
        string,
        AggregateEventData & Record<string, string>
      >[]
      const noteCreatedEvent = regeneratedEvents.find((e) => e.type === 'NoteCreated')
      expect(noteCreatedEvent).toBeDefined()

      // The entity ID must be the SAME as the original — not a new random ID
      expect(noteCreatedEvent!.data.id).toBe(originalNoteClientId)
      // The parentId should have been updated to the server ID
      expect(noteCreatedEvent!.data.parentId).toBe('folder-server-1')
    })

    it('rewrites child data when parent create succeeds', async () => {
      const senderResponses = new Map<string, unknown>()
      senderResponses.set('CreateFolder', {
        id: 'folder-server-1',
        nextExpectedRevision: '1',
        events: [
          {
            id: 'evt-1',
            type: 'FolderCreated',
            streamId: 'nb.Folder-server-1',
            data: { id: 'folder-server-1', name: 'My Folder' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { commandQueue, storage } = await bootstrap(setupCrossAggregateQueue(senderResponses))

      // Enqueue parent create
      const folderResult = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'My Folder' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folderResult.ok) throw new Error('Expected success')

      // Get the client-generated folder ID from anticipated events
      const folderClientId = (folderResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      // Enqueue child create with explicit dependency and parent's client ID
      const noteResult = await commandQueue.enqueue({
        command: {
          type: 'CreateNote',
          data: { parentId: folderClientId, title: 'My Note' },
          dependsOn: [folderResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!noteResult.ok) throw new Error('Expected success')

      // Child should be blocked
      let noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('blocked')

      // Process the queue — folder command succeeds
      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Verify folder succeeded
      const folderCmd = await storage.getCommand(folderResult.value.commandId)
      expect(folderCmd?.status).toBe('succeeded')

      // Verify note's data was rewritten with server ID
      noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('pending')
      const notedata = noteCmd?.data as { parentId: string; title: string }
      expect(notedata.parentId).toBe('folder-server-1')
      expect(notedata.title).toBe('My Note')
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
            streamId: 'nb.Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { anticipatedEventHandler, commandQueue, storage } = await bootstrap(
        setupCrossAggregateQueue(senderResponses),
      )

      const folderResult = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'F' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      const noteResult = await commandQueue.enqueue({
        command: {
          type: 'CreateNote',
          data: { parentId: folderClientId, title: 'N' },
          dependsOn: [folderResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!noteResult.ok) throw new Error('Expected success')
      const noteClientId = (noteResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Note command was rewritten — parentId changed, but its own anticipated
      // event should have regenerated with the same note client ID
      expect(anticipatedEventHandler.regenerate).toHaveBeenCalled()

      // The note's own ID should not have been changed by the folder's ID map
      // (folder ID map only contains folder client→server, not note IDs)
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      const notedata = noteCmd?.data as { parentId: string; title: string }
      // parentId was rewritten to server
      expect(notedata.parentId).toBe('folder-server-1')
      // The note's own creates config means its client ID comes from anticipated events,
      // not from data.id. The note doesn't have an id in its data for CreateNote.
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
            streamId: 'nb.Folder-server-1',
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
            streamId: 'nb.Note-server-1',
            data: { id: 'note-server-1', parentId: 'folder-server-1', title: 'N' },
            revision: '1',
            position: '2',
          },
        ],
      })

      const { commandQueue, storage } = await bootstrap(setupCrossAggregateQueue(senderResponses))

      // A: CreateFolder
      const folderResult = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'F' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      // B: CreateNote depends on A
      const noteResult = await commandQueue.enqueue({
        command: {
          type: 'CreateNote',
          data: { parentId: folderClientId, title: 'N' },
          dependsOn: [folderResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!noteResult.ok) throw new Error('Expected success')
      const noteClientId = (noteResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      // C: UpdateNote depends on B
      const updateResult = await commandQueue.enqueue({
        command: {
          type: 'UpdateNote',
          data: { id: noteClientId, title: 'Updated' },
          revision: autoRevision(),
          dependsOn: [noteResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!updateResult.ok) throw new Error('Expected success')

      // Process entire chain — each command triggers reprocessing after success
      await commandQueue.resume()
      // Allow enough cycles for A→B→C to complete sequentially
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await commandQueue.processPendingCommands()
      }

      // A succeeded
      const folderCmd = await storage.getCommand(folderResult.value.commandId)
      expect(folderCmd?.status).toBe('succeeded')

      // B succeeded — parentId was rewritten
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('succeeded')

      // C's data should have been rewritten with note's server ID
      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      const updatedata = updateCmd?.data as { id: string; title: string }
      expect(updatedata.id).toBe('note-server-1')
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
            streamId: 'nb.Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { commandQueue, storage } = await bootstrap(setupCrossAggregateQueue(senderResponses))

      // Create folder and let it succeed
      const folderResult = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'F' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Folder is now succeeded — mapping cache should have the mapping
      const mapping = await storage.getCommandIdMapping(folderClientId)
      expect(mapping).toBeDefined()

      // Now enqueue a note with the STALE client ID (simulating UI race condition)
      const noteResult = await commandQueue.enqueue({
        command: { type: 'CreateNote', data: { parentId: folderClientId, title: 'Late Note' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!noteResult.ok) throw new Error('Expected success')

      // The data should have been patched at enqueue time
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      const notedata = noteCmd?.data as { parentId: string; title: string }
      expect(notedata.parentId).toBe('folder-server-1')
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
            streamId: 'nb.Folder-server-1',
            data: { id: 'folder-server-1', name: 'F' },
            revision: '1',
            position: '1',
          },
        ],
      })

      const { commandQueue, storage } = await bootstrap(setupCrossAggregateQueue(senderResponses))

      // A: CreateFolder
      const folderResult = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'F' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folderResult.ok) throw new Error('Expected success')
      const folderClientId = (folderResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      // B: CreateNote depends on folder
      const noteResult = await commandQueue.enqueue({
        command: {
          type: 'CreateNote',
          data: { parentId: folderClientId, title: 'N' },
          dependsOn: [folderResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!noteResult.ok) throw new Error('Expected success')
      const noteClientId = (noteResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      // C: MoveNote depends on note, references folder's client ID in fromFolderId
      const moveResult = await commandQueue.enqueue({
        command: {
          type: 'MoveNote',
          data: {
            id: noteClientId,
            fromFolderId: folderClientId,
            toFolderId: 'existing-folder',
          },
          revision: autoRevision(),
          dependsOn: [noteResult.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!moveResult.ok) throw new Error('Expected success')

      // C starts blocked
      let moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(moveCmd?.status).toBe('blocked')

      // Process — folder succeeds
      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // B is unblocked (pending), C is still blocked behind B
      const noteCmd = await storage.getCommand(noteResult.value.commandId)
      expect(noteCmd?.status).toBe('pending')

      moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(moveCmd?.status).toBe('blocked')

      // C's fromFolderId was rewritten to server ID (propagated through chain)
      const movedata = moveCmd?.data as {
        id: string
        fromFolderId: string
        toFolderId: string
      }
      expect(movedata.fromFolderId).toBe('folder-server-1')
      // toFolderId is an existing folder, unchanged
      expect(movedata.toFolderId).toBe('existing-folder')
      // C's note id is still the client ID (note hasn't succeeded yet)
      expect(movedata.id).toBe(noteClientId)
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
              streamId: `nb.Folder-server-${folderSendCount}`,
              data: { id: `folder-server-${folderSendCount}`, name: 'F' },
              revision: '1',
              position: String(folderSendCount),
            },
          ],
        }
      })

      const { commandQueue, storage } = await bootstrap(setupCrossAggregateQueue(senderResponses))

      // Create source folder (folder1)
      const folder1Result = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'Source' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folder1Result.ok) throw new Error('Expected success')
      const folder1ClientId = (folder1Result.value.anticipatedEvents[0] as IAnticipatedEvent).data
        .id

      // Create target folder (folder2)
      const folder2Result = await commandQueue.enqueue({
        command: { type: 'CreateFolder', data: { name: 'Target' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!folder2Result.ok) throw new Error('Expected success')
      const folder2ClientId = (folder2Result.value.anticipatedEvents[0] as IAnticipatedEvent).data
        .id

      // MoveNote depends on BOTH folders — fromFolderId and toFolderId each reference a different folder
      const moveResult = await commandQueue.enqueue({
        command: {
          type: 'MoveNote',
          data: {
            id: 'existing-note-1',
            fromFolderId: folder1ClientId,
            toFolderId: folder2ClientId,
          },
          revision: autoRevision('3'),
          dependsOn: [folder1Result.value.commandId, folder2Result.value.commandId],
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!moveResult.ok) throw new Error('Expected success')

      // MoveNote should be blocked by both folders
      let moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(moveCmd?.status).toBe('blocked')
      expect(moveCmd?.blockedBy).toHaveLength(2)

      // Process the queue — both folders succeed
      await commandQueue.resume()
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await commandQueue.processPendingCommands()
      }

      // Both folders succeeded
      expect((await storage.getCommand(folder1Result.value.commandId))?.status).toBe('succeeded')
      expect((await storage.getCommand(folder2Result.value.commandId))?.status).toBe('succeeded')

      // MoveNote should have been unblocked and processed
      moveCmd = await storage.getCommand(moveResult.value.commandId)
      expect(['pending', 'sending', 'succeeded']).toContain(moveCmd?.status)

      // Each folder ID was replaced independently by its own dependency's server ID
      const movedata = moveCmd?.data as {
        id: string
        fromFolderId: string
        toFolderId: string
      }
      expect(movedata.fromFolderId).toBe('folder-server-1')
      expect(movedata.toFolderId).toBe('folder-server-2')
      // The note ID (existing, not a client ID) is unchanged
      expect(movedata.id).toBe('existing-note-1')
    })
  })

  describe('same-aggregate auto-chaining', () => {
    function setupSameAggregateQueue(senderResponses: Map<string, unknown>): BootstrapParams {
      const commandSender: ICommandSender<ServiceLink, EnqueueCommand> = {
        async send(command: CommandRecord<ServiceLink, EnqueueCommand>) {
          const response = senderResponses.get(command.type)
          if (typeof response === 'function') return Ok(response(command))
          if (response !== undefined) return Ok(response)
          return Ok({ id: 'default-id', nextExpectedRevision: '1', events: [] })
        },
      }

      return { domainExecutor: itemDomainExecutor, commandSender }
    }

    it('mutate auto-blocked behind create on same aggregate', async () => {
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(new Map()))

      const createResult = await commandQueue.enqueue({
        command: { type: 'CreateItem', data: { name: 'Test' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      const updateResult = await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: clientId, title: 'New Title' },
          revision: autoRevision(),
        },
        cacheKey: TODOS_CACHE_KEY,
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
            streamId: 'nb.Item-server-1',
            data: { id: 'server-1', name: 'Test' },
            revision: '1',
            position: '1',
          },
        ],
      })
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(responses))

      const createResult = await commandQueue.enqueue({
        command: { type: 'CreateItem', data: { name: 'Test' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: clientId, title: 'New' },
          revision: autoRevision(),
        },
        cacheKey: TODOS_CACHE_KEY,
      })

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Find the update command (by type since we don't know its ID easily)
      const allCmds = await storage.getCommands()
      const updateCmd = allCmds.find((c) => c.type === 'UpdateItem')
      expect(updateCmd?.status).toBe('pending')
      const data = updateCmd?.data as { id: string; title: string }
      expect(data.id).toBe('server-1')
      expect(updateCmd?.revision).toBe('1')
    })

    it('second mutate auto-blocked behind first on same aggregate', async () => {
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(new Map()))

      const update1 = await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: 'existing-1', title: 'First' },
          revision: autoRevision('1'),
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!update1.ok) throw new Error('Expected success')

      const delete1 = await commandQueue.enqueue({
        command: { type: 'DeleteItem', data: { id: 'existing-1' }, revision: autoRevision('1') },
        cacheKey: TODOS_CACHE_KEY,
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
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(responses))

      const update1 = await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: 'existing-1', title: 'First' },
          revision: autoRevision('1'),
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!update1.ok) throw new Error('Expected success')

      const delete1 = await commandQueue.enqueue({
        command: { type: 'DeleteItem', data: { id: 'existing-1' }, revision: autoRevision('1') },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!delete1.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      const deleteCmd = await storage.getCommand(delete1.value.commandId)
      expect(deleteCmd?.status).toBe('pending')
      expect(deleteCmd?.revision).toBe('2')
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
            streamId: 'nb.Item-server-1',
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
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(responses))

      const createResult = await commandQueue.enqueue({
        command: { type: 'CreateItem', data: { name: 'X' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: clientId, title: 'Updated' },
          revision: autoRevision(),
        },
        cacheKey: TODOS_CACHE_KEY,
      })

      await commandQueue.enqueue({
        command: { type: 'DeleteItem', data: { id: clientId }, revision: autoRevision() },
        cacheKey: TODOS_CACHE_KEY,
      })

      await commandQueue.resume()
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        await commandQueue.processPendingCommands()
      }

      const allCmds = await storage.getCommands()
      const createCmd = allCmds.find((c) => c.type === 'CreateItem')
      const updateCmd = allCmds.find((c) => c.type === 'UpdateItem')
      const deleteCmd = allCmds.find((c) => c.type === 'DeleteItem')

      expect(createCmd?.status).toBe('succeeded')
      expect(updateCmd?.status).toBe('succeeded')
      expect(deleteCmd?.status).toBe('succeeded')

      // UpdateItem was sent with server ID and create's revision
      const updatedata = updateCmd?.data as { id: string }
      expect(updatedata.id).toBe('server-1')

      // DeleteItem was sent with server ID and update's revision
      const deletedata = deleteCmd?.data as { id: string }
      expect(deletedata.id).toBe('server-1')
    })

    it('auto-revision fallback used when no chain exists', async () => {
      let sentCommand: CommandRecord<ServiceLink, EnqueueCommand> | undefined
      const responses = new Map<string, unknown>()
      responses.set('UpdateItem', (cmd: CommandRecord<ServiceLink, EnqueueCommand>) => {
        sentCommand = cmd
        return { id: 'existing-1', nextExpectedRevision: '6', events: [] }
      })
      const { commandQueue } = await bootstrap(setupSameAggregateQueue(responses))

      await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: 'existing-1', title: 'Solo' },
          revision: autoRevision('5'),
        },
        cacheKey: TODOS_CACHE_KEY,
      })

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // The revision sent to server should be the fallback '5'
      expect(sentCommand?.revision).toBe('5')
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
            streamId: 'nb.Item-server-1',
            data: { id: 'server-1', name: 'X' },
            revision: '1',
            position: '1',
          },
        ],
      })
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(responses))

      // Create and succeed
      const createResult = await commandQueue.enqueue({
        command: { type: 'CreateItem', data: { name: 'X' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!createResult.ok) throw new Error('Expected success')
      const clientId = (createResult.value.anticipatedEvents[0] as IAnticipatedEvent).data.id

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Enqueue with stale client ID (race condition)
      const updateResult = await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: clientId, title: 'Late' },
          revision: autoRevision(),
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!updateResult.ok) throw new Error('Expected success')

      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      const data = updateCmd?.data as { id: string }
      expect(data.id).toBe('server-1')
      expect(updateCmd?.revision).toMatchObject({ __autoRevision: true, fallback: '1' })
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
            streamId: 'nb.Item-server-1',
            data: { id: 'server-1', name: 'X' },
            revision: '1',
            position: '1',
          },
        ],
      })
      const { commandQueue, storage } = await bootstrap(setupSameAggregateQueue(responses))

      const createResult = await commandQueue.enqueue({
        command: { type: 'CreateItem', data: { name: 'X' } },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!createResult.ok) throw new Error('Expected success')

      await commandQueue.resume()
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Enqueue with correct server ID but undefined revision (race condition)
      const updateResult = await commandQueue.enqueue({
        command: {
          type: 'UpdateItem',
          data: { id: 'server-1', title: 'Race' },
          revision: autoRevision(),
        },
        cacheKey: TODOS_CACHE_KEY,
      })
      if (!updateResult.ok) throw new Error('Expected success')

      const updateCmd = await storage.getCommand(updateResult.value.commandId)
      expect(updateCmd?.revision).toMatchObject({ __autoRevision: true, fallback: '1' })
    })
  })

  describe('rebuildChains', () => {
    /**
     * Build a CommandRecord with required fields + overrides.
     * Defaults to a pending UpdateTodo for `todo-1` with `seq` 1.
     */
    function makeCommand(
      overrides: Partial<CommandRecord<ServiceLink, EnqueueCommand>> = {},
    ): CommandRecord<ServiceLink, EnqueueCommand> {
      const id = overrides.commandId ?? 'cmd-1'
      const base: CommandRecord<ServiceLink, EnqueueCommand> = {
        commandId: id,
        cacheKey: TODOS_CACHE_KEY,
        service: 'nb',
        type: 'UpdateTodo',
        data: { id: 'todo-1' },
        status: 'pending',
        dependsOn: [],
        blockedBy: [],
        attempts: 0,
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        affectedAggregates: [
          {
            streamId: 'nb.Todo-todo-1',
            link: { service: 'nb', type: 'Todo', id: 'todo-1' },
          },
        ],
      }
      return { ...base, ...overrides }
    }

    function updateTodoRegistration() {
      return {
        commandType: 'UpdateTodo',
        aggregate: TodoAggregate,
        commandIdReferences: [],
        handler: () => domainSuccess([]),
      }
    }

    function updateTodoRegistrationWithRevisionRef() {
      return {
        commandType: 'UpdateTodo',
        aggregate: TodoAggregate,
        commandIdReferences: [],
        responseIdReferences: [
          {
            aggregate: TodoAggregate,
            path: '$.id',
            revisionPath: '$.nextExpectedRevision',
          },
        ],
        handler: () => domainSuccess([]),
      }
    }

    function mockExecutor(
      registration: unknown,
    ): IDomainExecutor<ServiceLink, EnqueueCommand, unknown, IAnticipatedEvent> {
      return {
        validate: vi.fn(),
        handle: vi.fn(),
        getRegistration: vi.fn().mockReturnValue(registration),
      }
    }

    it("creates a chain keyed by each command's streamId with latestCommandId set", async () => {
      const { commandQueue } = await bootstrap({
        domainExecutor: mockExecutor(updateTodoRegistration()),
        seedStorage: async (storage) => {
          await storage.saveCommand(makeCommand({ commandId: 'cmd-a' }))
        },
      })

      await commandQueue.rebuildChainsForTest()

      const chain = commandQueue.getChainByStreamId('nb.Todo-todo-1')
      expect(chain).toBeDefined()
      expect(chain?.latestCommandId).toBe('cmd-a')
      expect(chain?.clientStreamId).toBe('nb.Todo-todo-1')
      expect(chain?.serverStreamId).toBeUndefined()
    })

    it('processes commands in `seq` order so the latest by insertion wins', async () => {
      const now = Date.now()
      const { commandQueue } = await bootstrap({
        domainExecutor: mockExecutor(updateTodoRegistration()),
        seedStorage: async (storage) => {
          // Three commands on the same stream, all stamped with the same
          // `createdAt` so only `seq` distinguishes insertion order.
          await storage.saveCommand(
            makeCommand({ commandId: 'cmd-1', seq: 1, createdAt: now, updatedAt: now }),
          )
          await storage.saveCommand(
            makeCommand({ commandId: 'cmd-3', seq: 3, createdAt: now, updatedAt: now }),
          )
          await storage.saveCommand(
            makeCommand({ commandId: 'cmd-2', seq: 2, createdAt: now, updatedAt: now }),
          )
        },
      })

      await commandQueue.rebuildChainsForTest()

      const chain = commandQueue.getChainByStreamId('nb.Todo-todo-1')
      expect(chain?.latestCommandId).toBe('cmd-3')
    })

    it('records create markers for create commands', async () => {
      const tempId = 'temp-todo-1'
      const { commandQueue } = await bootstrap({
        domainExecutor: mockExecutor({
          commandType: 'CreateTodo',
          aggregate: TodoAggregate,
          commandIdReferences: [],
          creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
          handler: () => domainSuccess([]),
        }),
        seedStorage: async (storage) => {
          await storage.saveCommand(
            makeCommand({
              commandId: 'create-cmd',
              type: 'CreateTodo',
              data: { id: tempId, title: 'Pending create' },
              creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
              affectedAggregates: [
                {
                  streamId: `nb.Todo-${tempId}`,
                  link: { service: 'nb', type: 'Todo', id: tempId },
                },
              ],
            }),
          )
        },
      })

      await commandQueue.rebuildChainsForTest()

      const chain = commandQueue.getChainByStreamId(`nb.Todo-${tempId}`)
      expect(chain?.createCommandId).toBe('create-cmd')
      expect(chain?.createdEntityId).toBe(tempId)
    })

    describe('dual-index rehydration via mappingStore', () => {
      it('attaches the server streamId to a client-keyed chain when a mapping exists', async () => {
        const tempId = 'temp-todo-1'
        const serverId = 'srv-todo-1'
        const { commandQueue } = await bootstrap({
          domainExecutor: mockExecutor(updateTodoRegistration()),
          seedStorage: async (storage) => {
            // Prior-session artifact: pending command keyed by the client
            // streamId plus a resolved mapping for the same entity id.
            await storage.saveCommand(
              makeCommand({
                commandId: 'update-cmd',
                data: { id: tempId, title: 'Stale' },
                affectedAggregates: [
                  {
                    streamId: `nb.Todo-${tempId}`,
                    link: { service: 'nb', type: 'Todo', id: tempId },
                  },
                ],
              }),
            )
            await storage.saveCommandIdMapping({
              clientId: tempId,
              serverId,
              createdAt: Date.now(),
            })
          },
        })

        await commandQueue.rebuildChainsForTest()

        const viaClient = commandQueue.getChainByStreamId(`nb.Todo-${tempId}`)
        const viaServer = commandQueue.getChainByStreamId(`nb.Todo-${serverId}`)
        expect(viaClient).toBeDefined()
        expect(viaServer).toBeDefined()
        expect(viaClient).toBe(viaServer)
        expect(viaClient?.clientStreamId).toBe(`nb.Todo-${tempId}`)
        expect(viaClient?.serverStreamId).toBe(`nb.Todo-${serverId}`)
      })

      it('does not attach when no mapping exists for the stream', async () => {
        const { commandQueue } = await bootstrap({
          domainExecutor: mockExecutor(updateTodoRegistration()),
          seedStorage: async (storage) => {
            // Command enqueued against the server id directly — no temp-id phase.
            await storage.saveCommand(
              makeCommand({
                commandId: 'update-cmd',
                data: { id: 'srv-todo-1' },
                affectedAggregates: [
                  {
                    streamId: 'nb.Todo-srv-todo-1',
                    link: { service: 'nb', type: 'Todo', id: 'srv-todo-1' },
                  },
                ],
              }),
            )
          },
        })

        await commandQueue.rebuildChainsForTest()

        const chain = commandQueue.getChainByStreamId('nb.Todo-srv-todo-1')
        expect(chain).toBeDefined()
        expect(chain?.serverStreamId).toBeUndefined()
      })
    })

    describe('lastKnownRevision rehydration from succeeded commands', () => {
      it("restores lastKnownRevision from a succeeded command's serverResponse", async () => {
        const { commandQueue } = await bootstrap({
          domainExecutor: mockExecutor(updateTodoRegistrationWithRevisionRef()),
          seedStorage: async (storage) => {
            await storage.saveCommand(
              makeCommand({
                commandId: 'succeeded-cmd',
                status: 'succeeded',
                data: { id: 'todo-1' },
                serverResponse: { id: 'todo-1', nextExpectedRevision: '7' },
              }),
            )
          },
        })

        await commandQueue.rebuildChainsForTest()

        const chain = commandQueue.getChainByStreamId('nb.Todo-todo-1')
        expect(chain?.lastKnownRevision).toBe('7')
      })

      it('advances lastKnownRevision forward only across multiple succeeded commands', async () => {
        const { commandQueue } = await bootstrap({
          domainExecutor: mockExecutor(updateTodoRegistrationWithRevisionRef()),
          seedStorage: async (storage) => {
            // Save out-of-seq on purpose: the lower-seq command has a
            // higher revision (shouldn't happen in practice, but the
            // forward-only guard must hold regardless of iteration order).
            await storage.saveCommand(
              makeCommand({
                commandId: 'succeeded-2',
                status: 'succeeded',
                seq: 2,
                data: { id: 'todo-1' },
                serverResponse: { id: 'todo-1', nextExpectedRevision: '3' },
              }),
            )
            await storage.saveCommand(
              makeCommand({
                commandId: 'succeeded-1',
                status: 'succeeded',
                seq: 1,
                data: { id: 'todo-1' },
                serverResponse: { id: 'todo-1', nextExpectedRevision: '9' },
              }),
            )
          },
        })

        await commandQueue.rebuildChainsForTest()

        const chain = commandQueue.getChainByStreamId('nb.Todo-todo-1')
        expect(chain?.lastKnownRevision).toBe('9')
      })

      it('leaves lastKnownRevision undefined when the response carries no revision', async () => {
        const { commandQueue } = await bootstrap({
          // No responseIdReferences means no revisions are extractable.
          domainExecutor: mockExecutor(updateTodoRegistration()),
          seedStorage: async (storage) => {
            await storage.saveCommand(
              makeCommand({
                commandId: 'succeeded-cmd',
                status: 'succeeded',
                data: { id: 'todo-1' },
                serverResponse: { id: 'todo-1' },
              }),
            )
          },
        })

        await commandQueue.rebuildChainsForTest()

        const chain = commandQueue.getChainByStreamId('nb.Todo-todo-1')
        expect(chain?.lastKnownRevision).toBeUndefined()
      })
    })
  })
})
