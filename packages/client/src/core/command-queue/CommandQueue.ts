/**
 * Command queue implementation.
 * Handles command persistence, validation, retry, and status tracking.
 */

import { assert, calculateBackoffDelay, generateId, shouldRetry } from '#utils'
import { Err, type Link, logProvider, Ok, type Result } from '@meticoeus/ddd-es'
import { filter, Observable, share, Subject, takeUntil } from 'rxjs'
import type { IStorage } from '../../storage/IStorage.js'
import {
  type AffectedAggregate,
  type AggregateConfig,
  type IClientAggregates,
  matchesAggregate,
  type ResponseIdReference,
} from '../../types/aggregates.js'
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
  WaitOptions,
} from '../../types/commands.js'
import {
  CommandFailedException,
  CommandNotFoundException,
  InvalidCommandStatusException,
  isTerminalStatus,
} from '../../types/commands.js'
import type { Collection, RetryConfig } from '../../types/config.js'
import type {
  CommandHandlerRegistration,
  DomainExecutionError,
  DomainExecutionResult,
  HandlerContext,
  IDomainExecutor,
  PostProcessPlan,
} from '../../types/domain.js'
import { autoRevision, isAutoRevision } from '../../types/domain.js'
import { createEntityRef, EntityId, entityIdToString, EntityRef } from '../../types/entities.js'
import type { JSONPathExpression } from '../../types/json-path.js'
import { Mutable } from '../../types/utils.js'
import { safeParseSerializeBigint } from '../../utils/bigint.js'
import type { CacheKeyIdentity } from '../cache-manager/CacheKey.js'
import type { ICacheManagerInternal } from '../cache-manager/types.js'
import type { ICommandIdMappingStore } from '../command-id-mapping-store/ICommandIdMappingStore.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import { IAnticipatedEventHandler } from '../command-lifecycle/IAnticipatedEventHandler.js'
import { hasResponseEvents } from '../command-lifecycle/ResponseEvent.js'
import type { ICommandStore } from '../command-store/ICommandStore.js'
import { extractPrimaryAggregateId } from '../entity-ref/extract-aggregate-id.js'
import { getAtPath, restoreEntityRefs, stripEntityRefs } from '../entity-ref/ref-path.js'
import { resolveCommandIds } from '../entity-ref/resolve-command-ids.js'
import type { RewriteIdEntry } from '../entity-ref/rewrite-command.js'
import { rewriteCommandWithIdMap } from '../entity-ref/rewrite-command.js'
import type { EventBus } from '../events/EventBus.js'
import type { EntityIdMigration, ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { AggregateChainRegistry } from './AggregateChainRegistry.js'
import type { ICommandFileStore } from './file-store/ICommandFileStore.js'
import { CommandSendException, ICommandQueueInternal, ICommandSender } from './types.js'
import { deriveAffectedAggregates } from './utils.js'
import { waitForTerminal } from './waitForTerminal.js'

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
}

/**
 * Command queue implementation.
 */
/**
 * Entry in the ID map produced when a create command with temporary ID succeeds.
 */
interface IdMapEntry<TLink extends Link> {
  serverId: string
  aggregate: AggregateConfig<TLink>
}

/**
 * Everything `enqueue` needs from the registration-driven preparation pipeline.
 *
 * In pass-through mode (no registration) all optimistic fields are empty or
 * undefined — the library has no config to populate them. Callers in that mode
 * are responsible for providing correct revisions and managing dependency order
 * themselves; aggregate chaining does not apply.
 */
interface PreparedCommand<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TData,
  TEvent extends IAnticipatedEvent,
> {
  preparedCommand: EnqueueCommand<TData>
  commandIdPaths: Record<JSONPathExpression, EntityRef> | undefined
  anticipatedEvents: TEvent[]
  postProcess: PostProcessPlan | undefined
  affectedAggregates: AffectedAggregate<TLink>[] | undefined
  autoDeps: string[]
  refCommandIds: string[]
  entityRef: EntityRef | undefined
  creates: CommandRecord<TLink, TCommand>['creates']
}

export interface AdvanceChainRevisionsUpdate {
  streamId: string
  revision: string
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

  protected readonly commandEvents = new Subject<CommandEvent>()
  private readonly destroy$ = new Subject<void>()

  private readonly retryTimers = new Set<ReturnType<typeof setTimeout>>()

  /**
   * In-memory tracking of command chains per aggregate stream.
   * Keyed by the aggregate's streamId (client and/or server); the registry
   * keeps both indices of a dual-indexed chain in sync.
   *
   * `protected` so test subclasses can introspect chain state after
   * {@link rebuildChains}; production access stays through this class's
   * own methods.
   */
  protected readonly chains = new AggregateChainRegistry()

  private _paused = true
  private processingPromise: Promise<void> | undefined
  private _pendingReprocess = false

