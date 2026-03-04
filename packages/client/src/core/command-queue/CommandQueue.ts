/**
 * Command queue implementation.
 * Handles command persistence, validation, retry, and status tracking.
 */

import { Err, logProvider, Ok } from '@meticoeus/ddd-es'
import {
  filter,
  firstValueFrom,
  map,
  Observable,
  race,
  share,
  Subject,
  takeUntil,
  timer,
} from 'rxjs'
import type { IStorage } from '../../storage/IStorage.js'
import type {
  CommandCompletionResult,
  CommandError,
  CommandEvent,
  CommandFilter,
  CommandRecord,
  CommandStatus,
  EnqueueAndWaitOptions,
  EnqueueAndWaitResult,
  EnqueueCommand,
  EnqueueOptions,
  EnqueueResult,
  TerminalCommandStatus,
  WaitOptions,
} from '../../types/commands.js'
import { EnqueueAndWaitException, isTerminalStatus } from '../../types/commands.js'
import type { RetryConfig } from '../../types/config.js'
import type { DomainExecutionResult, IDomainExecutor } from '../../types/domain.js'
import type { ValidationError } from '../../types/validation.js'
import { calculateBackoffDelay, shouldRetry } from '../../utils/retry.js'
import { generateId } from '../../utils/uuid.js'
import type { EventBus } from '../events/EventBus.js'
import type { ICommandQueue, ICommandSender } from './types.js'
import { CommandSendError } from './types.js'

/**
 * Handler for anticipated event lifecycle.
 * CommandQueue hands off anticipated events at the right lifecycle points — the handler
 * implementation coordinates EventCache, CacheManager, EventProcessorRunner, and collection routing.
 */
export interface IAnticipatedEventHandler {
  /** Cache anticipated events in EventCache and send through event processor pipeline. */
  cache(commandId: string, events: unknown[]): Promise<void>
  /** Clean up anticipated events when command reaches terminal state. Reverts read models on failure/cancellation. */
  cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void>
  /** Clear all tracking state (in-memory only — storage cleanup handled by session cascade). */
  clearAll(): Promise<void>
}

/**
 * Command queue configuration.
 */
export interface CommandQueueConfig {
  storage: IStorage
  eventBus: EventBus
  anticipatedEventHandler: IAnticipatedEventHandler
  domainExecutor?: IDomainExecutor
  commandSender?: ICommandSender
  retryConfig?: RetryConfig
  defaultService?: string
  onCommandResponse?: (command: CommandRecord, response: unknown) => Promise<void>
  /** When true, terminal commands are retained in storage instead of being cleaned up. */
  retainTerminal?: boolean
}

/**
 * Default wait timeout in milliseconds.
 */
const DEFAULT_WAIT_TIMEOUT = 30000

/**
 * Command queue implementation.
 */
export class CommandQueue implements ICommandQueue {
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly anticipatedEventHandler: IAnticipatedEventHandler
  private readonly domainExecutor?: IDomainExecutor
  private readonly commandSender?: ICommandSender
  private readonly retryConfig: RetryConfig
  private readonly defaultService: string
  private readonly onCommandResponse?: (command: CommandRecord, response: unknown) => Promise<void>
  private readonly retainTerminal: boolean

  private readonly commandEvents = new Subject<CommandEvent>()
  private readonly destroy$ = new Subject<void>()

  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>()

  private _paused = true
  private processingPromise: Promise<void> | undefined
  private _pendingReprocess = false

  readonly events$: Observable<CommandEvent>

  constructor(config: CommandQueueConfig) {
    this.storage = config.storage
    this.eventBus = config.eventBus
    this.anticipatedEventHandler = config.anticipatedEventHandler
    this.domainExecutor = config.domainExecutor
    this.commandSender = config.commandSender
    this.retryConfig = config.retryConfig ?? {}
    this.defaultService = config.defaultService ?? 'default'
    this.onCommandResponse = config.onCommandResponse
    this.retainTerminal = config.retainTerminal ?? false

    this.events$ = this.commandEvents.asObservable().pipe(share(), takeUntil(this.destroy$))
  }

