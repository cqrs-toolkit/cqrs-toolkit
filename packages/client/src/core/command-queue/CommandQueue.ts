/**
 * Command queue implementation.
 * Handles command persistence, validation, retry, and status tracking.
 */

import { Err, type Link, logProvider, Ok } from '@meticoeus/ddd-es'
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
  HandlerContext,
  ICommandHandlerMetadata,
  IDomainExecutor,
  ParentRefConfig,
} from '../../types/domain.js'
import { autoRevision, isAutoRevision } from '../../types/domain.js'
import type { ValidationError } from '../../types/validation.js'
import { assert } from '../../utils/assert.js'
import { calculateBackoffDelay, shouldRetry } from '../../utils/retry.js'
import { generateId } from '../../utils/uuid.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type { ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import type { EventBus } from '../events/EventBus.js'
import type { ICommandQueue, ICommandSender } from './types.js'
import { CommandSendError } from './types.js'

/**
 * Handler for anticipated event lifecycle.
 * CommandQueue hands off anticipated events at the right lifecycle points — the handler
 * implementation coordinates EventCache, CacheManager, EventProcessorRunner, and collection routing.
 */
export interface IAnticipatedEventHandler {
  /**
   * Cache anticipated events in EventCache and send through event processor pipeline.
   *
   * @param commandId - Command that produced these events
   * @param events - Anticipated events to cache
   * @param clientId - For creates with temporary ID: the client-generated entity ID.
   *   When provided, sets `_clientMetadata` on the created read model entries so the
   *   original ID can be tracked through server ID reconciliation.
   */
  cache(commandId: string, events: unknown[], clientId?: string): Promise<void>
  /** Clean up anticipated events when command reaches terminal state. Clears local changes for tracked entries. */
  cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void>
  /** Replace anticipated events for a command (used when data is rewritten after a dependency succeeds). */
  regenerate(commandId: string, newEvents: unknown[]): Promise<void>
  /** Get tracked read model entries for a command (e.g., ["todos:client-abc"]). */
  getTrackedEntries(commandId: string): string[] | undefined
  /** Get anticipated events for a stream, excluding a specific command's events. For re-applying overlays during reconciliation. */
  getAnticipatedEventsForStream(streamId: string, excludeCommandId: string): Promise<ParsedEvent[]>
  /** Clear all tracking state (in-memory only — storage cleanup handled by session cascade). */
  clearAll(): Promise<void>
}

/**
 * Command queue configuration.
 */
export interface CommandQueueConfig<TLink extends Link, TSchema, TEvent extends IAnticipatedEvent> {
  storage: IStorage
  eventBus: EventBus
  anticipatedEventHandler: IAnticipatedEventHandler
  domainExecutor?: IDomainExecutor
  /** Metadata lookup for command handler registrations (creates config). */
  handlerMetadata?: ICommandHandlerMetadata<TLink, TSchema, TEvent>
  commandSender?: ICommandSender
  retryConfig?: RetryConfig
  defaultService?: string
  onCommandResponse?: (command: CommandRecord, response: unknown) => Promise<void>
  /** When true, terminal commands are retained in storage instead of being cleaned up. */
  retainTerminal?: boolean
  /** TTL for command ID mappings in milliseconds. Default: 5 minutes. */
  commandIdMappingTtl?: number
}

/**
 * Default wait timeout in milliseconds.
 */
const DEFAULT_WAIT_TIMEOUT = 30000

/** Default TTL for command ID mappings: 5 minutes. */
const DEFAULT_COMMAND_ID_MAPPING_TTL = 5 * 60 * 1000

/** Minimum interval between TTL cleanup runs: 1 hour. */
const MAPPING_CLEANUP_INTERVAL = 60 * 60 * 1000

/**
 * Command queue implementation.
 */
/**
 * Entry in the ID map produced when a create command with temporary ID succeeds.
 */
