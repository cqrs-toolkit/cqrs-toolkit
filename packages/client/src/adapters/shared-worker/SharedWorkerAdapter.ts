/**
 * SharedWorker adapter (Mode B) - Window-side proxy.
 *
 * Connects to a consumer-provided SharedWorker that owns all CQRS components.
 * The main thread gets proxy objects for CommandQueue, QueryManager,
 * CacheManager, and SyncManager. Handles window registration, heartbeats,
 * and hold restoration after worker restarts.
 */

import { logProvider } from '@meticoeus/ddd-es'
import { Observable, Subject, Subscription, interval, map, share, takeUntil } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { LibraryEvent } from '../../types/events.js'
import { assert } from '../../utils/assert.js'
import { generateId } from '../../utils/uuid.js'
import type { AdapterStatus, IWorkerAdapter } from '../base/IAdapter.js'
import { CacheManagerProxy } from '../proxy/CacheManagerProxy.js'
import { CommandQueueProxy } from '../proxy/CommandQueueProxy.js'
import { QueryManagerProxy } from '../proxy/QueryManagerProxy.js'
import { SyncManagerProxy } from '../proxy/SyncManagerProxy.js'

/**
 * Configuration for SharedWorkerAdapter.
 */
export interface SharedWorkerAdapterConfig {
  /** URL to the consumer's SharedWorker script */
  workerUrl: string
  /** URL to the consumer's SQLite worker script (passed to worker via RPC) */
  sqliteWorkerUrl?: string
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeout?: number
  /** Heartbeat interval in milliseconds (default: 10000) */
  heartbeatInterval?: number
}

const DEFAULT_HEARTBEAT_INTERVAL = 10000

/**
 * SharedWorker adapter for multi-tab offline support.
 *
 * This adapter:
 * - Connects to a SharedWorker that owns all CQRS components
 * - Provides proxy objects for main-thread consumers
 * - Handles window registration and heartbeats
 * - Restores holds after worker restarts
 */
export class SharedWorkerAdapter implements IWorkerAdapter {
  readonly mode = 'shared-worker' as const

  private readonly config: SharedWorkerAdapterConfig
  private readonly windowId: string
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _commandQueue: CommandQueueProxy | undefined
  private _queryManager: QueryManagerProxy | undefined
  private _cacheManager: CacheManagerProxy | undefined
  private _syncManager: SyncManagerProxy | undefined
  private _events$: Observable<LibraryEvent> | undefined

  private worker: SharedWorker | undefined
  private channel: WorkerMessageChannel | undefined
  private heartbeatSubscription: Subscription | undefined
  private currentWorkerInstanceId: string | undefined

  /** Cache keys held by this window (for restoration after worker restart) */
  private readonly localHolds = new Set<string>()

  constructor(config: SharedWorkerAdapterConfig) {
    this.config = config
    this.windowId = generateId()
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent> {
    assert(this._events$, 'Adapter not initialized')
    return this._events$
  }

  get commandQueue(): ICommandQueue {
    assert(this._commandQueue, 'Adapter not initialized')
    return this._commandQueue
  }

  get queryManager(): IQueryManager {
    assert(this._queryManager, 'Adapter not initialized')
    return this._queryManager
  }

  get cacheManager(): ICacheManager {
    assert(this._cacheManager, 'Adapter not initialized')
    return this._cacheManager
  }

  get syncManager(): CqrsClientSyncManager {
    assert(this._syncManager, 'Adapter not initialized')
    return this._syncManager
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
        name: 'cqrs-client',
      })

      // Create message channel
      this.channel = new WorkerMessageChannel(this.worker.port, {
        requestTimeout: this.config.requestTimeout,
      })

      // Connect to worker
      this.channel.connect(this.worker.port)
      this.worker.port.start()

      // Build shared broadcast observable for proxies
      const broadcastEvents$ = this.channel.libraryEvents$.pipe(share(), takeUntil(this.destroy$))

      // Build events$ observable for consumers
      this._events$ = broadcastEvents$.pipe(
        map(
          (event: EventMessage): LibraryEvent => ({
            type: event.eventName as LibraryEvent['type'],
            payload: event.payload as LibraryEvent['payload'],
            timestamp: Date.now(),
          }),
        ),
      )

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

      // Start heartbeat
      this.startHeartbeat()

      // Trigger worker-side orchestrator initialization (pass sqlite worker URL from main thread)
      await this.channel.request('orchestrator.initialize', [this.config.sqliteWorkerUrl])

      // Create proxy objects
      this._commandQueue = new CommandQueueProxy(this.channel, broadcastEvents$)
      this._queryManager = new QueryManagerProxy(this.channel, broadcastEvents$)
      this._cacheManager = new CacheManagerProxy(this.channel)
      this._syncManager = new SyncManagerProxy(this.channel, broadcastEvents$)

      // Sync connectivity state from worker
      await this._syncManager.syncState()

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

    // Destroy proxies
    this._commandQueue?.destroy()
    this._syncManager?.destroy()

    // Signal destroy
    this.destroy$.next()
    this.destroy$.complete()

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
