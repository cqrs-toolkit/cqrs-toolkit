import type { Link } from '@meticoeus/ddd-es'
import type { CommandRecord, EnqueueCommand } from '../../types/commands.js'
import type { IDomainExecutor } from '../../types/domain.js'
import { isDomainSuccess } from '../../types/domain.js'
import type { EntityId } from '../../types/entities.js'
import { entityIdToString } from '../../types/index.js'
import type { IAnticipatedEvent } from '../command-lifecycle/AnticipatedEventShape.js'
import type {
  EventProcessor,
  ProcessorContext,
  ProcessorResult,
  UpdateOperation,
} from '../event-processor/types.js'
import { PrimaryCollectionResolver } from './PrimaryCollectionResolver.js'

/**
 * Build a `collection:entityId` working-state key.
 * Shared with the event-processor output format (`ProcessorResult` → `${collection}:${id}`).
 */
export function stateKey(collection: string, entityId: string): string {
  return `${collection}:${entityId}`
}

/**
 * Apply a single read-model update operation to an in-memory state value.
 * Pure; used to fold anticipated-event processor results into working state during
 * the reconcile walk without touching the read model store.
 */
export function applyOp<T extends object>(
  state: T | undefined,
  op: UpdateOperation<T>,
): T | undefined {
  switch (op.type) {
    case 'set':
      return op.data
    case 'merge':
      return state ? ({ ...state, ...op.data } as T) : (op.data as T)
    case 'delete':
      return undefined
  }
}

/**
 * Inputs to {@link reconcilePendingCommands}. Everything the loop needs is preloaded
 * — no storage access happens inside the function.
 */
export interface ReconcileInput<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> {
  /** `collection:entityId` keys whose server baseline was changed by the incoming event batch. */
  initialDirty: Iterable<string>
  /** Pending commands in queue order (oldest first). */
  commands: readonly CommandRecord<TLink, TCommand>[]
  /** Current anticipated events per command, keyed by commandId. */
  anticipatedEventsByCommand: ReadonlyMap<string, readonly unknown[]>
  /**
   * Server truth per entity after Phase 3 has mutated it (merged/set server
   * event results). This is what a re-running handler sees as its input —
   * the handler receives exactly the post-server-event baseline, no stale
   * client overlays mixed in. The reconcile function only reads this map.
   */
  initialServerState: ReadonlyMap<string, object>
  /**
   * Client overlay projection per entity — the read model's `effectiveData`
   * as loaded from storage at Phase 2. Represents the sum of every clean
   * (not re-run) command's anticipated contribution to the entity. The
   * reconcile fold starts from this map when applying dirty-command events,
   * so contributions from clean commands on the same entity are preserved
   * across the re-run.
   */
  initialClientState: ReadonlyMap<string, object>
  /** Cached aggregate → primary collection lookup. Instantiate once and reuse across calls. */
  primaryCollectionResolver: PrimaryCollectionResolver<TLink, TCommand, TSchema, TEvent>
  /** Domain executor for registration lookup and handler invocation. */
  domainExecutor: IDomainExecutor<TLink, TCommand, TSchema, TEvent>
  /**
   * Registered processors for an anticipated event type. A thin wrapper over
   * `EventProcessorRegistry.getProcessors(eventType, 'Anticipated')`.
   */
  getProcessors(eventType: string): readonly EventProcessor[]
  /**
   * Derive a command's target entity ID — `data.id` for mutates, resolved
   * create entity id for creates. The caller owns this because create resolution
   * currently lives in CommandQueue's private aggregate chain map.
   */
  getEntityIdForCommand(command: CommandRecord<TLink, TCommand>): string | undefined
  /**
   * Build a processor context for a dry-run fold of an anticipated event.
   * Anticipated events have no revision/position.
   * State is passed to processors as the second argument.
   */
  buildProcessorContext(event: unknown, command: CommandRecord<TLink, TCommand>): ProcessorContext
}

/**
 * Outputs produced by the forward walk. The caller writes these in the persistence
 * phase — commands first, then read models and events — inside a single WriteQueue op.
 */
export interface ReconcileOutput {
  /**
   * New anticipated events per command, **only for commands whose handler was re-run**.
   * Commands whose input state did not shift are absent from this map; their existing
   * anticipated events remain unchanged.
   */
  updatedAnticipatedEvents: Map<string, readonly unknown[]>
  /**
   * Client overlay projection after the forward walk. Entries mutated by
   * re-running dirty commands carry fresh object references; entries the
   * reconcile never touched share references with `initialClientState` so
   * the caller's reference-equality check can skip Phase 6 writes for
   * unchanged entries.
   */
  finalClientState: Map<string, object>
  /** Final dirty set. Exposed for diagnostics and tests. */
  finalDirty: Set<string>
}

/**
 * Forward-pass reconciliation over the pending command queue after a server event batch.
 *
 * For each command in queue order:
 *   - If its primary entity key is in the dirty set, re-run the handler against the
 *     current working state, producing new anticipated events.
 *   - Otherwise, reuse its existing anticipated events as-is.
 *   - Either way, fold the events through their registered processors into the
 *     working state, promoting any entity whose state changed into the dirty set
 *     so downstream commands see the shift.
 *
 * Each command is visited exactly once. No iteration, no cycle check — the queue
 * order guarantees termination.
 *
 * The function performs no I/O and is fully synchronous.
 */
