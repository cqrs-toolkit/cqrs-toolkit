/**
 * Command queue implementation.
 * Handles command persistence, validation, retry, and status tracking.
 */

import { assert, calculateBackoffDelay, generateId, shouldRetry } from '#utils'
import { Err, type Link, logProvider, Ok, type Result } from '@meticoeus/ddd-es'
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
  CommandCompletionError,
  CommandEvent,
  CommandFilter,
  CommandRecord,
  CommandStatus,
  EnqueueAndWaitParams,
  EnqueueAndWaitResult,
  EnqueueCommand,
  EnqueueParams,
  EnqueueResult,
  TerminalCommandStatus,
  WaitOptions,
} from '../../types/commands.js'
import {
  CommandCancelledException,
  CommandFailedException,
  CommandNotFoundException,
  CommandTimeoutException,
  InvalidCommandStatusException,
  isCommandFailed,
  isTerminalStatus,
} from '../../types/commands.js'
import type { RetryConfig } from '../../types/config.js'
import type {
  DomainExecutionResult,
  HandlerContext,
  IDomainExecutor,
  ParentRefConfig,
} from '../../types/domain.js'
import { autoRevision, isAutoRevision } from '../../types/domain.js'
import { createEntityRef, EntityId, entityIdToString, EntityRef } from '../../types/entities.js'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import {
  extractTopLevelEntityRefs,
  resolveRefPaths,
  restoreEntityRefs,
  stripEntityRefs,
} from '../entity-ref/ref-path.js'
import type { ParsedEvent } from '../event-processor/EventProcessorRunner.js'
import type { EventBus } from '../events/EventBus.js'
import { WriteQueueException } from '../write-queue/IWriteQueue.js'
import type { ICommandFileStore } from './file-store/ICommandFileStore.js'
import type { ICommandQueueInternal, ICommandSender } from './types.js'

/**
 * Handler for anticipated event lifecycle.
 * CommandQueue hands off anticipated events at the right lifecycle points — the handler
 * implementation coordinates EventCache, CacheManager, EventProcessorRunner, and collection routing.
 */
