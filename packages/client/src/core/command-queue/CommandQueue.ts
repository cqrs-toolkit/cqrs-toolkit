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
import type {
  DomainExecutionResult,
  ICommandHandlerMetadata,
  IDomainExecutor,
  ParentRefConfig,
} from '../../types/domain.js'
import { autoRevision, isAutoRevision } from '../../types/domain.js'
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
  /** Clean up anticipated events when command reaches terminal state. Clears local changes for tracked entries. */
  cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void>
  /** Replace anticipated events for a command (used when payload is rewritten after a dependency succeeds). */
  regenerate(commandId: string, newEvents: unknown[]): Promise<void>
  /** Get tracked read model entries for a command (e.g., ["todos:client-abc"]). */
  getTrackedEntries(commandId: string): string[] | undefined
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
  /** Metadata lookup for command handler registrations (creates, revisionField). */
  handlerMetadata?: ICommandHandlerMetadata
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
/**
 * Tracks the command chain for a single aggregate.
 * Used to auto-chain commands targeting the same aggregate.
 */
interface AggregateChain {
  /** Command ID of the create command (if pending with temporary ID). */
  createCommandId?: string
  /** Command ID of the latest command in the chain. */
  latestCommandId: string
}

export class CommandQueue implements ICommandQueue {
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly anticipatedEventHandler: IAnticipatedEventHandler
  private readonly domainExecutor?: IDomainExecutor
  private readonly handlerMetadata?: ICommandHandlerMetadata
  private readonly commandSender?: ICommandSender
  private readonly retryConfig: RetryConfig
  private readonly defaultService: string
  private readonly onCommandResponse?: (command: CommandRecord, response: unknown) => Promise<void>
  private readonly retainTerminal: boolean

  private readonly commandEvents = new Subject<CommandEvent>()
  private readonly destroy$ = new Subject<void>()

  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>()

  /**
   * In-memory tracking of command chains per aggregate.
   * Key is the aggregate ID (client-generated for creates, payload.id for mutates).
   */
  private readonly aggregateChains = new Map<string, AggregateChain>()

  private _paused = true
  private processingPromise: Promise<void> | undefined
  private _pendingReprocess = false

  readonly events$: Observable<CommandEvent>

