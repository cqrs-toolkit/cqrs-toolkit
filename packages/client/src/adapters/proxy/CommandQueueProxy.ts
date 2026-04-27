/**
 * CommandQueue proxy — implements ICommandQueue on the main thread.
 *
 * Imperative methods (enqueue, getCommand, etc.) use RPC.
 * Observable properties (events$, commandEvents$) are reconstructed from broadcasts.
 * waitForSucceeded, waitForApplied, and enqueueAndWait are implemented locally
 * via broadcast subscription to avoid long-running RPC timeouts.
 */

import { generateId } from '#utils'
import { Err, type IException, type Link, Ok, type Result } from '@meticoeus/ddd-es'
import { Observable, Subject, filter, firstValueFrom, share, take, takeUntil } from 'rxjs'
import type { ICommandFileStore } from '../../core/command-queue/file-store/ICommandFileStore.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import { waitForTerminal } from '../../core/command-queue/waitForTerminal.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { CommandCompletionError } from '../../types/commands.js'
import {
  CommandEvent,
  CommandFilter,
  CommandNotFoundException,
  CommandRecord,
  EnqueueAndWaitParams,
  EnqueueAndWaitResult,
  EnqueueCommand,
  EnqueueParams,
  EnqueueResult,
  InvalidCommandStatusException,
  WaitOptions,
} from '../../types/commands.js'

/**
 * Main-thread proxy for the worker-side CommandQueue.
 */
export class CommandQueueProxy<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements ICommandQueue<TLink, TCommand> {
  private readonly destroy$ = new Subject<void>()
  private readonly commandEvents = new Subject<CommandEvent>()
  private readonly pausedEvents$: Observable<EventMessage>
  private readonly resumedEvents$: Observable<EventMessage>

  readonly events$: Observable<CommandEvent>

  constructor(
    private readonly channel: WorkerMessageChannel,
    private readonly fileStore: ICommandFileStore,
    broadcastEvents$: Observable<EventMessage>,
  ) {
    // Reconstruct command events from broadcasts
    broadcastEvents$.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      const commandEvent = broadcastToCommandEvent(event)
      if (commandEvent) {
        this.commandEvents.next(commandEvent)
      }
    })

    this.pausedEvents$ = broadcastEvents$.pipe(
      filter((event) => event.eventName === 'commandqueue:paused'),
      share(),
      takeUntil(this.destroy$),
    )
    this.resumedEvents$ = broadcastEvents$.pipe(
      filter((event) => event.eventName === 'commandqueue:resumed'),
      share(),
      takeUntil(this.destroy$),
    )

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

  waitForSucceeded(
    commandId: string,
    options?: WaitOptions,
  ): Promise<Result<unknown, CommandCompletionError>> {
    return waitForTerminal(this, commandId, 'succeeded', options)
  }

  waitForApplied(
    commandId: string,
    options?: WaitOptions,
  ): Promise<Result<unknown, CommandCompletionError>> {
    return waitForTerminal(this, commandId, 'applied', options)
  }

  async enqueueAndWait<TData, TEvent, TResponse>(
    params: EnqueueAndWaitParams<TLink, TData>,
  ): Promise<EnqueueAndWaitResult<TResponse>> {
    const { commandId, command, cacheKey, skipValidation, waitFor, ...options } = params
    const enqueueResult = await this.enqueue<TData, TEvent>(params)

    if (!enqueueResult.ok) {
      return Err(enqueueResult.error)
    }

    const terminal = waitFor ?? 'applied'
    const completionResult =
      terminal === 'succeeded'
        ? await this.waitForSucceeded(enqueueResult.value.commandId, options)
        : await this.waitForApplied(enqueueResult.value.commandId, options)

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

  async pause(): Promise<void> {
    // Subscribe BEFORE sending the RPC so a fast settlement broadcast isn't
    // missed. The RPC acknowledges receipt; the broadcast signals drain.
    const settled = firstValueFrom(this.pausedEvents$.pipe(take(1)))
    await this.channel.request<void>('commandQueue.pause')
    await settled
  }

  async resume(): Promise<void> {
    // Same subscribe-first pattern as pause.
    const settled = firstValueFrom(this.resumedEvents$.pipe(take(1)))
    await this.channel.request<void>('commandQueue.resume')
    await settled
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
    case 'command:cancelled':
      return {
        eventType: 'cancelled',
        commandId: data.commandId as string,
        type: data.type as string,
        status: 'cancelled',
        timestamp: Date.now(),
      }
    default:
      return undefined
  }
}
