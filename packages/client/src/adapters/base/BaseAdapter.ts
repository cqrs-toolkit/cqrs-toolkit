/**
 * Base adapter that provides common functionality for all execution modes.
 */

import { Observable } from 'rxjs'
import { EventBus } from '../../core/events/EventBus.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import type { IStorage } from '../../storage/IStorage.js'
import type { ExecutionMode, ResolvedConfig } from '../../types/config.js'
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

/**
 * Base adapter with shared functionality.
 */
export abstract class BaseAdapter implements IAdapter {
  abstract readonly mode: ExecutionMode

  protected readonly config: ResolvedConfig
  readonly eventBus: EventBus
  protected _storage: IStorage | null = null
  protected _sessionManager: SessionManager | null = null
  protected _status: AdapterStatus = 'uninitialized'

  constructor(config: ResolvedConfig) {
    this.config = config
    this.eventBus = new EventBus()
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent> {
    return this.eventBus.events$
  }

  get sessionManager(): SessionManager {
    if (!this._sessionManager) {
      throw new Error('Adapter not initialized')
    }
    return this._sessionManager
  }

  get storage(): IStorage {
    if (!this._storage) {
      throw new Error('Adapter not initialized')
    }
    return this._storage
  }

  /**
   * Initialize the adapter.
   * Subclasses should call super.initialize() first.
   */
  async initialize(): Promise<void> {
    if (this._status !== 'uninitialized') {
      throw new Error(`Cannot initialize adapter in status: ${this._status}`)
    }

    this._status = 'initializing'

    try {
      // Create storage (subclass provides implementation)
      this._storage = await this.createStorage()
      await this._storage.initialize()

      // Create session manager
      this._sessionManager = new SessionManager({
        storage: this._storage,
        eventBus: this.eventBus,
      })
      await this._sessionManager.initialize()

      this._status = 'ready'
    } catch (error) {
      this._status = 'error'
      throw error
    }
  }

  /**
   * Close the adapter and release resources.
   */
  async close(): Promise<void> {
    if (this._status === 'closed') {
      return
    }

    if (this._storage) {
      await this._storage.close()
    }

    this.eventBus.complete()
    this._status = 'closed'
  }

  /**
   * Create the storage instance for this adapter.
   * Subclasses must implement this.
   */
  protected abstract createStorage(): Promise<IStorage>
}