  async enqueue<TPayload, TEvent>(
    command: EnqueueCommand<TPayload>,
    options?: EnqueueOptions,
  ): Promise<EnqueueResult<TEvent>> {
    const commandId = options?.commandId ?? generateId()
    const now = Date.now()

    // Run domain validation if executor is available and not skipped
    let anticipatedEvents: TEvent[] = []

    if (this.domainExecutor && !options?.skipValidation) {
      // Trust boundary: the consumer-provided domainExecutor is expected to produce
      // TEvent-compatible anticipated events. TypeScript cannot verify this without
      // making CommandQueue generic in TEvent, which would propagate through the
      // entire client factory.
      const result = this.domainExecutor.execute(command) as DomainExecutionResult<TEvent>

      if (!result.ok) {
        return Err(result.error)
      }

      anticipatedEvents = result.value.anticipatedEvents
    }

    // Calculate blockedBy from dependsOn (only non-terminal commands)
    const blockedBy: string[] = []
    if (command.dependsOn) {
      for (const depId of command.dependsOn) {
        const depCommand = await this.storage.getCommand(depId)
        if (depCommand && !isTerminalStatus(depCommand.status)) {
          blockedBy.push(depId)
        }
      }
    }

    // Determine initial status based on unresolved dependencies
    const initialStatus: CommandStatus = blockedBy.length > 0 ? 'blocked' : 'pending'

    // Create command record
    const record: CommandRecord<TPayload> = {
      commandId,
      service: command.service ?? this.defaultService,
      type: command.type,
      payload: command.payload,
      status: initialStatus,
      dependsOn: command.dependsOn ?? [],
      blockedBy,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    }

    // Save command
    await this.storage.saveCommand(record)

    // Cache anticipated events for optimistic updates
    if (anticipatedEvents.length > 0) {
      try {
        await this.anticipatedEventHandler.cache(commandId, anticipatedEvents)
      } catch (err) {
        logProvider.log.error(
          { err, commandId },
          'Failed to cache anticipated events (command still enqueued)',
        )
      }
    }

    logProvider.log.debug(
      { commandId, type: command.type, status: initialStatus },
      'Command enqueued',
    )

    // Emit event
    this.emitCommandEvent('enqueued', record)

    // Also emit to library event bus
    this.eventBus.emit('command:enqueued', { commandId, type: command.type })

    // Trigger processing for the newly enqueued command
    if (!this._paused && initialStatus === 'pending') {
      this.processPendingCommands().catch((err) => {
        logProvider.log.error({ err }, 'Failed to process pending commands')
      })
    }

    return Ok({ commandId, anticipatedEvents })
  }

  async waitForCompletion(
    commandId: string,
    options?: WaitOptions,
  ): Promise<CommandCompletionResult> {
    const timeout = options?.timeout ?? DEFAULT_WAIT_TIMEOUT

    // Check if command is already in terminal state
    const command = await this.storage.getCommand(commandId)
    if (!command) {
      return { status: 'failed', error: { source: 'local', message: 'Command not found' } }
    }

    if (isTerminalStatus(command.status)) {
      return this.toCompletionResult(command)
    }

    // Wait for terminal state or timeout
    const terminalEvent$ = this.commandEvents$(commandId).pipe(
      filter((event) => isTerminalStatus(event.status)),
      map((event) => this.eventToCompletionResult(event)),
    )

    const timeout$ = timer(timeout).pipe(
      map((): CommandCompletionResult => ({ status: 'timeout' })),
    )

    return firstValueFrom(race(terminalEvent$, timeout$))
  }

