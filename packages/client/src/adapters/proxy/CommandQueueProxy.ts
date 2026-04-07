/**
 * CommandQueue proxy — implements ICommandQueue on the main thread.
 *
 * Imperative methods (enqueue, getCommand, etc.) use RPC.
 * Observable properties (events$, commandEvents$) are reconstructed from broadcasts.
 * waitForCompletion and enqueueAndWait are implemented locally via broadcast subscription
 * to avoid long-running RPC timeouts.
 */

import { Err, type IException, type Link, Ok, type Result } from '@meticoeus/ddd-es'
import {
  Observable,
  Subject,
  filter,
  firstValueFrom,
  map,
  race,
  share,
  takeUntil,
  timer,
} from 'rxjs'
import type { ICommandFileStore } from '../../core/command-queue/file-store/ICommandFileStore.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { CommandCompletionError } from '../../types/commands.js'
import {
  CommandCancelledException,
  CommandEvent,
  CommandFailedException,
  CommandFilter,
  CommandNotFoundException,
  CommandRecord,
  CommandTimeoutException,
  EnqueueAndWaitParams,
  EnqueueAndWaitResult,
  EnqueueCommand,
  EnqueueParams,
  EnqueueResult,
  InvalidCommandStatusException,
  WaitOptions,
  isCommandFailed,
  isTerminalStatus,
} from '../../types/commands.js'
import { assert } from '../../utils/assert.js'
import { generateId } from '../../utils/uuid.js'

const DEFAULT_WAIT_TIMEOUT = 30000

/**
 * Main-thread proxy for the worker-side CommandQueue.
 */
export class CommandQueueProxy<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements ICommandQueue<TLink, TCommand> {
  private readonly channel: WorkerMessageChannel
  private readonly fileStore?: ICommandFileStore
  private readonly destroy$ = new Subject<void>()
  private readonly commandEvents = new Subject<CommandEvent>()

  readonly events$: Observable<CommandEvent>

