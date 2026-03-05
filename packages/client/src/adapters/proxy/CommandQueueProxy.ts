/**
 * CommandQueue proxy — implements ICommandQueue on the main thread.
 *
 * Imperative methods (enqueue, getCommand, etc.) use RPC.
 * Observable properties (events$, commandEvents$) are reconstructed from broadcasts.
 * waitForCompletion and enqueueAndWait are implemented locally via broadcast subscription
 * to avoid long-running RPC timeouts.
 */

import { Err, Ok } from '@meticoeus/ddd-es'
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
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type {
  CommandCompletionResult,
  CommandError,
  CommandEvent,
  CommandFilter,
  CommandRecord,
  EnqueueAndWaitOptions,
  EnqueueAndWaitResult,
  EnqueueCommand,
  EnqueueOptions,
  EnqueueResult,
  WaitOptions,
} from '../../types/commands.js'
import { EnqueueAndWaitException, isTerminalStatus } from '../../types/commands.js'
import type { ValidationError } from '../../types/validation.js'

const DEFAULT_WAIT_TIMEOUT = 30000

/**
 * Main-thread proxy for the worker-side CommandQueue.
 */
export class CommandQueueProxy implements ICommandQueue {
  private readonly channel: WorkerMessageChannel
  private readonly destroy$ = new Subject<void>()
  private readonly commandEvents = new Subject<CommandEvent>()

  readonly events$: Observable<CommandEvent>

  constructor(channel: WorkerMessageChannel, broadcastEvents$: Observable<EventMessage>) {
    this.channel = channel

    // Reconstruct command events from broadcasts
    broadcastEvents$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      const commandEvent = broadcastToCommandEvent(event)
      if (commandEvent) {
        this.commandEvents.next(commandEvent)
      }
    })

    this.events$ = this.commandEvents.asObservable().pipe(share(), takeUntil(this.destroy$))
  }

  async enqueue<TPayload, TEvent>(
    command: EnqueueCommand<TPayload>,
    options?: EnqueueOptions,
  ): Promise<EnqueueResult<TEvent>> {
    return this.channel.request<EnqueueResult<TEvent>>('commandQueue.enqueue', [command, options])
  }

  async waitForCompletion(
    commandId: string,
    options?: WaitOptions,
  ): Promise<CommandCompletionResult> {
    const timeout = options?.timeout ?? DEFAULT_WAIT_TIMEOUT

    // Check if command is already in terminal state
    const command = await this.getCommand(commandId)
    if (!command) {
      return { status: 'failed', error: { source: 'local', message: 'Command not found' } }
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
    return this.channel.request<CommandRecord | undefined>('commandQueue.getCommand', [commandId])
  }

  async listCommands(commandFilter?: CommandFilter): Promise<CommandRecord[]> {
    return this.channel.request<CommandRecord[]>('commandQueue.listCommands', [commandFilter])
  }

  async cancelCommand(commandId: string): Promise<void> {
    return this.channel.request<void>('commandQueue.cancelCommand', [commandId])
  }

  async retryCommand(commandId: string): Promise<void> {
    return this.channel.request<void>('commandQueue.retryCommand', [commandId])
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

  destroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
    this.commandEvents.complete()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastToCommandEvent(event: EventMessage): CommandEvent | undefined {
  const payload = event.payload as Record<string, unknown>

  switch (event.eventName) {
    case 'command:enqueued':
      return {
        eventType: 'enqueued',
        commandId: payload.commandId as string,
        type: payload.type as string,
        status: 'pending',
        timestamp: Date.now(),
      }
    case 'command:status-changed':
      return {
        eventType: 'status-changed',
        commandId: payload.commandId as string,
        type: payload.type as string,
        status: payload.status as CommandRecord['status'],
        previousStatus: payload.previousStatus as CommandRecord['status'] | undefined,
        error: payload.error as CommandError | undefined,
        response: payload.response,
        timestamp: Date.now(),
      }
    case 'command:completed':
      return {
        eventType: 'completed',
        commandId: payload.commandId as string,
        type: payload.type as string,
        status: 'succeeded',
        response: payload.response,
        timestamp: Date.now(),
      }
    case 'command:failed':
      return {
        eventType: 'failed',
        commandId: payload.commandId as string,
        type: payload.type as string,
        status: 'failed',
        error: payload.error as CommandError | undefined,
        timestamp: Date.now(),
      }
    default:
      return undefined
  }
}

function toCompletionResult(command: CommandRecord): CommandCompletionResult {
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
      return { status: 'failed', error: { source: 'local', message: 'Invalid command state' } }
  }
}

function eventToCompletionResult(event: CommandEvent): CommandCompletionResult {
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