  async enqueueAndWait<TPayload, TEvent, TResponse>(
    command: EnqueueCommand<TPayload>,
    options?: EnqueueAndWaitOptions,
  ): Promise<EnqueueAndWaitResult<TResponse>> {
    const enqueueResult = await this.enqueue<TPayload, TEvent>(command, options)

    if (!enqueueResult.ok) {
      const errors: ValidationError[] = enqueueResult.error.details ?? []
      return Err(new EnqueueAndWaitException(errors, 'local'))
    }

    const completionResult = await this.waitForCompletion(enqueueResult.value.commandId, options)

    switch (completionResult.status) {
      case 'succeeded':
        return Ok({
          commandId: enqueueResult.value.commandId,
          response: completionResult.response as TResponse,
        })
      case 'failed':
        return Err(
          new EnqueueAndWaitException(
            completionResult.error.validationErrors ?? [
              { path: '', message: completionResult.error.message },
            ],
            completionResult.error.source,
          ),
        )
      case 'cancelled':
        return Err(
          new EnqueueAndWaitException([{ path: '', message: 'Command was cancelled' }], 'local'),
        )
      case 'timeout':
        return Err(
          new EnqueueAndWaitException([{ path: '', message: 'Command timed out' }], 'local'),
        )
    }
  }

  commandEvents$(commandId: string): Observable<CommandEvent> {
    return this.events$.pipe(filter((event) => event.commandId === commandId))
  }

  async getCommand(commandId: string): Promise<CommandRecord | undefined> {
    return this.storage.getCommand(commandId)
  }

  async listCommands(filter?: CommandFilter): Promise<CommandRecord[]> {
    return this.storage.getCommands(filter)
  }

  async cancelCommand(commandId: string): Promise<void> {
    const command = await this.storage.getCommand(commandId)
    if (!command) {
      throw new Error(`Command not found: ${commandId}`)
    }

    if (command.status === 'sending') {
      throw new Error('Cannot cancel command that is currently sending')
    }

    if (isTerminalStatus(command.status)) {
      throw new Error(`Cannot cancel command in status: ${command.status}`)
    }

    await this.updateCommandStatus(command, 'cancelled')
  }

  async retryCommand(commandId: string): Promise<void> {
    const command = await this.storage.getCommand(commandId)
    if (!command) {
      throw new Error(`Command not found: ${commandId}`)
    }

    if (command.status !== 'failed') {
      throw new Error(`Can only retry failed commands, current status: ${command.status}`)
    }

    await this.updateCommandStatus(command, 'pending', { error: undefined })
  }

  async processPendingCommands(): Promise<void> {
    if (this._paused) {
      return
    }

    // If already processing, flag that we need another pass when done
    if (this.processingPromise) {
      this._pendingReprocess = true
      return this.processingPromise
    }

    this.processingPromise = this.doProcessPendingCommands()
    try {
      await this.processingPromise
    } finally {
      this.processingPromise = undefined
    }

    // Commands may have been enqueued while we were processing.
    // Re-run to pick them up.
    if (this._pendingReprocess) {
      this._pendingReprocess = false
      return this.processPendingCommands()
    }
  }

  private async doProcessPendingCommands(): Promise<void> {
    if (!this.commandSender) {
      return
    }

    // Get pending commands (not blocked)
    const pendingCommands = await this.storage.getCommandsByStatus('pending')

    for (const command of pendingCommands) {
      if (this._paused) {
        break
      }

      // Skip if blocked
      if (command.blockedBy.length > 0) {
        continue
      }

      await this.processCommand(command)
    }
  }