  constructor(
    channel: WorkerMessageChannel,
    broadcastEvents$: Observable<EventMessage>,
    fileStore?: ICommandFileStore,
  ) {
    this.channel = channel
    this.fileStore = fileStore

    // Reconstruct command events from broadcasts
    broadcastEvents$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      const commandEvent = broadcastToCommandEvent(event)
      if (commandEvent) {
        this.commandEvents.next(commandEvent)
      }
    })

    this.events$ = this.commandEvents.asObservable().pipe(share(), takeUntil(this.destroy$))
  }

  async enqueue<TData, TEvent>(
    params: EnqueueParams<TLink, TData>,
  ): Promise<EnqueueResult<TEvent>> {
    // Write files to OPFS from the window side before sending to worker (spec §3.14.3)
    if (params.command.files?.length && this.fileStore) {
      const commandId = params.commandId ?? generateId()
      params.commandId = commandId
      const fileRefs: import('../../types/commands.js').FileRef[] = []
      for (const file of params.command.files) {
        const fileId = generateId()
        const storagePath = await this.fileStore.save(commandId, fileId, file)
        fileRefs.push({
          id: fileId,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          storagePath,
        })
      }
      params.command.files = undefined
      params.fileRefs = fileRefs
    }

    return this.channel.request<EnqueueResult<TEvent>>('commandQueue.enqueue', [params])
  }

  async waitForCompletion(
    commandId: string,
    options?: WaitOptions,
  ): Promise<Result<unknown, CommandCompletionError>> {
    const timeout = options?.timeout ?? DEFAULT_WAIT_TIMEOUT

    // Check if command is already in terminal state
    const command = await this.getCommand(commandId)
    if (!command) {
      return Err(new CommandFailedException('local', `Command not found: ${commandId}`))
    }

    if (isTerminalStatus(command.status)) {
      return toCompletionResult(command)
    }

    // Wait for terminal state via broadcast events
    const terminalEvent$ = this.commandEvents$(commandId).pipe(
      filter((event) => isTerminalStatus(event.status)),
      map((event) => eventToCompletionResult(event)),
    )

    const timeout$ = timer(timeout).pipe(
      map((): Result<unknown, CommandCompletionError> => Err(new CommandTimeoutException())),
    )

    return firstValueFrom(race(terminalEvent$, timeout$))
  }

  async enqueueAndWait<TData, TEvent, TResponse>(
    params: EnqueueAndWaitParams<TLink, TData>,
  ): Promise<EnqueueAndWaitResult<TResponse>> {
    const { commandId, command, cacheKey, skipValidation, ...options } = params
    const enqueueResult = await this.enqueue<TData, TEvent>(params)

    if (!enqueueResult.ok) {
      return Err(enqueueResult.error)
    }

    const completionResult = await this.waitForCompletion(enqueueResult.value.commandId, options)

    if (!completionResult.ok) {
      return Err(completionResult.error)
    }

    return Ok({
      commandId: enqueueResult.value.commandId,
      response: completionResult.value as TResponse,
    })
  }

  commandEvents$(commandId: string): Observable<CommandEvent> {
    return this.events$.pipe(filter((event) => event.commandId === commandId))
  }

  async getCommand(commandId: string): Promise<CommandRecord<TLink, TCommand> | undefined> {
    return this.channel.request<CommandRecord<TLink, TCommand> | undefined>(
      'commandQueue.getCommand',
      [commandId],
    )
  }

  async listCommands(commandFilter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]> {
    return this.channel.request<CommandRecord<TLink, TCommand>[]>('commandQueue.listCommands', [
      commandFilter,
    ])
  }

  async cancelCommand(commandId: string) {
    return this.channel.request<
      Result<void, CommandNotFoundException | InvalidCommandStatusException>
    >('commandQueue.cancelCommand', [commandId])
  }

  async retryCommand(commandId: string) {
    return this.channel.request<
      Result<void, CommandNotFoundException | InvalidCommandStatusException>
    >('commandQueue.retryCommand', [commandId])
  }

  async processPendingCommands(): Promise<void> {
    return this.channel.request<void>('commandQueue.processPendingCommands')
  }

  pause(): void {
    this.channel.request<void>('commandQueue.pause').catch(() => {
      // Fire-and-forget — pause is best-effort from main thread
    })
  }

  resume(): void {
    this.channel.request<void>('commandQueue.resume').catch(() => {
      // Fire-and-forget — resume is best-effort from main thread
    })
  }

  isPaused(): boolean {
    // Return false as default — main thread cannot synchronously query worker state.
    // Consumers should rely on the observable pattern for state tracking.
    return false
  }

  async getCommandEntities(commandId: string, collection?: string): Promise<string[]> {
    return this.channel.request<string[]>('commandQueue.getCommandEntities', [
      commandId,
      collection,
    ])
  }

  destroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
    this.commandEvents.complete()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastToCommandEvent<TLink extends Link, TCommand extends EnqueueCommand>(
  event: EventMessage,
): CommandEvent | undefined {
  const data = event.data as Record<string, unknown>

  switch (event.eventName) {
    case 'command:enqueued':
      return {
        eventType: 'enqueued',
        commandId: data.commandId as string,
        type: data.type as string,
        status: 'pending',
        timestamp: Date.now(),
      }
    case 'command:status-changed':
      return {
        eventType: 'status-changed',
        commandId: data.commandId as string,
        type: data.type as string,
        status: data.status as CommandRecord<TLink, TCommand>['status'],
        previousStatus: data.previousStatus as CommandRecord<TLink, TCommand>['status'] | undefined,
        error: data.error as IException | undefined,
        response: data.response,
        timestamp: Date.now(),
      }
    case 'command:completed':
      return {
        eventType: 'completed',
        commandId: data.commandId as string,
        type: data.type as string,
        status: 'succeeded',
        response: data.response,
        timestamp: Date.now(),
      }
    case 'command:failed':
      return {
        eventType: 'failed',
        commandId: data.commandId as string,
        type: data.type as string,
        status: 'failed',
        error: data.error as IException | undefined,
        timestamp: Date.now(),
      }
    default:
      return undefined
  }
}

function toCompletionResult<TLink extends Link, TCommand extends EnqueueCommand>(
  command: CommandRecord<TLink, TCommand>,
): Result<unknown, CommandCompletionError> {
  switch (command.status) {
    case 'succeeded':
      return Ok(command.serverResponse)
    case 'failed': {
      const error = command.error
      if (isCommandFailed(error)) return Err(error)
      return Err(new CommandFailedException('server', error?.message ?? 'Unknown error'))
    }
    case 'cancelled':
      return Err(new CommandCancelledException())
    default:
      assert(false, `Unexpected terminal status: ${command.status}`)
  }
}

function eventToCompletionResult(event: CommandEvent): Result<unknown, CommandCompletionError> {
  switch (event.status) {
    case 'succeeded':
      return Ok(event.response)
    case 'failed': {
      const error = event.error
      if (isCommandFailed(error)) return Err(error)
      return Err(new CommandFailedException('server', error?.message ?? 'Unknown error'))
    }
    case 'cancelled':
      return Err(new CommandCancelledException())
    default:
      assert(false, `Unexpected terminal status: ${event.status}`)
  }
}
