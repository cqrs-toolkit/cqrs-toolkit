/**
 * SharedWorker adapter (Mode B) - Window-side proxy.
 *
 * This adapter runs in the main window context and communicates
 * with a SharedWorker that manages the SQLite storage.
 */

import { logProvider } from '@meticoeus/ddd-es'
import assert from 'node:assert'
import { interval, Observable, Subject, Subscription, takeUntil } from 'rxjs'
import { EventBus } from '../../core/events/EventBus.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { IStorage } from '../../storage/IStorage.js'
import type { ExecutionMode, ResolvedConfig } from '../../types/config.js'
import type { LibraryEvent } from '../../types/events.js'
import { generateId } from '../../utils/uuid.js'
import type { AdapterStatus } from '../base/BaseAdapter.js'
import { SharedWorkerStorageProxy } from './SharedWorkerStorageProxy.js'

/**
 * Configuration for SharedWorkerAdapter.
 */
export interface SharedWorkerAdapterConfig extends ResolvedConfig {
  /** URL to the SharedWorker script */
  workerUrl: string
  /** Heartbeat interval in milliseconds (default: 10000) */
  heartbeatInterval?: number
}

const DEFAULT_HEARTBEAT_INTERVAL = 10000

/**
 * SharedWorker adapter for multi-tab offline support.
 *
 * This adapter:
 * - Connects to a SharedWorker that manages SQLite storage
 * - Provides a storage proxy for window-side code
 * - Handles window registration and heartbeats
 * - Restores holds after worker restarts
 */
export class SharedWorkerAdapter {
  readonly mode: ExecutionMode = 'shared-worker'

  private readonly config: SharedWorkerAdapterConfig
  readonly eventBus: EventBus
  private readonly windowId: string
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _storage: SharedWorkerStorageProxy | undefined
  private _sessionManager: SessionManager | undefined

  private worker: SharedWorker | undefined
  private channel: WorkerMessageChannel | undefined
  private heartbeatSubscription: Subscription | undefined
  private currentWorkerInstanceId: string | undefined

  /** Cache keys held by this window (for restoration after restart) */
  private readonly localHolds = new Set<string>()

  constructor(config: SharedWorkerAdapterConfig) {
    this.config = config
    this.eventBus = new EventBus()
    this.windowId = generateId()
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent> {
    return this.eventBus.events$
  }

  get sessionManager(): SessionManager {
    assert(this._sessionManager, 'Adapter not initialized')
    return this._sessionManager
  }

  get storage(): IStorage {
    assert(this._storage, 'Adapter not initialized')
    return this._storage
  }

  /**
   * Initialize the adapter.
   */
  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)

    this._status = 'initializing'

    try {
      // Create SharedWorker
      this.worker = new SharedWorker(this.config.workerUrl, {
        type: 'module',
        name: 'cqrs-client-storage',
      })

      // Create message channel
      this.channel = new WorkerMessageChannel(this.worker.port, {
        requestTimeout: this.config.network.timeout,
      })

      // Connect to worker
      this.channel.connect(this.worker.port)
      this.worker.port.start()

      // Listen for library events from worker
      this.channel.libraryEvents$
        .pipe(takeUntil(this.destroy$))
        .subscribe((event: EventMessage) => {
          this.eventBus.emit(
            event.eventName as LibraryEvent['type'],
            event.payload as LibraryEvent['payload'],
          )
        })

      // Listen for worker instance changes (restarts)
      this.channel.workerInstanceChanges$.pipe(takeUntil(this.destroy$)).subscribe((instanceId) => {
        this.handleWorkerInstanceChange(instanceId)
      })

      // Register this window
      const registration = await this.channel.register(this.windowId)
      if (!registration.success) {
        throw new Error(`Failed to register window: ${registration.error}`)
      }

      this.currentWorkerInstanceId = registration.workerInstanceId

      // Run worker setup scripts (e.g., logger bootstrap)
      if (this.config.workerSetup?.length) {
        await this.channel.request('worker.setup', [this.config.workerSetup])
      }

      // Start heartbeat
      this.startHeartbeat()

      // Create storage proxy
      this._storage = new SharedWorkerStorageProxy(this.channel, this.localHolds)
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

    // Stop heartbeat
    if (this.heartbeatSubscription) {
      this.heartbeatSubscription.unsubscribe()
      this.heartbeatSubscription = undefined
    }

    // Unregister window
    if (this.channel) {
      this.channel.unregister(this.windowId)
      this.channel.destroy()
      this.channel = undefined
    }

    // Close storage proxy
    if (this._storage) {
      await this._storage.close()
      this._storage = undefined
    }

    // Signal destroy
    this.destroy$.next()
    this.destroy$.complete()

    // Complete event bus
    this.eventBus.complete()

    // Close worker connection
    if (this.worker) {
      this.worker.port.close()
      this.worker = undefined
    }

    this._status = 'closed'
  }

  private startHeartbeat(): void {
    const heartbeatInterval = this.config.heartbeatInterval ?? DEFAULT_HEARTBEAT_INTERVAL

    this.heartbeatSubscription = interval(heartbeatInterval)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.channel) {
          this.channel.sendHeartbeat(this.windowId)
        }
      })
  }

  private async handleWorkerInstanceChange(newInstanceId: string): Promise<void> {
    // Check if this is a new worker instance (restart)
    if (this.currentWorkerInstanceId && this.currentWorkerInstanceId !== newInstanceId) {
      // Worker restarted - restore holds
      await this.restoreHolds()
    }

    this.currentWorkerInstanceId = newInstanceId
  }

  private async restoreHolds(): Promise<void> {
    if (!this.channel || this.localHolds.size === 0) {
      return
    }

    const cacheKeys = Array.from(this.localHolds)

    try {
      const response = await this.channel.restoreHolds(this.windowId, cacheKeys)

      // Remove keys that failed to restore (no longer exist)
      for (const failedKey of response.failedKeys) {
        this.localHolds.delete(failedKey)
      }

      // Log warning for failed keys - these cache keys no longer exist
      if (response.failedKeys.length > 0) {
        logProvider.log.warn(
          { failedKeys: response.failedKeys },
          'Failed to restore holds for cache keys (no longer exist)',
        )
      }
    } catch (error) {
      // Log but don't fail - holds being lost is recoverable
      logProvider.log.error({ err: error }, 'Failed to restore holds after worker restart')
    }
  }
}