  private async processCommand(command: CommandRecord): Promise<void> {
    if (!this.commandSender) {
      return
    }

    // Re-read from storage to detect cancellation that occurred while an earlier
    // command was mid-send (the `command` parameter may be a stale snapshot).
    const current = await this.storage.getCommand(command.commandId)
    if (!current || current.status !== 'pending') {
      return
    }

    logProvider.log.debug(
      { commandId: current.commandId, type: current.type, attempt: current.attempts + 1 },
      'Processing command',
    )

    // Update to sending
    const updatedCommand = await this.updateCommandStatus(current, 'sending', {
      attempts: current.attempts + 1,
      lastAttemptAt: Date.now(),
    })

    try {
      const response = await this.commandSender.send(updatedCommand)

      // Process response events before marking succeeded so the read model
      // is current when waitForCompletion resolves.
      if (this.onCommandResponse) {
        try {
          await this.onCommandResponse(updatedCommand, response)
        } catch (err) {
          logProvider.log.error(
            { err, commandId: current.commandId },
            'Failed to process command response events',
          )
        }
      }

      // Success
      await this.updateCommandStatus(updatedCommand, 'succeeded', {
        serverResponse: response,
      })

      // Unblock dependent commands
      await this.unblockDependentCommands(current.commandId)

      this.eventBus.emit('command:completed', {
        commandId: current.commandId,
        type: current.type,
      })
    } catch (error) {
      const commandError = this.toCommandError(error)

      // Check if we should retry
      const isRetryable = error instanceof CommandSendError ? error.isRetryable : true
      const canRetry = isRetryable && shouldRetry(updatedCommand.attempts, this.retryConfig)

      if (canRetry) {
        // Back to pending for retry
        await this.updateCommandStatus(updatedCommand, 'pending', {
          error: commandError,
        })

        // Schedule retry with backoff
        const delay = calculateBackoffDelay(updatedCommand.attempts, this.retryConfig)
        const timerId = setTimeout(() => {
          this.retryTimers.delete(timerId)
          this.processPendingCommands().catch((err) => {
            logProvider.log.error({ err }, 'Failed to process pending commands after retry')
          })
        }, delay)
        this.retryTimers.add(timerId)
      } else {
        // Mark as failed
        await this.updateCommandStatus(updatedCommand, 'failed', {
          error: commandError,
        })

        // Cancel dependent commands
        await this.cancelDependentCommands(current.commandId)

        this.eventBus.emit('command:failed', {
          commandId: current.commandId,
          type: current.type,
          error: commandError.message,
        })
      }
    }
  }

  private async unblockDependentCommands(commandId: string): Promise<void> {
    const blockedCommands = await this.storage.getCommandsBlockedBy(commandId)

    for (const blocked of blockedCommands) {
      const newBlockedBy = blocked.blockedBy.filter((id) => id !== commandId)

      if (newBlockedBy.length === 0 && blocked.status === 'blocked') {
        // No longer blocked
        await this.updateCommandStatus(blocked, 'pending', { blockedBy: newBlockedBy })
      } else {
        // Still blocked by other commands
        await this.storage.updateCommand(blocked.commandId, { blockedBy: newBlockedBy })
      }
    }
  }

  private async cancelDependentCommands(commandId: string): Promise<void> {
    const blockedCommands = await this.storage.getCommandsBlockedBy(commandId)

    for (const blocked of blockedCommands) {
      if (!isTerminalStatus(blocked.status)) {
        await this.updateCommandStatus(blocked, 'cancelled', {
          error: {
            source: 'local',
            message: `Dependency ${commandId} failed`,
          },
        })

        // Recursively cancel commands blocked by this one
        await this.cancelDependentCommands(blocked.commandId)
      }
    }
  }

  private async updateCommandStatus(
    command: CommandRecord,
    newStatus: CommandStatus,
    additionalUpdates?: Partial<CommandRecord>,
  ): Promise<CommandRecord> {
    const previousStatus = command.status
    const updates: Partial<CommandRecord> = {
      status: newStatus,
      updatedAt: Date.now(),
      ...additionalUpdates,
    }

    await this.storage.updateCommand(command.commandId, updates)

    // Clean up anticipated events when command reaches terminal state
    if (isTerminalStatus(newStatus)) {
      try {
        await this.anticipatedEventHandler.cleanup(command.commandId, newStatus)
      } catch (err) {
        logProvider.log.error(
          { err, commandId: command.commandId },
          'Failed to clean up anticipated events',
        )
      }
    }

    const updatedCommand = { ...command, ...updates }

    // Emit status change event
    if (previousStatus !== newStatus) {
      logProvider.log.debug(
        { commandId: command.commandId, from: previousStatus, to: newStatus },
        'Command status changed',
      )
      this.emitCommandEvent('status-changed', updatedCommand, previousStatus)
    }

    return updatedCommand
  }