  constructor(config: CommandQueueConfig) {
    this.storage = config.storage
    this.eventBus = config.eventBus
    this.anticipatedEventHandler = config.anticipatedEventHandler
    this.domainExecutor = config.domainExecutor
    this.handlerMetadata = config.handlerMetadata
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

    // Look up handler registration metadata (creates, revisionField)
    const registration = this.handlerMetadata?.getRegistration(command.type)

    // Patch stale client IDs from the ID mapping cache (race condition fix).
    // This corrects payloads where the UI component still had a client-generated ID
    // because the server's response hadn't propagated to the reactive layer yet.
    const patchedCommand = await this.patchFromIdMappingCache(command, registration)

    // Run domain validation if executor is available and not skipped
    let anticipatedEvents: TEvent[] = []
    let postProcess: CommandRecord['postProcess']

    if (this.domainExecutor && !options?.skipValidation) {
      // Trust boundary: the consumer-provided domainExecutor is expected to produce
      // TEvent-compatible anticipated events. TypeScript cannot verify this without
      // making CommandQueue generic in TEvent, which would propagate through the
      // entire client factory.
      const result = this.domainExecutor.execute(patchedCommand) as DomainExecutionResult<TEvent>

      if (!result.ok) {
        return Err(result.error)
      }

      anticipatedEvents = result.value.anticipatedEvents
      postProcess = result.value.postProcessPlan
    }

    // Detect aggregate and build auto-dependencies
    const explicitDeps = command.dependsOn ?? []
    const autoDeps = this.detectAggregateDependencies(
      commandId,
      patchedCommand.type,
      patchedCommand.payload,
      anticipatedEvents,
      registration,
    )
    const allDeps = [...new Set([...explicitDeps, ...autoDeps])]

    // Calculate blockedBy from all dependencies (only non-terminal commands)
    const blockedBy: string[] = []
    for (const depId of allDeps) {
      const depCommand = await this.storage.getCommand(depId)
      if (depCommand && !isTerminalStatus(depCommand.status)) {
        blockedBy.push(depId)
      }
    }

    // Determine initial status based on unresolved dependencies
    const initialStatus: CommandStatus = blockedBy.length > 0 ? 'blocked' : 'pending'

    // Create command record
    const record: CommandRecord<TPayload> = {
      commandId,
      service: command.service ?? this.defaultService,
      type: command.type,
      payload: patchedCommand.payload,
      status: initialStatus,
      dependsOn: allDeps,
      blockedBy,
      attempts: 0,
      postProcess,
      creates: registration?.creates,
      revisionField: registration?.revisionField,
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

    // Generate correlation ID per send attempt (links retries)
    const correlationId = generateId()

    this.eventBus.emitDebug('command:sent', {
      commandId: current.commandId,
      correlationId,
      service: current.service,
      type: current.type,
      payload: current.payload,
    })

    // Resolve AUTO_REVISION before sending — the server must never see the marker.
    const sendCommand = this.resolveAutoRevisionForSend(updatedCommand)

    try {
      const response = await this.commandSender.send(sendCommand)

      this.eventBus.emitDebug('command:response', {
        commandId: current.commandId,
        correlationId,
        response,
      })

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
      const succeededCommand = await this.updateCommandStatus(updatedCommand, 'succeeded', {
        serverResponse: response,
      })

      // Save ID mapping and build ID map for create commands with temporary IDs.
      // This must happen unconditionally — even without blocked dependents — so that
      // future commands with stale client IDs can be patched at enqueue time.
      const idMap = await this.reconcileCreateIds(succeededCommand)

      // For create commands with temporary IDs: rewrite ALL commands in the aggregate
      // chain with the server ID. They stay blocked (waiting for their direct dependency
      // to resolve their revision), but get the correct server ID immediately.
      if (Object.keys(idMap).length > 0) {
        await this.rewriteAggregateChainIds(idMap)
      }

      // Unblock direct dependents and resolve revision for the next command in chain
      await this.unblockDependentCommands(succeededCommand, idMap)

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

  private async unblockDependentCommands(
    parentCommand: CommandRecord,
    idMap: Record<string, string>,
  ): Promise<void> {
    const blockedCommands = await this.storage.getCommandsBlockedBy(parentCommand.commandId)
    if (blockedCommands.length === 0) return

    // Extract the latest revision from the parent's response for AUTO_REVISION resolution
    const parentRevision = this.extractRevisionFromResponse(parentCommand)

    for (const blocked of blockedCommands) {
      const newBlockedBy = blocked.blockedBy.filter((id) => id !== parentCommand.commandId)

      // Rewrite payload if there are ID or revision substitutions to make
      if (Object.keys(idMap).length > 0 || parentRevision !== undefined) {
        await this.rewriteDependentCommand(blocked, idMap, parentRevision)
      }

      if (newBlockedBy.length === 0 && blocked.status === 'blocked') {
        // No longer blocked
        await this.updateCommandStatus(blocked, 'pending', { blockedBy: newBlockedBy })
      } else {
        // Still blocked by other commands
        await this.storage.updateCommand(blocked.commandId, { blockedBy: newBlockedBy })
      }
    }
  }

  /**
   * Rewrite the ID in all non-terminal commands whose payload contains a stale client ID.
   * Called when a create with temporary ID succeeds — cascades the server ID to the entire
   * aggregate chain regardless of dependency depth. Only rewrites ID, not revision.
   */
  private async rewriteAggregateChainIds(idMap: Record<string, string>): Promise<void> {
    const allCommands = await this.storage.getCommandsByStatus(['pending', 'blocked', 'sending'])

    for (const command of allCommands) {
      let payloadJson = JSON.stringify(command.payload)
      let changed = false

      for (const [clientId, serverId] of Object.entries(idMap)) {
        if (payloadJson.includes(clientId)) {
          payloadJson = payloadJson.replaceAll(clientId, serverId)
          changed = true
        }
      }

      if (changed) {
        const newPayload: unknown = JSON.parse(payloadJson)
        await this.storage.updateCommand(command.commandId, { payload: newPayload })

        // Regenerate anticipated events with the correct server ID
        if (this.domainExecutor) {
          const result = this.domainExecutor.execute({ type: command.type, payload: newPayload })
          if (result.ok) {
            try {
              await this.anticipatedEventHandler.regenerate(
                command.commandId,
                result.value.anticipatedEvents as unknown[],
              )
            } catch (err) {
              logProvider.log.error(
                { err, commandId: command.commandId },
                'Failed to regenerate anticipated events during chain ID rewrite',
              )
            }
          }
        }
      }
    }
  }

  /**
   * Reconcile create command IDs: build the clientId→serverId map, update aggregate chains,
   * and persist the mapping for race condition handling.
   *
   * Called unconditionally when any command succeeds. Returns a non-empty map only for
   * create commands with temporary IDs.
   */
  private async reconcileCreateIds(command: CommandRecord): Promise<Record<string, string>> {
    const map: Record<string, string> = {}
    if (!command.creates || command.creates.idStrategy !== 'temporary') return map
    if (!command.serverResponse) return map

    const serverId = this.readResponseField(command.serverResponse, 'id')
    if (!serverId) return map

    const revision = this.readResponseField(command.serverResponse, 'nextExpectedRevision')

    // Find the client temp ID from the aggregate chain tracking
    for (const [clientId, chain] of this.aggregateChains) {
      if (chain.createCommandId === command.commandId && clientId !== serverId) {
        map[clientId] = serverId

        // Update the chain to use the server ID
        this.aggregateChains.delete(clientId)
        this.aggregateChains.set(serverId, {
          ...chain,
          createCommandId: undefined, // No longer a pending create
        })

        // Persist the mapping for race condition handling.
        // When the UI still has stale client IDs or stale revisions,
        // future enqueue calls will find this mapping and patch the payload silently.
        await this.storage.saveCommandIdMapping({
          clientId,
          serverId,
          data: JSON.stringify({
            revision,
            commandType: command.type,
            serverResponse: command.serverResponse,
          }),
          createdAt: Date.now(),
        })

        break
      }
    }

    return map
  }

  /**
   * Extract the revision from a command's server response body.
   * Reads the `nextExpectedRevision` field (globally configured default).
   */
  private extractRevisionFromResponse(command: CommandRecord): string | undefined {
    if (!command.serverResponse) return undefined
    return this.readResponseField(command.serverResponse, 'nextExpectedRevision')
  }

  /**
   * Read a field from the command response body.
   * Uses the globally configured field names (defaults: 'id', 'nextExpectedRevision').
   */
  private readResponseField(response: unknown, field: string): string | undefined {
    if (typeof response !== 'object' || response === null) return undefined
    if (!(field in response)) return undefined
    const value = (response as Record<string, unknown>)[field]
    if (typeof value === 'string') return value
    return undefined
  }

  /**
   * Rewrite a dependent command's payload after its dependency succeeded.
   * Replaces temp IDs with server IDs and resolves AUTO_REVISION.
   */
  private async rewriteDependentCommand(
    command: CommandRecord,
    idMap: Record<string, string>,
    parentRevision: string | undefined,
  ): Promise<void> {
    let payloadJson = JSON.stringify(command.payload)
    let changed = false

    // Replace all temp IDs with server IDs via string replacement.
    // UUIDs are globally unique so false positives are essentially impossible.
    for (const [clientId, serverId] of Object.entries(idMap)) {
      if (payloadJson.includes(clientId)) {
        payloadJson = payloadJson.replaceAll(clientId, serverId)
        changed = true
      }
    }

    // Resolve AUTO_REVISION if this command has a revisionField and the value is the marker
    if (command.revisionField && parentRevision !== undefined) {
      const payload = changed ? JSON.parse(payloadJson) : command.payload
      if (
        typeof payload === 'object' &&
        payload !== null &&
        command.revisionField in payload &&
        isAutoRevision((payload as Record<string, unknown>)[command.revisionField])
      ) {
        ;(payload as Record<string, unknown>)[command.revisionField] = parentRevision
        payloadJson = JSON.stringify(payload)
        changed = true
      }
    }

    if (!changed) return

    const newPayload: unknown = JSON.parse(payloadJson)

    // Update the command record with the rewritten payload
    await this.storage.updateCommand(command.commandId, { payload: newPayload })

    // Re-run the domain executor to produce fresh anticipated events with correct IDs
    if (this.domainExecutor) {
      const result = this.domainExecutor.execute({ type: command.type, payload: newPayload })
      if (result.ok) {
        try {
          await this.anticipatedEventHandler.regenerate(
            command.commandId,
            result.value.anticipatedEvents as unknown[],
          )
        } catch (err) {
          logProvider.log.error(
            { err, commandId: command.commandId },
            'Failed to regenerate anticipated events after payload rewrite',
          )
        }
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

  /**
   * Patch a command's payload using the ID mapping cache.
   *
   * Handles three cases:
   * 1. payload.id is a stale client ID → replace with server ID + patch revision (same-aggregate)
   * 2. payload.id is the correct server ID but revision is stale → patch revision only
   * 3. payload[parentRef.field] is a stale parent client ID → replace with server ID (cross-aggregate)
   */
  private async patchFromIdMappingCache<TPayload>(
    command: EnqueueCommand<TPayload>,
    registration:
      | {
          creates?: CommandRecord['creates']
          revisionField?: string
          parentRef?: ParentRefConfig[]
        }
      | undefined,
  ): Promise<EnqueueCommand<TPayload>> {
    if (typeof command.payload !== 'object' || command.payload === null) return command

    let patchedPayload = command.payload
    let changed = false

    // Same-aggregate: check payload.id (only for mutate commands, not creates)
    if (!registration?.creates) {
      const payloadId = this.extractPayloadId(command.payload)
      if (typeof payloadId === 'string') {
        const result = await this.patchIdField(patchedPayload, payloadId, registration)
        if (result !== undefined) {
          patchedPayload = result
          changed = true
        }
      }
    }

    // Cross-aggregate: check each parentRef entry
    if (registration?.parentRef !== undefined) {
      for (const ref of registration.parentRef) {
        const parentId = (patchedPayload as Record<string, unknown>)[ref.field]
        if (typeof parentId !== 'string') continue

        const mapping = await this.storage.getCommandIdMapping(parentId)
        if (mapping === undefined) continue

        // Verify the mapping was produced by the expected command type
        const mappingData = JSON.parse(mapping.data) as { commandType?: string }
        if (mappingData.commandType !== ref.fromCommand) continue
        ;(patchedPayload as Record<string, unknown>)[ref.field] = mapping.serverId
        changed = true

        logProvider.log.debug(
          {
            field: ref.field,
            fromCommand: ref.fromCommand,
            clientId: parentId,
            serverId: mapping.serverId,
          },
          'Patched stale parent ID from mapping cache',
        )
      }
    }

    return changed ? { ...command, payload: patchedPayload } : command
  }

  /**
   * Try to patch payload.id from the mapping cache (same-aggregate).
   * Returns the patched payload if a mapping was found, undefined otherwise.
   */
  private async patchIdField<TPayload>(
    payload: TPayload,
    payloadId: string,
    registration: { revisionField?: string } | undefined,
  ): Promise<TPayload | undefined> {
    // Try lookup by client ID first, then by server ID
    const byClientId = await this.storage.getCommandIdMapping(payloadId)
    const byServerId =
      byClientId === undefined
        ? await this.storage.getCommandIdMappingByServerId(payloadId)
        : undefined
    const mapping = byClientId ?? byServerId
    if (mapping === undefined) return undefined

    const mappingData = JSON.parse(mapping.data) as { revision?: string }
    let patchedPayload = payload

    // Case 1: payload has stale client ID → replace with server ID
    if (byClientId !== undefined) {
      let payloadJson = JSON.stringify(payload)
      payloadJson = payloadJson.replaceAll(payloadId, mapping.serverId)
      patchedPayload = JSON.parse(payloadJson) as TPayload

      logProvider.log.debug(
        { clientId: payloadId, serverId: mapping.serverId },
        'Patched stale client ID from mapping cache',
      )
    }

    // Patch autoRevision fallback if the revision is undefined/stale
    if (
      registration?.revisionField !== undefined &&
      typeof patchedPayload === 'object' &&
      patchedPayload !== null &&
      mappingData.revision !== undefined
    ) {
      const revisionValue = (patchedPayload as Record<string, unknown>)[registration.revisionField]
      if (isAutoRevision(revisionValue) && revisionValue.fallback === undefined) {
        ;(patchedPayload as Record<string, unknown>)[registration.revisionField] = autoRevision(
          mappingData.revision,
        )
      }
    }

    return patchedPayload
  }

  /**
   * Resolve AUTO_REVISION markers in a command's payload before sending to the server.
   * Returns a new command record with the resolved payload (or the original if no resolution needed).
   */
  private resolveAutoRevisionForSend(command: CommandRecord): CommandRecord {
    if (!command.revisionField) return command

    const payload = command.payload
    if (typeof payload !== 'object' || payload === null) return command
    if (!(command.revisionField in payload)) return command

    const revisionValue = (payload as Record<string, unknown>)[command.revisionField]
    if (!isAutoRevision(revisionValue)) return command

    // Use the fallback revision from the marker (the read model revision the consumer passed)
    const resolvedPayload = { ...(payload as Record<string, unknown>) }
    resolvedPayload[command.revisionField] = revisionValue.fallback
    return { ...command, payload: resolvedPayload }
  }

  /**
   * Detect same-aggregate dependencies and update the aggregate chain tracker.
   *
   * For create commands: extract the aggregate ID from anticipated events and start a new chain.
   * For mutate commands: read payload.id and chain after the latest command on that aggregate.
   *
   * @returns Array of auto-generated dependency command IDs (may be empty).
   */
  private detectAggregateDependencies<TEvent>(
    commandId: string,
    commandType: string,
    payload: unknown,
    anticipatedEvents: TEvent[],
    registration: { creates?: CommandRecord['creates']; revisionField?: string } | undefined,
  ): string[] {
    if (!registration) return []

    const autoDeps: string[] = []

    if (registration.creates) {
      // Create command: extract aggregate ID from anticipated events
      const aggregateId = this.extractAggregateIdFromEvents(
        anticipatedEvents,
        registration.creates.eventType,
      )

      if (typeof aggregateId === 'string') {
        // Check if there's already a chain for this aggregate (re-create case)
        const existing = this.aggregateChains.get(aggregateId)
        if (existing) {
          autoDeps.push(existing.latestCommandId)
        }

        // Start/update the chain
        this.aggregateChains.set(aggregateId, {
          createCommandId: registration.creates.idStrategy === 'temporary' ? commandId : undefined,
          latestCommandId: commandId,
        })
      }
    } else {
      // Mutate command: read payload.id to find the aggregate
      const aggregateId = this.extractPayloadId(payload)

      if (typeof aggregateId === 'string') {
        const chain = this.aggregateChains.get(aggregateId)
        if (chain) {
          // Chain after the latest command on this aggregate
          autoDeps.push(chain.latestCommandId)
          chain.latestCommandId = commandId
        } else {
          // First command on this aggregate — start a new chain so subsequent
          // commands will auto-chain behind this one
          this.aggregateChains.set(aggregateId, { latestCommandId: commandId })
        }
      }
    }

    return autoDeps
  }

  /**
   * Extract aggregate ID from anticipated events by finding the event matching the configured type.
   */
  private extractAggregateIdFromEvents(events: unknown[], eventType: string): string | undefined {
    for (const event of events) {
      if (typeof event !== 'object' || event === null) continue
      if (!('type' in event) || event.type !== eventType) continue
      if (!('data' in event) || typeof event.data !== 'object' || event.data === null) continue
      if ('id' in event.data && typeof event.data.id === 'string') {
        return event.data.id
      }
    }
    return undefined
  }

  /**
   * Extract the aggregate ID from a command payload (ddd-es convention: always `id`).
   */
  private extractPayloadId(payload: unknown): string | undefined {
    if (typeof payload !== 'object' || payload === null) return undefined
    if ('id' in payload && typeof payload.id === 'string') return payload.id
    return undefined
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
