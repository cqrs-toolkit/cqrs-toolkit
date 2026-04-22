/**
 * Event processor runner.
 *
 * TODO: All public methods on this class are dead. The new 6-phase reconcile
 * pipeline in SyncManager runs processors inline and writes to the read model
 * store directly. The anticipated event path (apply-anticipated) that was the
 * last caller has been removed. This class is kept as a shell because:
 *   - Bootstrap/wiring code still constructs it (cleanup deferred)
 *   - It may be repurposed for anticipated event processing once that path
 *     is wired through the new pipeline
 *   - The ParsedEvent and ProcessEventResult types are still exported from
 *     this module
 */

import { Link } from '@meticoeus/ddd-es'
import type { EventPersistence } from '../../types/events.js'
import { EnqueueCommand } from '../../types/index.js'
import type { IAnticipatedEventHandler } from '../command-lifecycle/IAnticipatedEventHandler.js'
import type { EventBus } from '../events/EventBus.js'
import type { ReadModelStore } from '../read-model-store/ReadModelStore.js'
import { EventProcessorRegistry } from './EventProcessorRegistry.js'
import type { InvalidateSignal } from './types.js'

/**
 * Parsed event for processing.
 */
export interface ParsedEvent {
  id: string
  type: string
  streamId: string
  persistence: EventPersistence
  data: unknown
  commandId?: string
  revision?: bigint
  position?: bigint
  cacheKey: string
}

/**
 * Result of processing one or more events.
 */
export interface ProcessEventResult {
  updatedIds: string[]
  invalidated: boolean
}

/**
 * Event processor runner.
 */
export class EventProcessorRunner<TLink extends Link, TCommand extends EnqueueCommand> {
  constructor(
    private readonly eventBus: EventBus<TLink>,
    private readonly registry: EventProcessorRegistry,
    private readonly readModelStore: ReadModelStore<TLink, TCommand>,
    /** Anticipated event handler for create reconciliation. Optional — only needed with command handlers. */
    private anticipatedEventHandler?: IAnticipatedEventHandler<TLink, TCommand>,
  ) {}

  /**
   * Set the anticipated event handler after construction (breaks circular dependency
   * when the handler needs the runner and the runner needs the handler).
   */
  setAnticipatedEventHandler(handler: IAnticipatedEventHandler<TLink, TCommand>): void {
    this.anticipatedEventHandler = handler
  }
}

/**
 * Type guard for InvalidateSignal.
 */
function isInvalidateSignal(value: unknown): value is InvalidateSignal {
  return (
    typeof value === 'object' &&
    value !== null &&
    'invalidate' in value &&
    value.invalidate === true
  )
}