  private emitCommandEvent(
    eventType: CommandEvent['eventType'],
    command: CommandRecord,
    previousStatus?: CommandStatus,
  ): void {
    const event: CommandEvent = {
      eventType,
      commandId: command.commandId,
      type: command.type,
      status: command.status,
      previousStatus,
      error: command.error,
      response: command.serverResponse,
      timestamp: Date.now(),
    }

    this.commandEvents.next(event)
  }

  private toCompletionResult(command: CommandRecord): CommandCompletionResult {
    switch (command.status) {
      case 'succeeded':
        return { status: 'succeeded', response: command.serverResponse }
      case 'failed':
        return {
          status: 'failed',
          error: command.error ?? { source: 'local', message: 'Unknown error' },
        }
      case 'cancelled':
        return { status: 'cancelled' }
      default:
        // Should not happen for terminal states
        return { status: 'failed', error: { source: 'local', message: 'Invalid command state' } }
    }
  }

  private eventToCompletionResult(event: CommandEvent): CommandCompletionResult {
    switch (event.status) {
      case 'succeeded':
        return { status: 'succeeded', response: event.response }
      case 'failed':
        return {
          status: 'failed',
          error: event.error ?? { source: 'local', message: 'Unknown error' },
        }
      case 'cancelled':
        return { status: 'cancelled' }
      default:
        return { status: 'failed', error: { source: 'local', message: 'Invalid event state' } }
    }
  }

  private toCommandError(error: unknown): CommandError {
    if (error instanceof CommandSendError) {
      return {
        source: 'server',
        message: error.message,
        code: error.code,
        details: error.details,
      }
    }

    if (error instanceof Error) {
      return {
        source: 'local',
        message: error.message,
      }
    }

    return {
      source: 'local',
      message: String(error),
    }
  }

  /**
   * Clear all command state for session destroy.
   * Pauses, clears retry timers, waits for in-flight, clears anticipated event tracking, deletes all commands.
   */
  async clearAll(): Promise<void> {
    await this.reset()
    await this.anticipatedEventHandler.clearAll()
    await this.storage.deleteAllCommands()
    logProvider.log.debug('Command queue cleared')
  }

  /**
   * Reset the command queue for a session change.
   * Pauses, clears retry timers, and waits for in-flight processing to settle.
   */
  async reset(): Promise<void> {
    this._paused = true

    for (const timerId of this.retryTimers) {
      clearTimeout(timerId)
    }
    this.retryTimers.clear()

    if (this.processingPromise) {
      await this.processingPromise
    }

    logProvider.log.debug('Command queue reset')
  }

  pause(): void {
    this._paused = true
    logProvider.log.debug('Command queue paused')
  }

  resume(): void {
    this._paused = false
    logProvider.log.debug('Command queue resumed')
    // Trigger processing
    this.processPendingCommands().catch((err) => {
      logProvider.log.error({ err }, 'Failed to process pending commands on resume')
    })
  }

  isPaused(): boolean {
    return this._paused
  }

  /**
   * Destroy the command queue and release resources.
   * Waits for any in-flight command processing to settle before returning.
   */
  async destroy(): Promise<void> {
    // Stop the processing loop from picking up new commands
    this._paused = true

    for (const timerId of this.retryTimers) {
      clearTimeout(timerId)
    }
    this.retryTimers.clear()

    this.destroy$.next()
    this.destroy$.complete()
    this.commandEvents.complete()

    // Wait for in-flight processing to settle (pausing ensures it finishes promptly)
    if (this.processingPromise) {
      await this.processingPromise
    }
  }
}