export function reconcilePendingCommands<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
>(input: ReconcileInput<TLink, TCommand, TSchema, TEvent>): ReconcileOutput {
  const {
    initialDirty,
    commands,
    anticipatedEventsByCommand,
    initialServerState,
    initialClientState,
    primaryCollectionResolver,
    domainExecutor,
    getProcessors,
    getEntityIdForCommand,
    buildProcessorContext,
  } = input

  const dirty = new Set(initialDirty)
  const clientState = new Map<string, object>(initialClientState)
  const updatedAnticipatedEvents = new Map<string, readonly unknown[]>()

  for (const command of commands) {
    const registration = domainExecutor.getRegistration(command.type)
    if (!registration) continue

    const collection = primaryCollectionResolver.resolve(registration)
    const entityId = getEntityIdForCommand(command)

    // Decide whether to re-run the handler. Only commands whose primary
    // entity key is in the `dirty` set re-run — these are the commands
    // whose input state shifted due to either an upstream server event
    // (Phase 3 additions to `dirty`) or an upstream sibling re-run of
    // another command on the same entity.
    //
    // Handler input = `initialServerState[primaryKey]`. This is the
    // post-server-event baseline produced by Phase 3, with no client
    // overlays mixed in. The handler re-runs against fresh server
    // truth so its produced events aren't tainted by the stale overlay
    // the command previously generated. Chain continuity for downstream
    // dirty commands is preserved through `clientState` (the fold
    // output below).
    let newEvents: readonly unknown[] | undefined
    if (collection && entityId) {
      const primaryKey = stateKey(collection.name, entityId)
      if (dirty.has(primaryKey)) {
        const state = initialServerState.get(primaryKey)
        const result = domainExecutor.handle(
          {
            type: command.type,
            data: command.data,
            path: command.path,
            fileRefs: command.fileRefs,
          },
          state,
          {
            phase: 'updating',
            entityId,
            commandId: command.commandId,
            idStrategy: command.creates?.idStrategy,
          },
        )
        if (isDomainSuccess(result)) {
          newEvents = result.value.anticipatedEvents as readonly unknown[]
          updatedAnticipatedEvents.set(command.commandId, newEvents)
        }
        // On handler failure, leave the command's existing events in
        // place. They aren't re-folded; the store still has the previous
        // overlay, and the caller can surface the error separately.
      }
    }

    // Fold re-run commands' new events into `clientState`. Start from
    // the entry's existing client overlay (pre-reconcile value) so other
    // commands' contributions on the same entity are preserved; fall
    // through to the server baseline if no overlay was loaded. Clean
    // commands are untouched — their contributions sit in `clientState`
    // unchanged from the Phase 2 load.
    if (!newEvents) continue
    for (const event of newEvents) {
      if (typeof event !== 'object' || event === null) continue
      const eventType = (event as { type?: unknown }).type
      if (typeof eventType !== 'string') continue

      const processors = getProcessors(eventType)
      for (const processor of processors) {
        const context = buildProcessorContext(event, command)
        const anticipated = event as IAnticipatedEvent
        const stateKeyForEvent = entityIdToString(anticipated.data.id)
        const handlerState =
          clientState.get(stateKeyForEvent) ?? initialServerState.get(stateKeyForEvent)
        // TODO(types): fix need to cast as any here
        // Processors receive the event's `data` payload directly (not the
        // wrapper), matching `EventProcessorRunner.runProcessor`.
        const result = processor(anticipated.data, handlerState as any, context)
        if (!result) continue
        // TODO: why does this just skip? if the local read model is invalidated we need to throw it
        //  out and persist not to do any more local edits to it
        //  it becomes: state = invalidated and need to trigger reconciliation from server
        if ('invalidate' in result) continue
        const results: ProcessorResult[] = Array.isArray(result) ? result : [result]
        for (const r of results) {
          // Stringify the id via `entityIdToString` for the client-state
          // key. Processors pass `data.id` through to `result.id`, which
          // for temporary-id anticipated events is an EntityRef — the
          // client-state map needs a plain string so it collates with
          // the store row key produced at persist time.
          const rowKey = entityIdToString(r.id as unknown as EntityId)
          if (typeof rowKey !== 'string') continue
          const key = stateKey(r.collection, rowKey)
          // Start fold from the current client overlay for this key, or
          // the server baseline if no overlay has been loaded. This
          // preserves field-level contributions from clean commands on
          // the same entity across a dirty re-run's fold.
          const before = clientState.get(key) ?? initialServerState.get(key)
          const after = applyOp(before, r.update)
          if (after === undefined) {
            if (clientState.has(key)) {
              clientState.delete(key)
              dirty.add(key)
            }
            continue
          }
          if (after !== clientState.get(key)) {
            clientState.set(key, after)
            dirty.add(key)
          }
        }
      }
    }
  }

  return {
    updatedAnticipatedEvents,
    finalClientState: clientState,
    finalDirty: dirty,
  }
}
