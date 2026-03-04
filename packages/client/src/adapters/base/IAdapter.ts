/**
 * Adapter types shared across all execution modes.
 */

import type { Observable } from 'rxjs'
import type { EventBus } from '../../core/events/EventBus.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { IStorage } from '../../storage/IStorage.js'
import type { ExecutionMode } from '../../types/config.js'
import type { LibraryEvent } from '../../types/events.js'

/**
 * Adapter status.
 */
export type AdapterStatus = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'closed'

/**
 * Base adapter interface that all mode adapters must implement.
 */
export interface IAdapter {
  /**
   * Execution mode of this adapter.
   */
  readonly mode: ExecutionMode

  /**
   * Current adapter status.
   */
  readonly status: AdapterStatus

  /**
   * Observable of library events.
   */
  readonly events$: Observable<LibraryEvent>

  /**
   * Event bus instance for wiring core components.
   */
  readonly eventBus: EventBus

  /**
   * Session manager instance.
   */
  readonly sessionManager: SessionManager

  /**
   * Storage instance.
   */
  readonly storage: IStorage

  /**
   * Initialize the adapter.
   */
  initialize(): Promise<void>

  /**
   * Close the adapter and release resources.
   */
  close(): Promise<void>
}