export interface IAnticipatedEventHandler {
  /**
   * Cache anticipated events in EventCache and send through event processor pipeline.
   */
  cache(params: {
    /** Command that produced these events */
    commandId: string
    /** Anticipated events to cache */
    events: IAnticipatedEvent[]
    /**
     * For creates with temporary ID: the client-generated entity ID.
     * When provided, sets `_clientMetadata` on the created read model entries so the
     * original ID can be tracked through server ID reconciliation.
     */
    clientId?: string
    /** Cache key string for associating anticipated events with the correct data scope. */
    cacheKey: string
  }): Promise<Result<void, WriteQueueException>>
  /** Clean up anticipated events when command reaches terminal state. Clears local changes for tracked entries. */
  cleanup(commandId: string, terminalStatus: TerminalCommandStatus): Promise<void>
  /** Replace anticipated events for a command (used when data is rewritten after a dependency succeeds). */
  regenerate(commandId: string, newEvents: unknown[], cacheKey: string): Promise<void>
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
export interface CommandQueueConfig<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> {
  domainExecutor?: IDomainExecutor<TLink, TCommand, TSchema, TEvent>
  commandSender?: ICommandSender<TLink, TCommand>
  retryConfig?: RetryConfig
  defaultService?: string
  onCommandResponse?: (command: CommandRecord<TLink, TCommand>, response: unknown) => Promise<void>
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
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> implements ICommandQueueInternal<TLink, TCommand> {
  private readonly domainExecutor?: IDomainExecutor<TLink, TCommand, TSchema, TEvent>
  private readonly commandSender?: ICommandSender<TLink, TCommand>
  private readonly retryConfig: RetryConfig
  private readonly defaultService: string
  private readonly onCommandResponse?: (
    command: CommandRecord<TLink, TCommand>,
    response: unknown,
  ) => Promise<void>
  private readonly retainTerminal: boolean
  private readonly commandIdMappingTtl: number

  /** CacheManager reference for cache key reconciliation. Set via setCacheManager(). */
  private cacheManager: ICacheManagerInternal<TLink> | undefined

  protected readonly commandEvents = new Subject<CommandEvent>()
  private readonly destroy$ = new Subject<void>()

  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>()

  /**
   * In-memory tracking of command chains per aggregate.
   * Key is the aggregate ID (client-generated for creates, data.id for mutates).
   */
  private readonly aggregateChains = new Map<string, AggregateChain>()

  /** In-memory clientId → serverId mappings for synchronous lookup by CacheManager. */
  private readonly resolvedIdMappings = new Map<string, string>()

  private lastMappingCleanup = 0
  private _paused = true
  private processingPromise: Promise<void> | undefined
  private _pendingReprocess = false

  readonly events$: Observable<CommandEvent>

  constructor(
    private readonly storage: IStorage<TLink, TCommand>,
    private readonly eventBus: EventBus<TLink>,
    /** File store for commands with file attachments. */
    private readonly fileStore: ICommandFileStore,
    private readonly anticipatedEventHandler: IAnticipatedEventHandler,
    config: CommandQueueConfig<TLink, TCommand, TSchema, TEvent> = {},
  ) {
    this.domainExecutor = config.domainExecutor
    this.commandSender = config.commandSender
    this.retryConfig = config.retryConfig ?? {}
    this.defaultService = config.defaultService ?? 'default'
    this.onCommandResponse = config.onCommandResponse
    this.retainTerminal = config.retainTerminal ?? false
    this.commandIdMappingTtl = config.commandIdMappingTtl ?? DEFAULT_COMMAND_ID_MAPPING_TTL

    this.events$ = this.commandEvents.asObservable().pipe(share(), takeUntil(this.destroy$))
  }

  /**
   * Set the CacheManager reference for cache key reconciliation.
   * Called after construction by the orchestrator to break the circular dependency.
   */
  setCacheManager(cacheManager: ICacheManagerInternal<TLink>): void {
    this.cacheManager = cacheManager
  }

  async enqueue<TData, TEvent extends IAnticipatedEvent>(
    params: EnqueueParams<TLink, TData>,
    modelState?: unknown | undefined,
  ): Promise<EnqueueResult<TEvent>> {
    const { command, cacheKey, skipValidation } = params
    const commandId = params.commandId ?? generateId()
    const now = Date.now()

    // Look up handler registration metadata (creates, revisionField)
    const registration = this.domainExecutor?.getRegistration(command.type)

    // Patch stale client IDs from the ID mapping cache (race condition fix).
    // This corrects payloads where the UI component still had a client-generated ID
    // because the server's response hadn't propagated to the reactive layer yet.
    const patchedCommand = await this.patchFromIdMappingCache(command, registration)

    // Extract EntityRef values from command data. Default: scan top-level fields.
    // If the registration declares entityRefPaths, also resolve those patterns.
    const entityRefData = extractEntityRefsFromCommand(
      patchedCommand.data,
      registration?.entityRefPaths,
    )
    const hasEntityRefs = Object.keys(entityRefData).length > 0
    const strippedCommand = hasEntityRefs
      ? { ...patchedCommand, data: stripEntityRefs(patchedCommand.data, entityRefData) }
      : patchedCommand

    // Run domain validation if executor is available and not skipped
    let anticipatedEvents: TEvent[] = []
    let postProcess: CommandRecord<TLink, TCommand>['postProcess']

    if (this.domainExecutor && !skipValidation) {
      // 1. Validate with stripped data (plain strings)
      const validationResult = await this.domainExecutor.validate(strippedCommand, modelState)
      if (!validationResult.ok) {
        return Err(validationResult.error)
      }

      // 2. Re-inject EntityRef into validated/hydrated data
      const hydratedData = validationResult.value
      const enrichedData = hasEntityRefs
        ? restoreEntityRefs(hydratedData, entityRefData)
        : hydratedData

      // 3. Handler produces anticipated events with EntityRef in parent fields
      const initialContext: HandlerContext = {
        phase: 'initializing',
        commandId,
        idStrategy: registration?.creates?.idStrategy,
      }
      // Trust boundary: the consumer-provided domainExecutor is expected to produce
      // TEvent-compatible anticipated events. TypeScript cannot verify this without
      // making CommandQueue generic in TEvent, which would propagate through the
      // entire client factory.
      const handleResult = this.domainExecutor.handle(
        { ...strippedCommand, data: enrichedData },
        modelState,
        initialContext,
      ) as DomainExecutionResult<TEvent>

      if (!handleResult.ok) {
        return Err(handleResult.error)
      }

      anticipatedEvents = handleResult.value.anticipatedEvents
      postProcess = handleResult.value.postProcessPlan
    }

    // Detect aggregate and build auto-dependencies
    const explicitDeps = command.dependsOn ?? []
    const autoDeps = this.detectAggregateDependencies(
      commandId,
      strippedCommand.type,
      strippedCommand.data,
      anticipatedEvents,
      registration,
    )

    // Auto-derive dependencies from EntityRef commandIds
    const refCommandIds: string[] = []
    for (const ref of Object.values(entityRefData)) {
      if (!refCommandIds.includes(ref.commandId)) {
        refCommandIds.push(ref.commandId)
      }
    }

    const allDeps = [...new Set([...explicitDeps, ...autoDeps, ...refCommandIds])]

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

    // Store attached files and build fileRefs metadata.
    // In worker modes, the proxy writes files to OPFS and passes pre-built fileRefs.
    // In online-only mode, files arrive directly and are stored here.
    let fileRefs: CommandRecord<TLink, TCommand>['fileRefs'] = params.fileRefs
    if (!fileRefs && command.files && command.files.length > 0) {
      fileRefs = []
      for (const file of command.files) {
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
    }

    // Create command record
    const record: CommandRecord<TLink, TCommand> = {
      commandId,
      cacheKey,
      service: command.service ?? this.defaultService,
      type: command.type,
      data: strippedCommand.data,
      path: command.path,
      status: initialStatus,
      dependsOn: allDeps,
      blockedBy,
      attempts: 0,
      postProcess,
      creates: registration?.creates,
      revision: strippedCommand.revision,
      fileRefs,
      entityRefData: hasEntityRefs ? entityRefData : undefined,
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
        await this.anticipatedEventHandler.cache({
          commandId,
          events: anticipatedEvents,
          clientId,
          cacheKey: cacheKey.key, // string for EventCache and ReadModelStore
        })
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
    this.eventBus.emit('command:enqueued', {
      commandId,
      type: command.type,
      cacheKey,
    })

    // Trigger processing for the newly enqueued command
    if (!this._paused && initialStatus === 'pending') {
      this.processPendingCommands().catch((err) => {
        logProvider.log.error({ err }, 'Failed to process pending commands')
      })
    }

    // Build EntityRef for create commands so the consumer has the created entity reference
    let entityRef: EntityRef | undefined
    if (registration?.creates) {
      const createdEntityId = this.extractAggregateIdFromEvents(
        anticipatedEvents,
        registration.creates.eventType,
      )
      if (typeof createdEntityId === 'string') {
        entityRef = createEntityRef(createdEntityId, commandId, registration.creates.idStrategy)
      }
    }

    return Ok({ commandId, anticipatedEvents, entityRef })
  }

  async waitForCompletion(
    commandId: string,
    options?: WaitOptions,
  ): Promise<Result<unknown, CommandCompletionError>> {
    const timeout = options?.timeout ?? DEFAULT_WAIT_TIMEOUT

    // Check if command is already in terminal state
    const command = await this.storage.getCommand(commandId)
    if (!command) {
      return Err(new CommandFailedException('local', `Command not found: ${commandId}`))
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
      map((): Result<unknown, CommandCompletionError> => Err(new CommandTimeoutException())),
    )

    return firstValueFrom(race(terminalEvent$, timeout$))
  }

  async enqueueAndWait<TData, TEvent extends IAnticipatedEvent, TResponse>(
    params: EnqueueAndWaitParams<TLink, TData>,
    modelState?: unknown | undefined,
  ): Promise<EnqueueAndWaitResult<TResponse>> {
    const enqueueResult = await this.enqueue<TData, TEvent>(params, modelState)

    if (!enqueueResult.ok) {
      return Err(enqueueResult.error)
    }

    const completionResult = await this.waitForCompletion(enqueueResult.value.commandId, params)

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
    return this.storage.getCommand(commandId)
  }

  async listCommands(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]> {
    return this.storage.getCommands(filter)
  }

  async cancelCommand(
    commandId: string,
  ): Promise<Result<void, CommandNotFoundException | InvalidCommandStatusException>> {
    const command = await this.storage.getCommand(commandId)
    if (!command) {
      return Err(new CommandNotFoundException(commandId))
    }

    if (command.status === 'sending') {
      return Err(
        new InvalidCommandStatusException(
          'Cannot cancel command that is currently sending',
          command.status,
        ),
      )
    }

    if (isTerminalStatus(command.status)) {
      return Err(
        new InvalidCommandStatusException(
          `Cannot cancel command in status: ${command.status}`,
          command.status,
        ),
      )
    }

    await this.updateCommandStatus(command, 'cancelled')
    return Ok()
  }

  async retryCommand(
    commandId: string,
  ): Promise<Result<void, CommandNotFoundException | InvalidCommandStatusException>> {
    const command = await this.storage.getCommand(commandId)
    if (!command) {
      return Err(new CommandNotFoundException(commandId))
    }

    if (command.status !== 'failed') {
      return Err(
        new InvalidCommandStatusException(
          `Can only retry failed commands, current status: ${command.status}`,
          command.status,
        ),
      )
    }

    await this.updateCommandStatus(command, 'pending', { error: undefined })
    return Ok()
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

  private async processCommand(command: CommandRecord<TLink, TCommand>): Promise<void> {
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

    // Hydrate file data from file store before sending
    if (sendCommand.fileRefs) {
      for (const ref of sendCommand.fileRefs) {
        ref.data = await this.fileStore.read(sendCommand.commandId, ref.id)
      }
    }

    const result = await this.commandSender.send(sendCommand)

    // Clear hydrated file data — it's transient for the send operation only.
    // Blobs must not leak into event broadcasts or storage updates.
    if (sendCommand.fileRefs) {
      for (const ref of sendCommand.fileRefs) {
        ref.data = undefined
      }
    }

    if (result.ok) {
      const response = result.value

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

        // Resolve pending cache keys that depend on this command's ID mapping.
        // The CacheManager's resolvePendingKeys updates identity fields in-place
        // and emits cache:key-reconciled events.
        if (this.cacheManager) {
          const registration = this.domainExecutor?.getRegistration(succeededCommand.type)
          const boundResolver = registration?.resolveCacheKey
            ? (cacheKey: CacheKeyIdentity<TLink>) =>
                registration.resolveCacheKey!({
                  commandId: succeededCommand.commandId,
                  type: succeededCommand.type,
                  data: succeededCommand.data,
                  serverResponse: succeededCommand.serverResponse,
                  cacheKey,
                })
            : undefined
          this.cacheManager.resolvePendingKeys(succeededCommand.commandId, idMap, boundResolver)
        }
      }

      // Unblock direct dependents and resolve revision for the next command in chain
      await this.unblockDependentCommands(succeededCommand)

      this.eventBus.emit('command:completed', {
        commandId: current.commandId,
        type: current.type,
        cacheKey: current.cacheKey,
      })
    } else {
      const exception = result.error
      const error = new CommandFailedException('server', exception.message, {
        errorCode: exception.errorCode,
        details: exception.details,
      })

      const canRetry =
        exception.isRetryable && shouldRetry(updatedCommand.attempts, this.retryConfig)

      if (canRetry) {
        // Back to pending for retry
        await this.updateCommandStatus(updatedCommand, 'pending', { error })

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
        await this.updateCommandStatus(updatedCommand, 'failed', { error })

        // Cancel dependent commands
        await this.cancelDependentCommands(current.commandId)

        this.eventBus.emit('command:failed', {
          commandId: current.commandId,
          type: current.type,
          error: error.message,
          cacheKey: current.cacheKey,
        })
      }
    }
  }

  private async unblockDependentCommands(
    parentCommand: CommandRecord<TLink, TCommand>,
  ): Promise<void> {
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

      const registration = this.domainExecutor?.getRegistration(command.type)
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

      // Remove resolved EntityRef entries from entityRefData.
      // When a parent command completes and its ID is rewritten, the corresponding
      // entityRefData entry is no longer pending — remove it so regenerated
      // anticipated events don't re-inject an EntityRef for the resolved field.
      let updatedEntityRefData = command.entityRefData
      if (updatedEntityRefData && changed) {
        const pruned: Record<string, EntityRef> = {}
        for (const [path, ref] of Object.entries(updatedEntityRefData)) {
          if (!(ref.entityId in idMap)) {
            pruned[path] = ref
          }
        }
        updatedEntityRefData = Object.keys(pruned).length > 0 ? pruned : undefined
      }

      if (changed) {
        await this.storage.updateCommand(command.commandId, {
          data,
          entityRefData: updatedEntityRefData,
        })

        // Regenerate anticipated events with the correct server ID
        if (this.domainExecutor) {
          const context = this.buildUpdatingContext(command, data)
          const enrichedData = updatedEntityRefData
            ? restoreEntityRefs(data, updatedEntityRefData)
            : data
          const result = this.domainExecutor.handle(
            { type: command.type, data: enrichedData, path: command.path },
            // TODO: this should be getting updated local model from the caller
            // modelState,
            undefined,
            context,
          )
          if (result.ok) {
            try {
              await this.anticipatedEventHandler.regenerate(
                command.commandId,
                result.value.anticipatedEvents as unknown[],
                command.cacheKey.key,
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
  private async reconcileCreateIds(
    command: CommandRecord<TLink, TCommand>,
  ): Promise<Record<string, IdMapEntry>> {
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

        // Track in-memory for synchronous lookup by CacheManager
        this.resolvedIdMappings.set(clientId, serverId)

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
  private extractRevisionFromResponse(command: CommandRecord<TLink, TCommand>): string | undefined {
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
    command: CommandRecord<TLink, TCommand>,
    parentRevision: string | undefined,
  ): Promise<void> {
    if (command.revision === undefined || parentRevision === undefined) return
    if (!isAutoRevision(command.revision)) return

    // Update the command record with the resolved revision
    await this.storage.updateCommand(command.commandId, { revision: parentRevision })

    // Re-run the handler to produce fresh anticipated events with correct IDs
    if (this.domainExecutor) {
      const data = command.data as Record<string, unknown>
      const context = this.buildUpdatingContext(command, data)
      const enrichedData = command.entityRefData
        ? restoreEntityRefs(data, command.entityRefData)
        : data
      const result = this.domainExecutor.handle(
        { type: command.type, data: enrichedData, path: command.path },
        // TODO: this should be getting updated local model from the caller
        // modelState,
        undefined,
        context,
      )
      if (result.ok) {
        try {
          await this.anticipatedEventHandler.regenerate(
            command.commandId,
            result.value.anticipatedEvents as unknown[],
            command.cacheKey.key,
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
          error: new CommandFailedException('local', `Dependency ${commandId} failed`),
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
          creates?: CommandRecord<TLink, TCommand>['creates']
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
  private resolveAutoRevisionForSend(
    command: CommandRecord<TLink, TCommand>,
  ): CommandRecord<TLink, TCommand> {
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
    registration: { creates?: CommandRecord<TLink, TCommand>['creates'] } | undefined,
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
    command: CommandRecord<TLink, TCommand>,
    data: Record<string, unknown>,
  ): HandlerContext {
    const entityId = command.creates
      ? this.getOriginalCreateId(command.commandId)
      : (data.id as string | undefined)
    assert(typeof entityId === 'string', 'Cannot build updating context without entity ID')
    return {
      phase: 'updating',
      entityId,
      commandId: command.commandId,
      idStrategy: command.creates?.idStrategy,
    }
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
    command: CommandRecord<TLink, TCommand>,
    newStatus: CommandStatus,
    additionalUpdates?: Partial<CommandRecord<TLink, TCommand>>,
  ): Promise<CommandRecord<TLink, TCommand>> {
    const previousStatus = command.status
    const updates: Partial<CommandRecord<TLink, TCommand>> = {
      status: newStatus,
      updatedAt: Date.now(),
      ...additionalUpdates,
    }

    await this.storage.updateCommand(command.commandId, updates)

    // Clean up anticipated events and files when command reaches terminal state
    if (isTerminalStatus(newStatus)) {
      try {
        await this.anticipatedEventHandler.cleanup(command.commandId, newStatus)
      } catch (err) {
        logProvider.log.error(
          { err, commandId: command.commandId },
          'Failed to clean up anticipated events',
        )
      }
      if (command.fileRefs) {
        try {
          await this.fileStore.deleteForCommand(command.commandId)
        } catch (err) {
          logProvider.log.error(
            { err, commandId: command.commandId },
            'Failed to clean up command files',
          )
        }
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
        cacheKey: command.cacheKey,
      })
    }

    return updatedCommand
  }

  private emitCommandEvent(
    eventType: CommandEvent['eventType'],
    command: CommandRecord<TLink, TCommand>,
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

  private toCompletionResult(
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

  private eventToCompletionResult(event: CommandEvent): Result<unknown, CommandCompletionError> {
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

  /**
   * Clear all command state for session destroy.
   * Pauses, clears retry timers, waits for in-flight, clears anticipated event tracking, deletes all commands.
   */
  async clearAll(): Promise<void> {
    await this.reset()
    await this.anticipatedEventHandler.clearAll()
    await this.fileStore.clear()
    await this.storage.deleteAllCommands()
    await this.storage.deleteAllCommandIdMappings()
    this.aggregateChains.clear()
    this.resolvedIdMappings.clear()
    logProvider.log.debug('Command queue cleared')
  }

  getIdMapping(clientId: EntityId): { serverId: string } | undefined {
    const serverId = this.resolvedIdMappings.get(entityIdToString(clientId))
    if (!serverId) return undefined
    return { serverId }
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

/**
 * Extract EntityRef values from command data.
 *
 * Always scans top-level fields. If entityRefPaths are declared on the
 * handler registration, also resolves those patterns against the data.
 *
 * Returns a Record<string, EntityRef> where keys are JSONPath expressions.
 */
function extractEntityRefsFromCommand(
  data: unknown,
  entityRefPaths?: string[],
): Record<string, EntityRef> {
  const topLevel = extractTopLevelEntityRefs(data)

  if (!entityRefPaths || entityRefPaths.length === 0) {
    return topLevel
  }

  const declared = resolveRefPaths(data, entityRefPaths)
  return { ...topLevel, ...declared }
}