interface IdMapEntry {
  serverId: string
  /** The command type that produced this ID (e.g., 'CreateFolder'). Used for parentRef verification. */
  commandType: string
}

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

export class CommandQueue<
  TLink extends Link,
  TSchema,
  TEvent extends IAnticipatedEvent,
> implements ICommandQueue {
  private readonly storage: IStorage
  private readonly eventBus: EventBus
  private readonly anticipatedEventHandler: IAnticipatedEventHandler
  private readonly domainExecutor?: IDomainExecutor
  private readonly handlerMetadata?: ICommandHandlerMetadata<TLink, TSchema, TEvent>
  private readonly commandSender?: ICommandSender
  private readonly retryConfig: RetryConfig
  private readonly defaultService: string
  private readonly onCommandResponse?: (command: CommandRecord, response: unknown) => Promise<void>
  private readonly retainTerminal: boolean
  private readonly commandIdMappingTtl: number

  private readonly commandEvents = new Subject<CommandEvent>()
  private readonly destroy$ = new Subject<void>()

  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>()

  /**
   * In-memory tracking of command chains per aggregate.
   * Key is the aggregate ID (client-generated for creates, data.id for mutates).
   */
  private readonly aggregateChains = new Map<string, AggregateChain>()

  private lastMappingCleanup = 0
  private _paused = true
  private processingPromise: Promise<void> | undefined
  private _pendingReprocess = false

  readonly events$: Observable<CommandEvent>

  constructor(config: CommandQueueConfig<TLink, TSchema, TEvent>) {
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
    this.commandIdMappingTtl = config.commandIdMappingTtl ?? DEFAULT_COMMAND_ID_MAPPING_TTL

    this.events$ = this.commandEvents.asObservable().pipe(share(), takeUntil(this.destroy$))
  }

  async enqueue<TData, TEvent>(
    command: EnqueueCommand<TData>,
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
      const initialContext: HandlerContext = { phase: 'initializing', path: command.path }
      const result = (await this.domainExecutor.execute(
        patchedCommand,
        initialContext,
      )) as DomainExecutionResult<TEvent>

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
      patchedCommand.data,
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
    const record: CommandRecord<TData> = {
      commandId,
      service: command.service ?? this.defaultService,
      type: command.type,
      data: patchedCommand.data,
      path: command.path,
      status: initialStatus,
      dependsOn: allDeps,
      blockedBy,
      attempts: 0,
      postProcess,
      creates: registration?.creates,
      revision: patchedCommand.revision,
      createdAt: now,
      updatedAt: now,
    }

    // Save command
    await this.storage.saveCommand(record)

    // Cache anticipated events for optimistic updates
    if (anticipatedEvents.length > 0) {
      // For creates with temporary IDs, pass the client-generated entity ID so
      // _clientMetadata can be set on the read model entry for identity tracking.
      const clientId =
        registration?.creates?.idStrategy === 'temporary'
          ? this.extractAggregateIdFromEvents(anticipatedEvents, registration.creates.eventType)
          : undefined

      try {
        await this.anticipatedEventHandler.cache(commandId, anticipatedEvents, clientId)
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

  async enqueueAndWait<TData, TEvent, TResponse>(
    command: EnqueueCommand<TData>,
    options?: EnqueueAndWaitOptions,
  ): Promise<EnqueueAndWaitResult<TResponse>> {
    const enqueueResult = await this.enqueue<TData, TEvent>(command, options)

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
      data: current.data,
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
        await this.rewriteCommandsWithStaleIds(idMap)
      }

      // Unblock direct dependents and resolve revision for the next command in chain
      await this.unblockDependentCommands(succeededCommand)

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

  private async unblockDependentCommands(parentCommand: CommandRecord): Promise<void> {
    const blockedCommands = await this.storage.getCommandsBlockedBy(parentCommand.commandId)
    if (blockedCommands.length === 0) return

    // Extract the latest revision from the parent's response for AUTO_REVISION resolution
    const parentRevision = this.extractRevisionFromResponse(parentCommand)

    for (const blocked of blockedCommands) {
      const newBlockedBy = blocked.blockedBy.filter((id) => id !== parentCommand.commandId)

      // Resolve AUTO_REVISION with the parent's revision
      // (ID replacement is already handled by rewriteCommandsWithStaleIds)
      await this.resolveDependentRevision(blocked, parentRevision)

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
   * Rewrite stale client IDs in all non-terminal commands using targeted field-level replacement.
   *
   * Same-aggregate: replaces `data.id` if it matches a client ID in the map.
   * Cross-aggregate: replaces `parentRef` fields, verified against `fromCommand`.
   *
   * Called when a create with temporary ID succeeds — cascades the server ID to
   * all affected commands regardless of dependency depth. Only rewrites IDs, not revision.
   */
  private async rewriteCommandsWithStaleIds(idMap: Record<string, IdMapEntry>): Promise<void> {
    const allCommands = await this.storage.getCommandsByStatus(['pending', 'blocked', 'sending'])

    for (const command of allCommands) {
      if (typeof command.data !== 'object' || command.data === null) continue

      const registration = this.handlerMetadata?.getRegistration(command.type)
      const data = { ...(command.data as Record<string, unknown>) }
      let changed = false

      // Same-aggregate: replace data.id if it matches a stale client ID
      if (!registration?.creates && typeof data.id === 'string') {
        const entry = idMap[data.id]
        if (entry !== undefined) {
          data.id = entry.serverId
          changed = true
        }
      }

      // Cross-aggregate: replace parentRef fields, verified against fromCommand
      if (registration?.parentRef) {
        for (const ref of registration.parentRef) {
          const fieldValue = data[ref.field]
          if (typeof fieldValue !== 'string') continue

          const entry = idMap[fieldValue]
          if (entry === undefined) continue
          if (entry.commandType !== ref.fromCommand) continue

          data[ref.field] = entry.serverId
          changed = true
        }
      }

      if (changed) {
        await this.storage.updateCommand(command.commandId, { data })

        // Regenerate anticipated events with the correct server ID
        if (this.domainExecutor) {
          const context = this.buildUpdatingContext(command, data)
          const result = await this.domainExecutor.execute({ type: command.type, data }, context)
          if (result.ok) {
            try {
              await this.anticipatedEventHandler.regenerate(
                command.commandId,
                result.value.anticipatedEvents as unknown[],
              )
            } catch (err) {
              logProvider.log.error(
                { err, commandId: command.commandId },
                'Failed to regenerate anticipated events during stale ID rewrite',
              )
            }
          }
        }
      }
    }
  }

  /**
   * Clean up stale ID mappings. Runs on session start and at most once per hour.
   */
  private async cleanupStaleMappings(): Promise<void> {
    const now = Date.now()
    if (now - this.lastMappingCleanup < MAPPING_CLEANUP_INTERVAL) return
    this.lastMappingCleanup = now
    await this.storage.deleteCommandIdMappingsOlderThan(now - this.commandIdMappingTtl)
  }

  /**
   * Reconcile create command IDs: build the clientId→serverId map, update aggregate chains,
   * and persist the mapping for race condition handling.
   *
   * Called unconditionally when any command succeeds. Returns a non-empty map only for
   * create commands with temporary IDs.
   */
  private async reconcileCreateIds(command: CommandRecord): Promise<Record<string, IdMapEntry>> {
    const map: Record<string, IdMapEntry> = {}
    if (!command.creates || command.creates.idStrategy !== 'temporary') return map
    if (!command.serverResponse) return map

    const serverId = this.readResponseField(command.serverResponse, 'id')
    if (!serverId) return map

    const revision = this.readResponseField(command.serverResponse, 'nextExpectedRevision')

    // Find the client temp ID from the aggregate chain tracking
    for (const [clientId, chain] of this.aggregateChains) {
      if (chain.createCommandId === command.commandId && clientId !== serverId) {
        map[clientId] = { serverId, commandType: command.type }

        // Update the chain to use the server ID
        this.aggregateChains.delete(clientId)
        this.aggregateChains.set(serverId, {
          ...chain,
          createCommandId: undefined, // No longer a pending create
        })

        // Persist the mapping for race condition handling.
        // When the UI still has stale client IDs or stale revisions,
        // future enqueue calls will find this mapping and patch the data silently.
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
   * Resolve AUTO_REVISION in a dependent command after its dependency succeeded.
   * ID replacement is handled by rewriteCommandsWithStaleIds — this only handles revision.
   */
  private async resolveDependentRevision(
    command: CommandRecord,
    parentRevision: string | undefined,
  ): Promise<void> {
    if (command.revision === undefined || parentRevision === undefined) return
    if (!isAutoRevision(command.revision)) return

    // Update the command record with the resolved revision
    await this.storage.updateCommand(command.commandId, { revision: parentRevision })

    // Re-run the domain executor to produce fresh anticipated events with correct IDs
    if (this.domainExecutor) {
      const data = command.data as Record<string, unknown>
      const context = this.buildUpdatingContext(command, data)
      const result = await this.domainExecutor.execute(
        { type: command.type, data: command.data },
        context,
      )
      if (result.ok) {
        try {
          await this.anticipatedEventHandler.regenerate(
            command.commandId,
            result.value.anticipatedEvents as unknown[],
          )
        } catch (err) {
          logProvider.log.error(
            { err, commandId: command.commandId },
            'Failed to regenerate anticipated events after data rewrite',
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
   * Patch a command's data using the ID mapping cache.
   *
   * Handles three cases:
   * 1. data.id is a stale client ID → replace with server ID + patch revision (same-aggregate)
   * 2. data.id is the correct server ID but revision is stale → patch revision only
   * 3. data[parentRef.field] is a stale parent client ID → replace with server ID (cross-aggregate)
   */
  private async patchFromIdMappingCache<TData>(
    command: EnqueueCommand<TData>,
    registration:
      | {
          creates?: CommandRecord['creates']
          parentRef?: ParentRefConfig[]
        }
      | undefined,
  ): Promise<EnqueueCommand<TData>> {
    if (typeof command.data !== 'object' || command.data === null) return command

    let patchedPayload = command.data
    let patchedRevision = command.revision
    let changed = false

    // Same-aggregate: check data.id (only for mutate commands, not creates)
    if (!registration?.creates) {
      const payloadId = this.extractPayloadId(command.data)
      if (typeof payloadId === 'string') {
        const result = await this.patchIdField(patchedPayload, payloadId)
        if (result !== undefined) {
          patchedPayload = result.data
          changed = true

          // Patch autoRevision fallback if the revision is undefined/stale
          if (
            isAutoRevision(patchedRevision) &&
            patchedRevision.fallback === undefined &&
            result.revision !== undefined
          ) {
            patchedRevision = autoRevision(result.revision)
          }
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

    return changed ? { ...command, data: patchedPayload, revision: patchedRevision } : command
  }

  /**
   * Try to patch data.id from the mapping cache (same-aggregate).
   * Returns the patched data and the mapping's revision if a mapping was found, undefined otherwise.
   */
  private async patchIdField<TData>(
    data: TData,
    payloadId: string,
  ): Promise<{ data: TData; revision: string | undefined } | undefined> {
    // Try lookup by client ID first, then by server ID
    const byClientId = await this.storage.getCommandIdMapping(payloadId)
    const byServerId =
      byClientId === undefined
        ? await this.storage.getCommandIdMappingByServerId(payloadId)
        : undefined
    const mapping = byClientId ?? byServerId
    if (mapping === undefined) return undefined

    const mappingData = JSON.parse(mapping.data) as { revision?: string }
    let patchedPayload = data

    // Case 1: data has stale client ID → replace with server ID
    if (byClientId !== undefined) {
      let payloadJson = JSON.stringify(data)
      payloadJson = payloadJson.replaceAll(payloadId, mapping.serverId)
      patchedPayload = JSON.parse(payloadJson) as TData

      logProvider.log.debug(
        { clientId: payloadId, serverId: mapping.serverId },
        'Patched stale client ID from mapping cache',
      )
    }

    return { data: patchedPayload, revision: mappingData.revision }
  }

  /**
   * Resolve AUTO_REVISION marker in a command's revision before sending to the server.
   * Returns a new command record with the resolved revision (or the original if no resolution needed).
   */
  private resolveAutoRevisionForSend(command: CommandRecord): CommandRecord {
    if (!isAutoRevision(command.revision)) return command

    // Use the fallback revision from the marker (the read model revision the consumer passed)
    return { ...command, revision: command.revision.fallback }
  }

  /**
   * Detect same-aggregate dependencies and update the aggregate chain tracker.
   *
   * For create commands: extract the aggregate ID from anticipated events and start a new chain.
   * For mutate commands: read data.id and chain after the latest command on that aggregate.
   *
   * @returns Array of auto-generated dependency command IDs (may be empty).
   */
  private detectAggregateDependencies<TEvent>(
    commandId: string,
    commandType: string,
    data: unknown,
    anticipatedEvents: TEvent[],
    registration: { creates?: CommandRecord['creates'] } | undefined,
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
      // Mutate command: read data.id to find the aggregate
      const aggregateId = this.extractPayloadId(data)

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
   * Look up the original entity ID for a pending create command from the aggregate chain.
   * Returns the aggregate chain key where createCommandId matches.
   */
  private getOriginalCreateId(commandId: string): string | undefined {
    for (const [aggregateId, chain] of this.aggregateChains) {
      if (chain.createCommandId === commandId) return aggregateId
    }
    return undefined
  }

  /**
   * Build the HandlerContext for a re-execution (regeneration) of a command.
   * For create commands, the entity ID comes from the aggregate chain.
   * For mutate commands, the entity ID comes from data.id.
   */
  private buildUpdatingContext(
    command: CommandRecord,
    data: Record<string, unknown>,
  ): HandlerContext {
    const entityId = command.creates
      ? this.getOriginalCreateId(command.commandId)
      : (data.id as string | undefined)
    assert(typeof entityId === 'string', 'Cannot build updating context without entity ID')
    return { phase: 'updating', entityId, path: command.path }
  }

  /**
   * Extract the aggregate ID from a command data (ddd-es convention: always `id`).
   */
  private extractPayloadId(data: unknown): string | undefined {
    if (typeof data !== 'object' || data === null) return undefined
    if ('id' in data && typeof data.id === 'string') return data.id
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
      this.eventBus.emit('command:status-changed', {
        commandId: command.commandId,
        status: newStatus,
        previousStatus,
      })
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
    await this.storage.deleteAllCommandIdMappings()
    this.aggregateChains.clear()
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
    // Clean up stale ID mappings on session start
    this.cleanupStaleMappings().catch((err) => {
      logProvider.log.error({ err }, 'Failed to cleanup stale ID mappings on resume')
    })
    // Trigger processing
    this.processPendingCommands().catch((err) => {
      logProvider.log.error({ err }, 'Failed to process pending commands on resume')
    })
  }

  isPaused(): boolean {
    return this._paused
  }

  async getCommandEntities(commandId: string, collection?: string): Promise<string[]> {
    const tracked = this.anticipatedEventHandler.getTrackedEntries(commandId)
    if (!tracked) return []

    const ids: string[] = []
    for (const key of tracked) {
      const separatorIndex = key.indexOf(':')
      if (separatorIndex === -1) continue
      const entryCollection = key.substring(0, separatorIndex)
      const id = key.substring(separatorIndex + 1)
      if (collection === undefined || entryCollection === collection) {
        ids.push(id)
      }
    }
    return ids
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
