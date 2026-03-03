/**
 * Dedicated Worker adapter (Mode C) - Window-side proxy.
 *
 * This adapter runs in the main window context and communicates
 * with a Dedicated Worker that manages the SQLite storage.
 * Only one tab may be open at a time (enforced by tab lock).
 */

import { Observable, Subject, takeUntil } from 'rxjs'
import { EventBus } from '../../core/events/EventBus.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { IStorage } from '../../storage/IStorage.js'
import type { ExecutionMode, ResolvedConfig } from '../../types/config.js'
import type { LibraryEvent } from '../../types/events.js'
import { generateId } from '../../utils/uuid.js'
import type { AdapterStatus } from '../base/BaseAdapter.js'
import { DedicatedWorkerStorageProxy } from './DedicatedWorkerStorageProxy.js'

/**
 * Configuration for DedicatedWorkerAdapter.
 */
export interface DedicatedWorkerAdapterConfig extends ResolvedConfig {
  /** URL to the Dedicated Worker script */
  workerUrl: string
}

/**
 * Error thrown when tab lock cannot be acquired.
 */
export class TabLockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TabLockError'
  }
}

/**
 * Dedicated Worker adapter for single-tab offline support.
 *
 * This adapter:
 * - Connects to a Dedicated Worker that manages SQLite storage
 * - Enforces single-tab operation via tab lock
 * - Provides a storage proxy for window-side code
 */
export class DedicatedWorkerAdapter {
  readonly mode: ExecutionMode = 'dedicated-worker'

  private readonly config: DedicatedWorkerAdapterConfig
  readonly eventBus: EventBus
  private readonly tabId: string
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _storage: DedicatedWorkerStorageProxy | null = null
  private _sessionManager: SessionManager | null = null

  private worker: Worker | null = null
  private channel: WorkerMessageChannel | null = null

  constructor(config: DedicatedWorkerAdapterConfig) {
    this.config = config
    this.eventBus = new EventBus()
    this.tabId = generateId()
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
   *
   * @throws TabLockError if another tab already has the lock
   */
  async initialize(): Promise<void> {
    if (this._status !== 'uninitialized') {
      throw new Error(`Cannot initialize adapter in status: ${this._status}`)
    }

    this._status = 'initializing'

    try {
      // Create Dedicated Worker
      this.worker = new Worker(this.config.workerUrl, {
        type: 'module',
        name: 'cqrs-client-storage',
      })

      // Create message channel
      this.channel = new WorkerMessageChannel(this.worker, {
        requestTimeout: this.config.network.timeout,
      })

      // Connect to worker
      this.channel.connect(this.worker)

      // Listen for library events from worker
      this.channel.libraryEvents$
        .pipe(takeUntil(this.destroy$))
        .subscribe((event: EventMessage) => {
          this.eventBus.emit(
            event.eventName as LibraryEvent['type'],
            event.payload as LibraryEvent['payload'],
          )
        })

      // Request tab lock
      const lockResponse = await this.channel.requestTabLock(this.tabId)
      if (!lockResponse.acquired) {
        throw new TabLockError(
          `This app is already open in another tab. Only one tab may be open at a time.`,
        )
      }

      // Run worker setup scripts (e.g., logger bootstrap)
      if (this.config.workerSetup?.length) {
        await this.channel.request('worker.setup', [this.config.workerSetup])
      }

      // Create storage proxy
      this._storage = new DedicatedWorkerStorageProxy(this.channel)
      await this._storage.initialize()

      // Create session manager
      this._sessionManager = new SessionManager({
        storage: this._storage,
        eventBus: this.eventBus,
      })
      await this._sessionManager.initialize()

      // Set up beforeunload to release lock
      this.setupBeforeUnload()

      this._status = 'ready'
    } catch (error) {
      this._status = 'error'

      // Clean up worker if we failed
      if (this.worker) {
        this.worker.terminate()
        this.worker = null
      }

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

    // Release tab lock
    if (this.channel) {
      this.channel.releaseTabLock(this.tabId)
      this.channel.destroy()
      this.channel = null
    }

    // Close storage proxy
    if (this._storage) {
      await this._storage.close()
      this._storage = null
    }

    // Signal destroy
    this.destroy$.next()
    this.destroy$.complete()

    // Complete event bus
    this.eventBus.complete()

    // Terminate worker
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this._status = 'closed'
  }

  private setupBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.channel) {
          this.channel.releaseTabLock(this.tabId)
        }
      })
    }
  }
}