  readonly events$: Observable<CommandEvent>

  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly storage: IStorage<TLink, TCommand>,
    private readonly cacheManager: ICacheManagerInternal<TLink>,
    /** File store for commands with file attachments. */
    private readonly fileStore: ICommandFileStore,
    private readonly anticipatedEventHandler: IAnticipatedEventHandler<TLink, TCommand>,
    private readonly collections: Collection<TLink>[],
    private readonly clientAggregates: IClientAggregates<TLink>,
    /** Read-model store — used by the success path to apply best-guess ID rewrites
     *  as local-changes overlays. Must not be used to touch `serverData`. */
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
    private readonly commandStore: ICommandStore<TLink, TCommand>,
    private readonly mappingStore: ICommandIdMappingStore,
    config: CommandQueueConfig<TLink, TCommand, TSchema, TEvent> = {},
  ) {
    this.domainExecutor = config.domainExecutor
    this.commandSender = config.commandSender
    this.retryConfig = config.retryConfig ?? {}
    this.defaultService = config.defaultService ?? 'default'
    this.onCommandResponse = config.onCommandResponse
    this.retainTerminal = config.retainTerminal ?? false

    this.events$ = this.commandEvents.asObservable().pipe(share(), takeUntil(this.destroy$))
  }

  /**
   * Restore in-memory state from storage.
   *
   * Rebuilds aggregate chains from persisted commands so AutoRevision resolution
   * and auto-dependency detection work from the first enqueue.
   * Must be awaited before the queue is resumed or any commands are enqueued.
   */
  async initialize(): Promise<void> {
    await this.rebuildChains()
  }

  async enqueue<TData, TEvent extends IAnticipatedEvent>(
    params: EnqueueParams<TLink, TData>,
  ): Promise<EnqueueResult<TEvent>> {
    const { command, cacheKey, skipValidation, modelState } = params
    const commandId = params.commandId ?? generateId()
    const now = Date.now()

    // Look up handler registration metadata (creates, revisionField)
    // We need to replace the TEvent generic here to the more specific type the caller provided.
    const registration = this.domainExecutor?.getRegistration(command.type) as
      | CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>
      | undefined

    // Build fileRefs from File objects before the handler call so handlers
    // can reference file metadata (filename, mimeType, etc.) for anticipated events.
    let fileRefs: CommandRecord<TLink, TCommand>['fileRefs'] = params.fileRefs
    if (!fileRefs && command.files && command.files.length > 0) {
      fileRefs = await Promise.all(
        command.files.map(async (file) => {
          const fileId = generateId()
          const storagePath = await this.fileStore.save(commandId, fileId, file)
          return {
            id: fileId,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            storagePath,
          }
        }),
      )
    }

    // Registration gates all client-side processing. Without one, the library has
    // no config for where ids live, which commands create aggregates, or how to
    // produce anticipated events — so commands are a pure pass-through to the
    // server. Aggregate chaining does not apply in this mode; callers are
    // responsible for providing correct revisions and dependency ordering.
    const prepared = registration
      ? await this.prepareCommandWithRegistration<TData, TEvent>(
          command,
          commandId,
          registration,
          skipValidation,
          modelState,
          fileRefs,
        )
      : Ok<PreparedCommand<TLink, TCommand, TData, TEvent>, DomainExecutionError>({
          preparedCommand: command,
          commandIdPaths: undefined,
          anticipatedEvents: [],
          postProcess: undefined,
          affectedAggregates: undefined,
          autoDeps: [],
          refCommandIds: [],
          entityRef: undefined,
          creates: undefined,
        })
    if (!prepared.ok) return Err(prepared.error)
    const {
      preparedCommand,
      commandIdPaths,
      anticipatedEvents,
      postProcess,
      affectedAggregates,
      autoDeps,
      refCommandIds,
      entityRef,
      creates,
    } = prepared.value

    const explicitDeps = command.dependsOn ?? []
    const allDeps = [...new Set([...explicitDeps, ...autoDeps, ...refCommandIds])]

    // Calculate blockedBy from all dependencies (only non-terminal commands).
    // Single batch lookup — in-memory hits resolve synchronously, any misses
    // go through one `IStorage.getCommandsByIds` query.
    const depCommands = await this.commandStore.getByIds(allDeps)
    const blockedBy = allDeps.filter((id) => {
      const dep = depCommands.get(id)
      return dep !== undefined && !isTerminalStatus(dep.status)
    })

    // Determine initial status based on unresolved dependencies
    const initialStatus: CommandStatus = blockedBy.length > 0 ? 'blocked' : 'pending'

    // Create command record
    const record: CommandRecord<TLink, TCommand> = {
      commandId,
      cacheKey,
      service: command.service ?? this.defaultService,
      type: command.type,
      data: preparedCommand.data,
      path: preparedCommand.path,
      status: initialStatus,
      dependsOn: allDeps,
      blockedBy,
      attempts: 0,
      postProcess,
      creates,
      revision: preparedCommand.revision,
      fileRefs,
      modelState,
      affectedAggregates,
      commandIdPaths,
      seq: 0, // Placeholder — CommandStore assigns the real value when it owns save()
      createdAt: now,
      updatedAt: now,
    }

    // Save command (assigns seq, writes to memory + storage)
    await this.commandStore.save(record)

    // Cache anticipated events for optimistic updates
    if (anticipatedEvents.length > 0) {
      // For creates with temporary IDs, pass the client-generated entity ID so
      // _clientMetadata can be set on the read model entry for identity tracking.
      const clientId =
        creates?.idStrategy === 'temporary'
          ? this.extractAggregateIdFromEvents(anticipatedEvents, creates.eventType)
          : undefined

      try {
        await this.anticipatedEventHandler.cache({
          command: record,
          events: anticipatedEvents,
          clientId,
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

    return Ok({ commandId, anticipatedEvents, entityRef })
  }

  /**
   * Run the registration-driven command preparation pipeline: mapping-cache
   * patch, EntityRef strip, domain validation, handler invocation, aggregate
   * derivation, auto-dependency detection, and create-command EntityRef build.
   *
   * Precondition: `registration` is defined (caller's gate). This function is
   * only reached when the consumer has registered a handler for this command
   * type — without registration the library has no config for where ids live
   * or how to produce anticipated events, so commands bypass this entirely.
   *
   * When `skipValidation` is true, the strip still runs so the persisted
   * command record stores plain ids, but validate/handle are skipped and
   * every anticipated-event-derived field (`anticipatedEvents`, `postProcess`,
   * `affectedAggregates`, `autoDeps`, `entityRef`) comes back empty/undefined.
   */
  private async prepareCommandWithRegistration<TData, TEvent extends IAnticipatedEvent>(
    command: EnqueueCommand<TData>,
    commandId: string,
    registration: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>,
    skipValidation: boolean | undefined,
    modelState: unknown,
    fileRefs: CommandRecord<TLink, TCommand>['fileRefs'],
  ): Promise<Result<PreparedCommand<TLink, TCommand, TData, TEvent>, DomainExecutionError>> {
    // Registration implies a domainExecutor — getRegistration is what produced it.
    assert(this.domainExecutor, 'prepareCommandWithRegistration requires a domainExecutor')

    // 1. Resolve any client ids the mapping cache knows about and collect the
    //    still-pending EntityRefs in one pass over `commandIdReferences`. The
    //    returned `commandIdPaths` drives strip/restore and dependency wiring.
    const { command: patchedCommand, commandIdPaths } = this.patchFromIdMappingCache(
      command,
      registration,
    )

    const hasRefs = commandIdPaths !== undefined

    // 2. Strip EntityRefs from the command view for validation / handler input.
    const commandView = { data: patchedCommand.data, path: patchedCommand.path }
    const strippedView = hasRefs ? stripEntityRefs(commandView, commandIdPaths) : commandView
    const strippedCommand: EnqueueCommand<TData> = hasRefs
      ? { ...patchedCommand, data: strippedView.data, path: strippedView.path }
      : patchedCommand

    // Dependencies auto-derived from EntityRef commandIds survive a skip-validation
    // return; they encode pending commands this one references regardless of whether
    // we run the handler.
    const refCommandIds: string[] = []
    if (commandIdPaths) {
      for (const ref of Object.values(commandIdPaths)) {
        if (!refCommandIds.includes(ref.commandId)) {
          refCommandIds.push(ref.commandId)
        }
      }
    }

    if (skipValidation) {
      return Ok({
        preparedCommand: strippedCommand,
        commandIdPaths,
        anticipatedEvents: [],
        postProcess: undefined,
        affectedAggregates: undefined,
        autoDeps: [],
        refCommandIds,
        entityRef: undefined,
        creates: registration.creates,
      })
    }

    // 4. Validate with stripped data (plain strings).
    const validationResult = await this.domainExecutor.validate(strippedCommand, modelState)
    if (!validationResult.ok) return Err(validationResult.error)

    // 5. Re-inject EntityRefs into validated/hydrated data + path.
    const hydratedData = validationResult.value
    const viewForRestore = { data: hydratedData, path: strippedView.path }
    const restoredView = hasRefs
      ? restoreEntityRefs(viewForRestore, commandIdPaths)
      : viewForRestore

    // 6. Handler produces anticipated events with EntityRef in parent fields.
    const initialContext: HandlerContext = {
      phase: 'initializing',
      commandId,
      idStrategy: registration.creates?.idStrategy,
    }
    // Trust boundary: the consumer-provided domainExecutor is expected to produce
    // TEvent-compatible anticipated events. TypeScript cannot verify this without
    // making CommandQueue generic in TEvent, which would propagate through the
    // entire client factory.
    const handleResult = this.domainExecutor.handle(
      {
        type: command.type,
        data: restoredView.data,
        path: restoredView.path,
        fileRefs,
      },
      modelState,
      initialContext,
    ) as DomainExecutionResult<TEvent>

    if (!handleResult.ok) return Err(handleResult.error)

    const anticipatedEvents = handleResult.value.anticipatedEvents
    const postProcess = handleResult.value.postProcessPlan

    // 7. Derive affected aggregates from the anticipated events. A parse failure
    //    is an invariant violation: the app produced an anticipated event whose
    //    streamId its own parseStreamId cannot handle.
    const affectedAggregatesResult = deriveAffectedAggregates(
      this.clientAggregates,
      anticipatedEvents,
    )
    assert(
      affectedAggregatesResult.ok,
      `deriveAffectedAggregates failed: ${affectedAggregatesResult.ok ? '' : affectedAggregatesResult.error.message}`,
    )
    const affectedAggregates = affectedAggregatesResult.value

    // 8. Detect aggregate-chain auto-dependencies and record chain entries.
    const autoDeps = this.detectAggregateDependencies(
      commandId,
      affectedAggregates,
      anticipatedEvents,
      registration,
    )

    // 9. Build an EntityRef so the consumer can hold the created entity reference.
    let entityRef: EntityRef | undefined
    if (registration.creates) {
      const createdEntityId = this.extractAggregateIdFromEvents(
        anticipatedEvents,
        registration.creates.eventType,
      )
      if (typeof createdEntityId === 'string') {
        entityRef = createEntityRef(createdEntityId, commandId, registration.creates.idStrategy)
      }
    }

    return Ok({
      preparedCommand: strippedCommand,
      commandIdPaths,
      anticipatedEvents,
      postProcess,
      affectedAggregates: affectedAggregates.length > 0 ? affectedAggregates : undefined,
      autoDeps,
      refCommandIds,
      entityRef,
      creates: registration.creates,
    })
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

  async enqueueAndWait<TData, TEvent extends IAnticipatedEvent, TResponse>(
    params: EnqueueAndWaitParams<TLink, TData>,
  ): Promise<EnqueueAndWaitResult<TResponse>> {
    const enqueueResult = await this.enqueue<TData, TEvent>(params)

    if (!enqueueResult.ok) {
      return Err(enqueueResult.error)
    }

    const waitFor = params.waitFor ?? 'applied'
    const completionResult =
      waitFor === 'succeeded'
        ? await this.waitForSucceeded(enqueueResult.value.commandId, params)
        : await this.waitForApplied(enqueueResult.value.commandId, params)

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
    return this.commandStore.get(commandId)
  }

  async listCommands(filter?: CommandFilter): Promise<CommandRecord<TLink, TCommand>[]> {
    return this.commandStore.list(filter)
  }

  async cancelCommand(
    commandId: string,
  ): Promise<Result<void, CommandNotFoundException | InvalidCommandStatusException>> {
    const command = await this.commandStore.get(commandId)
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

    const cancelledCommand = await this.updateCommandStatus(command, 'cancelled')
    this.eventBus.emit('command:cancelled', {
      commandId: cancelledCommand.commandId,
      type: cancelledCommand.type,
      cacheKey: cancelledCommand.cacheKey,
    })
    this.emitCommandEvent('cancelled', cancelledCommand)
    return Ok()
  }

  async retryCommand(
    commandId: string,
  ): Promise<Result<void, CommandNotFoundException | InvalidCommandStatusException>> {
    const command = await this.commandStore.get(commandId)
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

  /**
   * Lifecycle hook invoked by the eventual command-record deletion path.
   *
   * Detaches the command from any aggregate chains that still reference it.
   * For non-success terminals this is a no-op (chains were already cleaned at
   * the terminal transition). For a deleted succeeded command it clears the
   * command's remaining fingerprints (most commonly `latestCommandId`) while
   * preserving any `lastKnownRevision` it contributed.
   *
   * Safe to call with a commandId whose record no longer exists in storage.
   */
  onCommandDeleted(command: CommandRecord<TLink, TCommand>): void {
    const streamIds = (command.affectedAggregates ?? []).map((a) => a.streamId)
    this.chains.onCommandCleanup(command.commandId, streamIds)
  }

  /**
   * Advance chain revisions from server data (WS events, seed records, refetches).
   * Only updates chains that already exist — does not create new chains.
   * Compares as bigint; only advances forward, never backwards.
   */
  advanceChainRevisions(updates: readonly AdvanceChainRevisionsUpdate[]): void {
    for (const update of updates) {
      const chain = this.chains.get(update.streamId)
      if (!chain) continue

      const proposed = safeParseSerializeBigint(update.revision)
      const existing = safeParseSerializeBigint(chain.lastKnownRevision) ?? -1n
      if (typeof proposed === 'bigint' && proposed > existing) {
        chain.lastKnownRevision = update.revision
      }
    }
  }

  async processPendingCommands(): Promise<void> {
    if (this._paused) {
      return
    }

    // If already processing, flag that we need another pass and join the
    // in-flight promise. The running promise covers all reprocess passes, so
    // followers' awaits resolve only after their newly-enqueued commands are
    // drained.
    if (this.processingPromise) {
      this._pendingReprocess = true
      return this.processingPromise
    }

    this.processingPromise = (async () => {
      do {
        this._pendingReprocess = false
        await this.doProcessPendingCommands()
      } while (this._pendingReprocess && !this._paused)
    })()
    try {
      await this.processingPromise
    } finally {
      this.processingPromise = undefined
    }
  }

  private async doProcessPendingCommands(): Promise<void> {
    if (!this.commandSender) {
      return
    }

    // Get pending commands (not blocked)
    const pendingCommands = await this.commandStore.getByStatus('pending')

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
    const current = await this.commandStore.get(command.commandId)
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
      return this.processCommandSuccess({
        correlationId,
        current,
        updatedCommand,
        response: result.value,
      })
    } else {
      return this.processCommandFailure({
        current,
        updatedCommand,
        exception: result.error,
      })
    }
  }

  private async processCommandSuccess(params: {
    correlationId: string
    current: CommandRecord<TLink, TCommand>
    updatedCommand: CommandRecord<TLink, TCommand>
    response: unknown
  }) {
    const { current, correlationId, response, updatedCommand } = params

    this.eventBus.emitDebug('command:response', {
      commandId: current.commandId,
      correlationId,
      response,
    })

    // Hand response events off to the SyncManager drain. This is
    // fire-and-forget by contract: command lifecycle resolution is
    // driven by `response.id` and `response.nextExpectedRevision`
    // below, NOT by whether the response's events have been applied
    // to the read model. Consumers that need "read model current for
    // this command's events" should subscribe to `readmodel:updated`.
    // Errors from event processing are handled inside the drain and
    // must not fail the command — a future slice will wire them to
    // invalidation signals for local recovery.
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

    // Collect id-mapping candidates so the success write can carry them and
    // the invalidation hook below can fire for any uncovered streams.
    const registration = this.domainExecutor?.getRegistration(updatedCommand.type)
    const mappings = this.collectIdMappingCandidates(updatedCommand, registration ?? {}, response)

    // Success
    const succeededCommand = await this.updateCommandStatus(updatedCommand, 'succeeded', {
      serverResponse: response,
    })

    // Process id-mapping configs (responseIdReferences + responseIdMapping).
    // Dual-indexes client↔server aggregate chains, updates or clears each
    // chain's lastKnownRevision per the config, and persists the mapping so
    // future commands with stale client IDs can be patched at enqueue time.
    const idMap = await this.reconcileAggregateIds(succeededCommand)

    // Best-guess ID reconciliation on the local overlay: for each (clientId →
    // serverId) mapping, copy the optimistic overlay from the client id's row
    // onto a new local overlay at the server id. Never touches `serverData`;
    // the sync pipeline will write authoritative server data when response
    // events drain (or on invalidation refetch below).
    await this.applyIdRewritesToLocalOverlay(succeededCommand, idMap)

    // Invalidation hook: event-less responses and streams without a resolved
    // expected revision both signal "the pipeline cannot confirm this
    // aggregate from events", so fall back to a refetch for each. Deduplicated
    // by streamId — each aggregate fires at most once per success.
    this.fireInvalidationsForSuccess(succeededCommand, mappings.uncoveredStreams, response)

    // For create commands with temporary IDs: rewrite ALL commands in the aggregate
    // chain with the server ID. They stay blocked (waiting for their direct dependency
    // to resolve their revision), but get the correct server ID immediately.
    if (Object.keys(idMap).length > 0) {
      await this.rewriteCommandsWithStaleIds(idMap)

      // Resolve pending cache keys that depend on this command's ID mapping.
      // The CacheManager's resolvePendingKeys updates identity fields in-place
      // and emits cache:key-reconciled events.
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

    // Unblock direct dependents and resolve revision for the next command in chain
    await this.unblockDependentCommands(succeededCommand)

    this.eventBus.emit('command:completed', {
      commandId: current.commandId,
      type: current.type,
      cacheKey: current.cacheKey,
    })
    this.emitCommandEvent('completed', succeededCommand)

    // Post-success applied detection.
    //
    // A command is `'applied'` when its effects are reflected in the local
    // read model. The server data pipeline (SyncManager) handles the normal
    // case: an event arrives or a record seeds, `knownRevisions` advances,
    // and the per-batch evaluator flips the command to `'applied'` once the
    // primary aggregate's revision reaches `response.nextExpectedRevision`.
    //
    // The edge we cover here is "state is already past the threshold at
    // succeed time" — e.g., a WS event for this aggregate drained before the
    // command response itself landed, so the read model is already at the
    // target revision. In that case no future pipeline batch fires for this
    // stream and the command would stay `'succeeded'` forever without this
    // check. Escape hatches (no cacheKey, no registration, no matching
    // collection) also slip to `'applied'` because we can't prove coverage
    // any other way and leaving the command `'succeeded'` indefinitely is
    // worse than a best-effort slip.
    await this.checkAppliedAtSuccess(succeededCommand, registration, response)
  }

  private async checkAppliedAtSuccess(
    command: CommandRecord<TLink, TCommand>,
    registration: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent> | undefined,
    response: unknown,
  ): Promise<void> {
    // Escape hatches — slip to `'applied'` when we can't prove coverage.
    if (!this.cacheManager.existsSync(command.cacheKey.key)) {
      await this.slipToApplied(command)
      return
    }
    if (!registration || !registration.aggregate) {
      await this.slipToApplied(command)
      return
    }

    const primaryAggregate = registration.aggregate
    const collection = this.collections.find((c) =>
      matchesAggregate(c.aggregate.getLinkMatcher(), primaryAggregate),
    )
    if (!collection) {
      await this.slipToApplied(command)
      return
    }

    // Strong detection: compare the primary aggregate's read-model revision
    // to `response.nextExpectedRevision`. Secondary aggregates are ignored —
    // the pipeline-side evaluator applies the same rule.
    const primaryEntityId = this.readResponseField(response, 'id')
    if (primaryEntityId === undefined) return

    const nextExpectedRevisionRaw = this.readResponseField(response, 'nextExpectedRevision')
    if (nextExpectedRevisionRaw === undefined) return
    const expected = parseExpectedRevision(nextExpectedRevisionRaw)
    if (expected === undefined) return

    const record = await this.readModelStore.getById(collection.name, primaryEntityId)
    if (!record || record.revision === undefined) return
    const current = parseExpectedRevision(record.revision)
    if (current === undefined) return

    if (current >= expected) {
      await this.slipToApplied(command)
    }
  }

  private async slipToApplied(command: CommandRecord<TLink, TCommand>): Promise<void> {
    await this.batchUpdateSyncStatus({ applied: [command] })
    await this.anticipatedEventHandler.cleanupOnAppliedBatch([command.commandId])
  }

  private async processCommandFailure(params: {
    current: CommandRecord<TLink, TCommand>
    updatedCommand: CommandRecord<TLink, TCommand>
    exception: CommandSendException
  }) {
    const { current, exception, updatedCommand } = params
    const error = new CommandFailedException('server', exception.message, {
      errorCode: exception.errorCode,
      details: exception.details,
    })

    const canRetry = exception.isRetryable && shouldRetry(updatedCommand.attempts, this.retryConfig)

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
      const failedCommand = await this.updateCommandStatus(updatedCommand, 'failed', { error })

      // Cancel dependent commands
      await this.cancelDependentCommands(current.commandId)

      this.eventBus.emit('command:failed', {
        commandId: current.commandId,
        type: current.type,
        error: error.message,
        cacheKey: current.cacheKey,
      })
      this.emitCommandEvent('failed', failedCommand)
    }
  }

  private async unblockDependentCommands(
    parentCommand: CommandRecord<TLink, TCommand>,
  ): Promise<void> {
    const blockedCommands = await this.commandStore.getBlockedBy(parentCommand.commandId)
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
        this.commandStore.update(blocked.commandId, { blockedBy: newBlockedBy })
      }
    }
  }

  /**
   * Cascade resolved server IDs into every non-terminal command whose payload
   * referenced the now-resolved client IDs.
   *
   * Called when a create with a temporary ID succeeds. Walks each pending
   * command's declared `commandIdReferences` via `rewriteCommandWithIdMap`,
   * rewrites matched values, prunes the corresponding `commandIdPaths`
   * entries, and regenerates anticipated events so the optimistic read-model
   * reflects the real server IDs.
   *
   * CommandQueue owns this response-driven cascade. SyncManager Phase 4
   * covers the parallel WS-driven path for resolutions that arrive outside a
   * direct command response.
   */
  private async rewriteCommandsWithStaleIds(
    idMap: Record<string, IdMapEntry<TLink>>,
  ): Promise<void> {
    const entries: RewriteIdEntry<TLink>[] = Object.entries(idMap).map(
      ([clientId, { serverId, aggregate }]) => ({ clientId, serverId, aggregate }),
    )
    if (entries.length === 0) return

    const allCommands = await this.commandStore.getByStatus(['pending', 'blocked', 'sending'])

    for (const command of allCommands) {
      const registration = this.domainExecutor?.getRegistration(command.type)
      if (!registration) continue

      const result = rewriteCommandWithIdMap(
        command,
        command.commandIdPaths,
        entries,
        registration.commandIdReferences,
      )
      if (!result.changed) continue

      this.commandStore.update(command.commandId, {
        data: result.data as CommandRecord<TLink, TCommand>['data'],
        path: result.path,
        commandIdPaths: result.commandIdPaths,
      })

      // Regenerate anticipated events against the rewritten view so the
      // optimistic read-model tracks real server IDs.
      if (!this.domainExecutor) continue

      const entityId = command.creates
        ? this.getOriginalCreateId(command.commandId)
        : extractPrimaryAggregateId({ data: result.data, path: result.path }, registration)
      if (entityId === undefined) continue

      const context: HandlerContext = {
        phase: 'updating',
        entityId,
        commandId: command.commandId,
        idStrategy: command.creates?.idStrategy,
      }
      const cmdView = { data: result.data, path: result.path }
      const restoredCmdView = result.commandIdPaths
        ? restoreEntityRefs(cmdView, result.commandIdPaths)
        : cmdView
      const handleResult = this.domainExecutor.handle(
        {
          type: command.type,
          data: restoredCmdView.data,
          path: restoredCmdView.path,
          fileRefs: command.fileRefs,
        },
        // TODO: this should be getting updated local model from the caller
        // modelState,
        undefined,
        context,
      )
      if (!handleResult.ok) continue

      try {
        await this.anticipatedEventHandler.regenerate(command, handleResult.value.anticipatedEvents)
      } catch (err) {
        logProvider.log.error(
          { err, commandId: command.commandId },
          'Failed to regenerate anticipated events during stale ID rewrite',
        )
      }
    }
  }

  /**
   * Rebuild in-memory aggregate chains from active commands.
   * Called on resume so chains exist for AutoRevision resolution and
   * auto-dependency detection on new enqueues.
   *
   * `'applied'` is intentionally excluded from the status filter: chains are
   * for in-flight coordination, and applied commands are fully terminal with
   * their server state already reflected. Stale UI references to reconciled
   * temp ids go through {@link ICommandIdMappingStore} (durable), not chains.
   *
   * On a worker-recreate mid-session this rebuild also:
   * - Rehydrates the client↔server dual-index via {@link mappingStore} so a
   *   newly enqueued command whose payload has been patched to the server id
   *   finds the same chain as an in-flight command keyed by the client id.
   * - Restores `lastKnownRevision` from each succeeded command's
   *   `serverResponse` so AutoRevision resolves from the last confirmed
   *   server revision instead of falling back to the consumer-provided
   *   read-model rev.
   */
  protected async rebuildChains(): Promise<void> {
    this.chains.clear()
    const commands = await this.commandStore.getByStatus([
      'pending',
      'blocked',
      'sending',
      'succeeded',
    ])
    // Sort by `seq`, monotonic insertion counter assigned by CommandStore at save time,
    // so related commands (which may share a millisecond on `createdAt`) are processed in
    // strict dependency order.
    commands.sort((a, b) => a.seq - b.seq)

    for (const command of commands) {
      if (!command.affectedAggregates) continue
      const registration = this.domainExecutor?.getRegistration(command.type)

      for (const { streamId, link } of command.affectedAggregates) {
        const existing = this.chains.get(streamId)
        if (existing) {
          existing.latestCommandId = command.commandId
        } else {
          this.chains.create({
            clientStreamId: streamId,
            latestCommandId: command.commandId,
          })
        }

        // Dual-index rehydration: if the mapping store already resolved this
        // aggregate's temp id to a server id in a prior session, attach the
        // server streamId to the same chain. Without this, a fresh command
        // whose payload was patched to the server id would create a separate
        // chain and miss the auto-dependency on an in-flight pre-reconcile
        // command that's still keyed by the client streamId.
        const clientEntityId = entityIdToString(link.id)
        const mapping = this.mappingStore.get(clientEntityId)
        if (mapping && mapping.serverId !== clientEntityId) {
          const chain = this.chains.get(streamId)
          if (chain && chain.serverStreamId === undefined) {
            const aggregate = this.clientAggregates.aggregates.find((a) =>
              matchesAggregate(link as unknown as Omit<TLink, 'id'>, a),
            )
            if (aggregate) {
              const serverStreamId = aggregate.getStreamId(mapping.serverId)
              if (!this.chains.has(serverStreamId)) {
                this.chains.attachServerStreamId(chain, serverStreamId)
              }
            }
          }
        }
      }

      if (command.creates) {
        const primaryAggregate = registration?.aggregate
        if (primaryAggregate) {
          const match = command.affectedAggregates.find((a) =>
            matchesAggregate(a.link as unknown as Omit<TLink, 'id'>, primaryAggregate),
          )
          if (match) {
            const chain = this.chains.get(match.streamId)
            if (chain) {
              chain.createCommandId = command.commandId
              chain.createdEntityId = entityIdToString(match.link.id)
            }
          }
        }
      }

      // Revision rehydration: for commands that already succeeded, replay
      // the id-mapping candidate extraction against the persisted server
      // response to recover each affected chain's `lastKnownRevision`. This
      // is pure — `collectIdMappingCandidates` has no side effects — and
      // advances forward only via the bigint compare so out-of-order load
      // ordering can't regress a chain's revision.
      if (command.serverResponse && registration) {
        const { candidates } = this.collectIdMappingCandidates(
          command,
          registration,
          command.serverResponse,
        )
        for (const candidate of candidates) {
          if (candidate.nextExpectedRevision === undefined) continue
          const clientStreamId = this.findClientStreamIdForEntityId(command, candidate.clientId)
          if (clientStreamId === undefined) continue
          const chain = this.chains.get(clientStreamId)
          if (!chain) continue
          const proposed = safeParseSerializeBigint(candidate.nextExpectedRevision)
          const existing = safeParseSerializeBigint(chain.lastKnownRevision) ?? -1n
          if (typeof proposed === 'bigint' && proposed > existing) {
            chain.lastKnownRevision = candidate.nextExpectedRevision
          }
        }
      }
    }
  }

  /**
   * Reconcile aggregate identity on command success by processing the registration's
   * `responseIdReferences` (declarative) and `responseIdMapping` (callback) configs.
   *
   * For each resolved mapping:
   *  - Dual-index the aggregate chain so both the client streamId and the server
   *    streamId resolve to the same chain state (supports stale in-flight commands).
   *  - Set the chain's `lastKnownRevision` when the mapping carries one, else clear it
   *    so AutoRevision falls back to the read model revision.
   *  - Add to the returned id map so `rewriteCommandsWithStaleIds` can patch pending
   *    command payloads.
   *  - Persist the mapping to storage for the race-condition patch cache.
   *
   * Every chain touched by this command but NOT covered by a mapping has its
   * `lastKnownRevision` cleared (the server may have advanced those chains too but
   * the config didn't declare how to read their revision).
   */
  private async reconcileAggregateIds(
    command: CommandRecord<TLink, TCommand>,
  ): Promise<Record<string, IdMapEntry<TLink>>> {
    const map: Record<string, IdMapEntry<TLink>> = {}
    if (!command.serverResponse) return map

    const registration = this.domainExecutor?.getRegistration(command.type)
    if (!registration) return map
    if (
      registration.responseIdReferences === undefined &&
      registration.responseIdMapping === undefined
    ) {
      return map
    }

    const { candidates } = this.collectIdMappingCandidates(
      command,
      registration,
      command.serverResponse,
    )
    const persistedAt = Date.now()
    const coveredStreamIds = new Set<string>()

    for (const { aggregate, clientId, serverId, nextExpectedRevision } of candidates) {
      if (map[clientId] !== undefined) continue

      const clientStreamId = this.findClientStreamIdForEntityId(command, clientId)
      if (clientStreamId === undefined) continue

      const chain = this.chains.get(clientStreamId)
      if (chain === undefined) continue

      const serverStreamId = aggregate.getStreamId(serverId)

      // Apply the revision update on the shared chain object. When the config
      // doesn't carry a revision, clear it so AutoRevision falls back.
      chain.lastKnownRevision = nextExpectedRevision
      coveredStreamIds.add(clientStreamId)
      coveredStreamIds.add(serverStreamId)

      if (clientId !== serverId) {
        map[clientId] = { serverId, aggregate }

        // Attach the server streamId alongside the existing client streamId so
        // both resolve to the same chain object. Stale read models may still
        // reference the client streamId in flight; fresh commands reference the
        // server streamId. Create markers were owned by the now-reconciled temp
        // id and are cleared.
        chain.createCommandId = undefined
        chain.createdEntityId = undefined
        if (chain.serverStreamId === undefined) {
          this.chains.attachServerStreamId(chain, serverStreamId)
        }

        // Persist the mapping for race-condition handling. SyncManager's stamp
        // pass reads this back to set `_clientMetadata.clientId = clientId` on
        // the new serverId read model entry after it's materialized.
        this.mappingStore.save({
          clientId,
          serverId,
          createdAt: persistedAt,
        })
      }
    }

    // Clear lastKnownRevision on any touched chain not covered by a mapping.
    // The server may have advanced those chains; without a declared revision
    // path we can't know the new value, so fall back to the read model.
    if (command.affectedAggregates) {
      for (const { streamId } of command.affectedAggregates) {
        if (coveredStreamIds.has(streamId)) continue
        const chain = this.chains.get(streamId)
        if (chain) chain.lastKnownRevision = undefined
      }
    }

    return map
  }

  /**
   * Advance the optimistic overlay onto the server-assigned ids that
   * `reconcileAggregateIds` just resolved.
   *
   * Builds one batch of `(collection, fromId, toId)` migrations from the
   * handler's tracked entries intersected with `idMap`, then delegates the
   * row rewrite + delete to {@link ReadModelStore.migrateEntityIds}. That
   * method owns the details (id-field patch, `hasLocalChanges` recomputation,
   * `_clientMetadata` / `cacheKeys` preservation) and is the place where
   * future batching lives.
   */
  private async applyIdRewritesToLocalOverlay(
    command: CommandRecord<TLink, TCommand>,
    idMap: Record<string, IdMapEntry<TLink>>,
  ): Promise<void> {
    const entries = Object.entries(idMap)
    if (entries.length === 0) return

    const tracked = this.anticipatedEventHandler.getTrackedEntries(command.commandId) ?? []
    if (tracked.length === 0) return

    // tracked entries are `collection:clientId` — group by clientId so one
    // mapping can fan out across multiple collections the command touched.
    const collectionsByClientId = new Map<string, string[]>()
    for (const key of tracked) {
      const separatorIndex = key.indexOf(':')
      if (separatorIndex === -1) continue
      const collection = key.substring(0, separatorIndex)
      const clientId = key.substring(separatorIndex + 1)
      const existing = collectionsByClientId.get(clientId)
      if (existing) existing.push(collection)
      else collectionsByClientId.set(clientId, [collection])
    }

    const migrations: EntityIdMigration[] = []
    for (const [clientId, { serverId }] of entries) {
      if (clientId === serverId) continue
      const collections = collectionsByClientId.get(clientId)
      if (!collections) continue
      for (const collection of collections) {
        migrations.push({ collection, fromId: clientId, toId: serverId })
      }
    }

    if (migrations.length === 0) return
    await this.readModelStore.migrateEntityIds(migrations)
  }

  /**
   * Fire fire-and-forget invalidation signals for streams the sync pipeline
   * cannot confirm from response events:
   *   - Every `uncoveredStream` (no resolved expected revision) → one call.
   *   - If the response carried no events, every stream in
   *     `command.affectedAggregates` → one call with `'event-less-response'`.
   *
   * Deduplicated by streamId so each aggregate fires at most once per command
   * success. `no-expected-revision` is preferred as the reason when both
   * conditions apply to the same stream.
   */
  private fireInvalidationsForSuccess(
    command: CommandRecord<TLink, TCommand>,
    uncoveredStreams: readonly string[],
    response: unknown,
  ): void {
    const cacheKey = command.cacheKey.key
    const fired = new Set<string>()

    for (const streamId of uncoveredStreams) {
      if (fired.has(streamId)) continue
      fired.add(streamId)
      this.eventBus.emit('sync:invalidate-requested', {
        streamId,
        cacheKey,
        commandId: command.commandId,
        reason: 'no-expected-revision',
      })
    }

    const responseHasEvents = hasResponseEvents(response) && response.events.length > 0
    if (responseHasEvents) return

    const affected = command.affectedAggregates ?? []
    for (const { streamId } of affected) {
      if (fired.has(streamId)) continue
      fired.add(streamId)
      this.eventBus.emit('sync:invalidate-requested', {
        streamId,
        cacheKey,
        commandId: command.commandId,
        reason: 'event-less-response',
      })
    }
  }

  /**
   * Collect candidate id mappings from both id-mapping config sources, plus
   * the set of affected streams that the response did not cover with a
   * parsable `nextExpectedRevision` (so the success path can fire an
   * invalidation for each).
   *
   * Returned fields:
   *  - `candidates` — each entry carries an aggregate, the client entity id it
   *    corresponds to, its server-assigned id, and optionally the server's
   *    `nextExpectedRevision` for that aggregate.
   *  - `uncoveredStreams` — streams in `command.affectedAggregates` without a
   *    resolved/parsable revision after merging `responseIdReferences` and
   *    `responseIdMapping`. Deduplicated; each stream appears at most once.
   *
   * BigInt parse failures are logged once at this site as a warning and the
   * stream lands in `uncoveredStreams` (same downstream treatment as "no
   * revision mapped" — the success path fires an invalidation for it).
   */
  private collectIdMappingCandidates(
    command: CommandRecord<TLink, TCommand>,
    registration: {
      responseIdReferences?: ResponseIdReference<TLink>[]
      responseIdMapping?: (ctx: {
        command: CommandRecord<TLink, TCommand>
        response: unknown
      }) => Array<{ clientId: EntityRef; serverId: string; nextExpectedRevision?: string }>
    },
    response: unknown,
  ): CollectedIdMappings<TLink> {
    const candidates: IdMappingCandidate<TLink>[] = []

    if (registration.responseIdReferences) {
      for (const ref of registration.responseIdReferences) {
        const resolved = this.resolveResponseAggregateRef(ref, response)
        if (resolved === undefined) continue
        const clientId = this.findClientIdForAggregate(command, resolved.aggregate)
        if (clientId === undefined) continue
        candidates.push({
          aggregate: resolved.aggregate,
          clientId,
          serverId: resolved.serverId,
          nextExpectedRevision: resolved.nextExpectedRevision,
        })
      }
    }

    if (registration.responseIdMapping) {
      const mappings = registration.responseIdMapping({
        command,
        response,
      })
      for (const { clientId: clientRef, serverId, nextExpectedRevision } of mappings) {
        const aggregate = this.findAggregateForEntityId(command, clientRef.entityId)
        if (aggregate === undefined) continue
        candidates.push({
          aggregate,
          clientId: clientRef.entityId,
          serverId,
          nextExpectedRevision,
        })
      }
    }

    const coveredStreams = new Set<string>()
    for (const { clientId, nextExpectedRevision } of candidates) {
      if (nextExpectedRevision === undefined) continue
      const streamId = this.findClientStreamIdForEntityId(command, clientId)
      if (streamId === undefined) continue
      if (coveredStreams.has(streamId)) continue
      const parsed = parseExpectedRevision(nextExpectedRevision)
      if (parsed === undefined) {
        logProvider.log.warn(
          {
            commandId: command.commandId,
            streamId,
            clientId,
            nextExpectedRevision,
          },
          'collectIdMappingCandidates: unparsable nextExpectedRevision, treating stream as uncovered',
        )
        continue
      }
      coveredStreams.add(streamId)
    }

    const uncoveredStreams: string[] = []
    if (command.affectedAggregates) {
      const seen = new Set<string>()
      for (const { streamId } of command.affectedAggregates) {
        if (coveredStreams.has(streamId)) continue
        if (seen.has(streamId)) continue
        seen.add(streamId)
        uncoveredStreams.push(streamId)
      }
    }

    return { candidates, uncoveredStreams }
  }

  /**
   * Evaluate a single {@link ResponseIdReference} against the response body.
   * DirectIdReference: id path → plain server-id string.
   * LinkIdReference: id path → Link object; disambiguate against ref.aggregates[].
   * `revisionPath` (if declared) is read as a string from the same response.
   */
  private resolveResponseAggregateRef(
    ref: ResponseIdReference<TLink>,
    response: unknown,
  ):
    | { aggregate: AggregateConfig<TLink>; serverId: string; nextExpectedRevision?: string }
    | undefined {
    const idValue = getAtPath(response, ref.path)
    const nextExpectedRevision = this.readRevisionAtPath(response, ref.revisionPath)

    if ('aggregate' in ref) {
      if (typeof idValue !== 'string') return undefined
      return { aggregate: ref.aggregate, serverId: idValue, nextExpectedRevision }
    }

    // LinkIdReference — value must be a Link object, matched against ref.aggregates[].
    if (typeof idValue !== 'object' || idValue === null) return undefined
    const link = idValue as Omit<TLink, 'id'> & { id?: unknown }
    if (typeof link.id !== 'string') return undefined
    for (const agg of ref.aggregates) {
      if (matchesAggregate(link, agg)) {
        return { aggregate: agg, serverId: link.id, nextExpectedRevision }
      }
    }
    return undefined
  }

  private readRevisionAtPath(
    response: unknown,
    path: JSONPathExpression | undefined,
  ): string | undefined {
    if (path === undefined) return undefined
    const value = getAtPath(response, path)
    return typeof value === 'string' ? value : undefined
  }

  /**
   * Find the client entity-id string for an aggregate type by scanning the command's
   * affectedAggregates. Used when `responseIdReferences` identifies aggregates by config.
   *
   * Asserts that at most one affected aggregate matches the type. Commands that touch
   * multiple aggregates of the same type (e.g., move-between-folders with two Folder
   * refs) must use `responseIdMapping` (callback) instead of declarative
   * `responseIdReferences` — the declarative path cannot disambiguate same-type
   * aggregates deterministically.
   */
  private findClientIdForAggregate(
    command: CommandRecord<TLink, TCommand>,
    aggregate: AggregateConfig<TLink>,
  ): string | undefined {
    if (!command.affectedAggregates) return undefined
    let result: string | undefined
    for (const { link } of command.affectedAggregates) {
      if (matchesAggregate(link as unknown as Omit<TLink, 'id'>, aggregate)) {
        assert(
          result === undefined,
          `Command "${command.type}" has multiple affectedAggregates matching ` +
            `aggregate type "${aggregate.type}". Use responseIdMapping instead of ` +
            `responseIdReferences for commands that touch multiple same-type aggregates.`,
        )
        result = entityIdToString(link.id)
      }
    }
    return result
  }

  /**
   * Find the registered aggregate config whose service/type matches the
   * affectedAggregate bearing the given client entity id. Used when
   * `responseIdMapping` returns EntityRefs and the library needs to derive the
   * aggregate for server-streamId construction.
   */
  private findAggregateForEntityId(
    command: CommandRecord<TLink, TCommand>,
    entityId: string,
  ): AggregateConfig<TLink> | undefined {
    if (!command.affectedAggregates) return undefined
    for (const { link } of command.affectedAggregates) {
      if (entityIdToString(link.id) !== entityId) continue
      for (const agg of this.clientAggregates.aggregates) {
        if (matchesAggregate(link as unknown as Omit<TLink, 'id'>, agg)) {
          return agg
        }
      }
    }
    return undefined
  }

  /**
   * Find the client-time streamId for an entity id by scanning affectedAggregates.
   * The streamId is what the chain is keyed by.
   */
  private findClientStreamIdForEntityId(
    command: CommandRecord<TLink, TCommand>,
    entityId: string,
  ): string | undefined {
    if (!command.affectedAggregates) return undefined
    for (const { streamId, link } of command.affectedAggregates) {
      if (entityIdToString(link.id) === entityId) return streamId
    }
    return undefined
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
    this.commandStore.update(command.commandId, { revision: parentRevision })

    // Re-run the handler to produce fresh anticipated events with correct IDs
    if (this.domainExecutor) {
      const data = command.data as Record<string, unknown>
      const context = this.buildUpdatingContext(command, data)
      const cmdView = { data, path: command.path }
      const restoredCmdView = command.commandIdPaths
        ? restoreEntityRefs(cmdView, command.commandIdPaths)
        : cmdView
      const result = this.domainExecutor.handle(
        {
          type: command.type,
          data: restoredCmdView.data,
          path: restoredCmdView.path,
          fileRefs: command.fileRefs,
        },
        // TODO: this should be getting updated local model from the caller
        // modelState,
        undefined,
        context,
      )
      if (result.ok) {
        try {
          await this.anticipatedEventHandler.regenerate(command, result.value.anticipatedEvents)
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
    const blockedCommands = await this.commandStore.getBlockedBy(commandId)
    const active = blockedCommands.filter((blocked) => !isTerminalStatus(blocked.status))
    if (active.length === 0) return

    // Siblings go through one batch: single store write, parallel terminal
    // cleanup, one pass of event emission.
    const cancelledCommands = await this.batchUpdateCommandStatus(active, 'cancelled', {
      error: new CommandFailedException('local', `Dependency ${commandId} failed`),
    })

    // Fire terminal CommandEvents + broadcast library events after the batch
    // status flip. These signal "fully settled" to waitForSucceeded
    // subscribers; cancelled commands have no post-processing of their own.
    for (const command of cancelledCommands) {
      this.eventBus.emit('command:cancelled', {
        commandId: command.commandId,
        type: command.type,
        cacheKey: command.cacheKey,
      })
      this.emitCommandEvent('cancelled', command)
    }

    // Recurse sequentially so each level's cancellation finishes before the
    // next level's `getBlockedBy` runs.
    for (const blocked of cancelledCommands) {
      await this.cancelDependentCommands(blocked.commandId)
    }
  }

  /**
   * Resolve any client ids the mapping cache knows about before the command
   * is persisted, and collect any still-pending EntityRefs for dependency
   * auto-wiring downstream.
   *
   * Walks `registration.commandIdReferences` in a single pass:
   *   - Resolved client id → write server id at the declared path.
   *   - Unresolved EntityRef → record in `commandIdPaths` for strip/restore.
   *   - Plain server-id string → unchanged.
   *
   * `autoRevision` fallback: when the revision marker has no fallback yet,
   * look up `registration.aggregate`'s chain by streamId (chains are
   * dual-indexed client+server after reconciliation) and use its
   * `lastKnownRevision`.
   */
  private patchFromIdMappingCache<TData, TEvent extends IAnticipatedEvent>(
    command: EnqueueCommand<TData>,
    registration: CommandHandlerRegistration<TLink, TCommand, TSchema, TEvent>,
  ): {
    command: EnqueueCommand<TData>
    commandIdPaths: Record<JSONPathExpression, EntityRef> | undefined
  } {
    const resolved = resolveCommandIds(
      { data: command.data, path: command.path },
      registration.commandIdReferences,
      this.mappingStore,
    )

    let patchedRevision = command.revision
    if (
      isAutoRevision(patchedRevision) &&
      patchedRevision.fallback === undefined &&
      registration.aggregate
    ) {
      const entityId = extractPrimaryAggregateId(
        { data: resolved.data, path: resolved.path },
        registration,
      )
      if (entityId) {
        const streamId = registration.aggregate.getStreamId(entityId)
        const chain = this.chains.get(streamId)
        if (chain?.lastKnownRevision) {
          patchedRevision = autoRevision(chain.lastKnownRevision)
        }
      }
    }

    const commandChanged = resolved.changed || patchedRevision !== command.revision
    const patchedCommand: EnqueueCommand<TData> = commandChanged
      ? {
          ...command,
          data: resolved.data as TData,
          path: resolved.path,
          revision: patchedRevision,
        }
      : command

    return { command: patchedCommand, commandIdPaths: resolved.commandIdPaths }
  }

  /**
   * Resolve AUTO_REVISION marker in a command's revision before sending to the server.
   * Returns a new command record with the resolved revision (or the original if no resolution needed).
   *
   * Uses the registration's declared `aggregate` to compute the streamId for chain
   * lookup — not `affectedAggregates` ordering.
   */
  private resolveAutoRevisionForSend(
    command: CommandRecord<TLink, TCommand>,
  ): CommandRecord<TLink, TCommand> {
    if (!isAutoRevision(command.revision)) return command

    const registration = this.domainExecutor?.getRegistration(command.type)
    assert(
      registration?.aggregate,
      `AutoRevision requires registration.aggregate for command "${command.type}"`,
    )

    const entityId = extractPrimaryAggregateId(command, registration)
    if (entityId) {
      const streamId = registration.aggregate.getStreamId(entityId)
      const chain = this.chains.get(streamId)
      if (chain?.lastKnownRevision) {
        return { ...command, revision: chain.lastKnownRevision }
      }
    }

    // Fallback: the read model revision the consumer passed at enqueue time
    return { ...command, revision: command.revision.fallback }
  }

  /**
   * Detect same-aggregate dependencies and update the aggregate chain tracker.
   *
   * Every aggregate stream the command touches (via its anticipated events) gets
   * chained after any pending command on that stream. For create commands the
   * chain entry for the created aggregate also records `createCommandId` and
   * `createdEntityId` so reconciliation can map the temp ID to the server ID.
   *
   * @returns Array of auto-generated dependency command IDs (may be empty).
   */
  private detectAggregateDependencies(
    commandId: string,
    affectedAggregates: AffectedAggregate<TLink>[],
    anticipatedEvents: IAnticipatedEvent[],
    registration: { creates?: CommandRecord<TLink, TCommand>['creates'] } | undefined,
  ): string[] {
    if (!registration) return []
    if (affectedAggregates.length === 0) return []

    // Identify the streamId of the created aggregate (if this is a create command)
    // so we can mark its chain entry with createCommandId.
    let createdStreamId: string | undefined
    if (registration.creates) {
      for (const event of anticipatedEvents) {
        if (event.type === registration.creates.eventType) {
          createdStreamId = event.streamId
          break
        }
      }
    }

    const autoDeps: string[] = []

    for (const { streamId, link } of affectedAggregates) {
      const existing = this.chains.get(streamId)
      if (existing?.latestCommandId !== undefined) {
        autoDeps.push(existing.latestCommandId)
      }

      if (streamId === createdStreamId && registration.creates) {
        const isTemporary = registration.creates.idStrategy === 'temporary'
        const createdEntityId = isTemporary ? entityIdToString(link.id) : undefined
        const createCommandId = isTemporary ? commandId : undefined

        if (existing) {
          // Re-create on an existing chain: stamp the new create markers on the
          // shared chain object. Identity (client/server streamId) is unchanged.
          existing.createCommandId = createCommandId
          existing.createdEntityId = createdEntityId
          existing.latestCommandId = commandId
        } else {
          // Fresh create: a temp-id create registers the streamId as client-side;
          // a permanent-id create registers it as server-side (the server accepts
          // our id as-is).
          this.chains.create(
            isTemporary
              ? {
                  clientStreamId: streamId,
                  createCommandId,
                  createdEntityId,
                  latestCommandId: commandId,
                }
              : { serverStreamId: streamId, latestCommandId: commandId },
          )
        }
      } else if (existing) {
        existing.latestCommandId = commandId
      } else {
        // First command on this aggregate, not a create: must be targeting an
        // existing server entity, so the streamId is server-side.
        this.chains.create({ serverStreamId: streamId, latestCommandId: commandId })
      }
    }

    return autoDeps
  }

  /**
   * Extract aggregate ID from anticipated events by finding the event matching the configured type.
   * Handles both plain-string ids (permanent-id creates) and EntityRef ids
   * (temporary-id creates) — in the EntityRef case the underlying `entityId`
   * string is returned so the aggregate chain can key consistently on a
   * plain string regardless of id-resolution state.
   */
  private extractAggregateIdFromEvents(events: unknown[], eventType: string): string | undefined {
    for (const event of events) {
      if (typeof event !== 'object' || event === null) continue
      if (!('type' in event) || event.type !== eventType) continue
      if (!('data' in event) || typeof event.data !== 'object' || event.data === null) continue
      if (!('id' in event.data)) continue
      const rawId = (event.data as { id: unknown }).id
      if (typeof rawId === 'string') return rawId
      const asEntityId = entityIdToString(rawId as EntityId | undefined)
      if (typeof asEntityId === 'string') return asEntityId
    }
    return undefined
  }

  /**
   * Look up the original entity ID for a pending create command from the aggregate chain.
   * Returns the chain's `createdEntityId` where createCommandId matches.
   */
  private getOriginalCreateId(commandId: string): string | undefined {
    return this.chains.find((c) => c.createCommandId === commandId)?.createdEntityId
  }

  /**
   * Derive the primary entity ID for a command. For create commands this comes from
   * the aggregate chain; for mutate commands it comes from the first affected
   * aggregate. Returns undefined when neither path yields an ID — callers decide
   * whether that's fatal (`buildUpdatingContext`) or expected (reconciliation).
   */
  getEntityIdForCommand(command: CommandRecord<TLink, TCommand>): string | undefined {
    if (command.creates) {
      return this.getOriginalCreateId(command.commandId)
    }
    const primary = command.affectedAggregates?.[0]
    return primary !== undefined ? entityIdToString(primary.link.id) : undefined
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

  private async updateCommandStatus(
    command: CommandRecord<TLink, TCommand>,
    newStatus: CommandStatus,
    additionalUpdates?: Partial<CommandRecord<TLink, TCommand>>,
  ): Promise<CommandRecord<TLink, TCommand>> {
    const [updatedCommand] = await this.batchUpdateCommandStatus(
      [command],
      newStatus,
      additionalUpdates,
    )
    return updatedCommand
  }

  /**
   * Batch variant of {@link updateCommandStatus}. Applies the same `newStatus`
   * and `additionalUpdates` to every command, using a single
   * `commandStore.batchUpdate` call. Terminal cleanup (anticipated events,
   * file refs) runs in parallel across commands. Chain cleanup and event
   * emission run per-command in order.
   *
   * The caller supplies commands by reference; in-place mutation on each
   * record matches the single-command method so external code holding a
   * reference observes the new status.
   */
  private async batchUpdateCommandStatus<const T extends readonly CommandRecord<TLink, TCommand>[]>(
    commands: T,
    newStatus: CommandStatus,
    additionalUpdates?: Partial<CommandRecord<TLink, TCommand>>,
  ): Promise<Mutable<T>> {
    assert(
      newStatus !== 'applied',
      'CommandQueue.batchUpdateCommandStatus must not be called for applied status',
    )
    // Pre-sized copy of the input — allocates once with the known length
    // Cast is needed because Mutable<T> is a mapped type over the generic T;
    // TS widens `[...commands]` to a plain array and can't prove that matches
    // the mapped-type output while T is unresolved.
    const updatedCommands = [...commands] as Mutable<T>
    if (commands.length === 0) return updatedCommands

    const now = Date.now()
    const previousStatuses: Record<string, CommandStatus> = Object.fromEntries(
      commands.map((c) => [c.commandId, c.status]),
    )

    this.commandStore.batchUpdate(
      commands.map((command) => ({
        commandId: command.commandId,
        updates: { status: newStatus, updatedAt: now, ...additionalUpdates },
      })),
    )

    // Clean up anticipated events and files when command reaches terminal state.
    // `'applied'` is post-terminal and handled exclusively by the sync pipeline via
    // batchUpdateSyncStatus + cleanupOnAppliedBatch — it never flows through here.
    if (isTerminalStatus(newStatus)) {
      const cleanupTask = newStatus === 'succeeded' ? 'cleanupOnSucceeded' : 'cleanupOnFailure'
      const fileCleanupTasks: Promise<unknown>[] = []
      for (const command of commands) {
        await this.anticipatedEventHandler[cleanupTask](command.commandId).catch((err) => {
          logProvider.log.error(
            { err, commandId: command.commandId },
            'Failed to clean up anticipated events',
          )
        })
        if (command.fileRefs) {
          fileCleanupTasks.push(
            this.fileStore.deleteForCommand(command.commandId).catch((err) => {
              logProvider.log.error(
                { err, commandId: command.commandId },
                'Failed to clean up command files',
              )
            }),
          )
        }
      }
      await Promise.all(fileCleanupTasks)
    }

    // Non-success terminal = dead command: detach it from chains so future
    // auto-chained commands don't reference it. Success commands keep their
    // chain fingerprints until the command record is deleted (see `onCommandDeleted`).
    if (newStatus === 'failed' || newStatus === 'cancelled') {
      for (const command of commands) {
        const streamIds = (command.affectedAggregates ?? []).map((a) => a.streamId)
        this.chains.onCommandCleanup(command.commandId, streamIds)
      }
    }

    for (const command of commands) {
      // previousStatus cannot be undefined here. both are exhaustive for each commands' loops
      const previousStatus = previousStatuses[command.commandId]!
      if (previousStatus !== newStatus) {
        this.emitCommandEvent('status-changed', command, previousStatus)
        this.eventBus.emit('command:status-changed', {
          commandId: command.commandId,
          status: newStatus,
          previousStatus,
          cacheKey: command.cacheKey,
        })
      }
    }
    return updatedCommands
  }

  /**
   * Batch-write the sync pipeline's `'succeeded' → 'applied'` transition for
   * the given commands. Each gets `{ status: 'applied', updatedAt }` written
   * and emits one `'status-changed'` event.
   *
   * **Contract invariants:**
   * - MUST NOT enqueue a write-queue op. The pipeline calls this from inside
   *   its own `reconcile-ws-events` op handler — re-entry would deadlock.
   * - The caller already holds the command records (loaded at batch setup).
   *   This method must not re-read them from storage.
   */
  async batchUpdateSyncStatus(params: {
    applied?: Iterable<CommandRecord<TLink, TCommand>>
  }): Promise<void> {
    if (!params.applied) return

    const now = Date.now()
    const updates: Array<{
      commandId: string
      updates: Partial<CommandRecord<TLink, TCommand>>
    }> = []

    const appliedList: CommandRecord<TLink, TCommand>[] = []
    for (const command of params.applied) {
      appliedList.push(command)
      updates.push({
        commandId: command.commandId,
        updates: {
          status: 'applied',
          updatedAt: now,
        },
      })
    }

    if (updates.length === 0) return

    // Mutates in-memory references, marks dirty for async flush
    this.commandStore.batchUpdate(updates)

    // commands are mutated in place — they already have the new values
    for (const command of appliedList) {
      logProvider.log.debug(
        { commandId: command.commandId, from: 'succeeded', to: 'applied' },
        'Command status changed (pipeline applied)',
      )
      this.emitCommandEvent('status-changed', command, 'succeeded')
      this.eventBus.emit('command:status-changed', {
        commandId: command.commandId,
        status: 'applied',
        previousStatus: 'succeeded',
        cacheKey: command.cacheKey,
      })
    }
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

  /**
   * Clear all command state for session destroy.
   * Pauses, clears retry timers, waits for in-flight, clears anticipated event tracking, deletes all commands.
   */
  async clearAll(): Promise<void> {
    await this.reset()
    await this.anticipatedEventHandler.clearAll()
    await this.fileStore.clear()
    await this.commandStore.deleteAll()
    await this.mappingStore.deleteAll()
    this.chains.clear()
    logProvider.log.debug('Command queue cleared')
  }

  getIdMapping(clientId: EntityId): { serverId: string } | undefined {
    const mapping = this.mappingStore.get(entityIdToString(clientId))
    if (!mapping) return undefined
    return { serverId: mapping.serverId }
  }

  /**
   * Reset the command queue for a session change.
   * Pauses, clears retry timers, and waits for in-flight processing to settle.
   */
  async reset(): Promise<void> {
    // pause() flips _paused synchronously before yielding, so timers cleared
    // below cannot schedule new processing passes (processPendingCommands
    // bails on _paused). Done this way rather than `await pause()` then
    // clear so timers are freed before the drain settles.
    const paused = this.pause()

    for (const timerId of this.retryTimers) {
      clearTimeout(timerId)
    }
    this.retryTimers.clear()

    await paused
    logProvider.log.debug('Command queue reset')
  }

  async pause(): Promise<void> {
    this._paused = true
    logProvider.log.debug('Command queue pausing')
    if (this.processingPromise) {
      // Pause never rejects: the caller's contract is "work has stopped."
      // Whether in-flight work succeeded, failed, or threw is incidental —
      // by the time this settles, nothing new will be picked up.
      try {
        await this.processingPromise
      } catch (err) {
        logProvider.log.error({ err }, 'In-flight processing failed during pause')
      }
    }
    this.eventBus.emit('commandqueue:paused', {})
  }

  async resume(): Promise<void> {
    this._paused = false
    logProvider.log.debug('Command queue resuming')
    await this.processPendingCommands()
    this.eventBus.emit('commandqueue:resumed', {})
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
 * One candidate mapping produced by {@link CommandQueue.collectIdMappingCandidates}.
 */
export interface IdMappingCandidate<TLink extends Link> {
  aggregate: AggregateConfig<TLink>
  clientId: string
  serverId: string
  nextExpectedRevision?: string
}

/**
 * Full result of {@link CommandQueue.collectIdMappingCandidates}: candidate
 * id mappings plus the set of affected streams the response did not cover
 * with a parsable revision.
 */
export interface CollectedIdMappings<TLink extends Link> {
  candidates: IdMappingCandidate<TLink>[]
  uncoveredStreams: string[]
}

/**
 * Parse a server-provided `nextExpectedRevision` string into a bigint.
 * Returns `undefined` when the value is missing, non-string, or not a valid
 * bigint literal. Callers treat `undefined` as "uncovered" and surface a
 * single warning log at the extraction site.
 */
export function parseExpectedRevision(value: unknown): bigint | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}
