/**
 * Dedicated Worker adapter (Mode C) - Window-side proxy.
 *
 * Connects to a consumer-provided Dedicated Worker that owns all CQRS
 * components. The main thread gets proxy objects for CommandQueue,
 * QueryManager, CacheManager, and SyncManager.
 */

import { Observable, Subject, map, share, takeUntil } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import { RpcError, WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { LibraryEvent } from '../../types/events.js'
import { assert } from '../../utils/assert.js'
import { generateId } from '../../utils/uuid.js'
import type { AdapterStatus, IWorkerAdapter } from '../base/IAdapter.js'
import { CacheManagerProxy } from '../proxy/CacheManagerProxy.js'
import { CommandQueueProxy } from '../proxy/CommandQueueProxy.js'
import { QueryManagerProxy } from '../proxy/QueryManagerProxy.js'
import { SyncManagerProxy } from '../proxy/SyncManagerProxy.js'
import { OpfsUnavailableException } from '../worker-core/probeOpfs.js'

/**
 * Configuration for DedicatedWorkerAdapter.
 */
export interface DedicatedWorkerAdapterConfig {
  /** URL to the consumer's Dedicated Worker script */
  workerUrl: string
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeout?: number
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
 * - Connects to a Dedicated Worker that owns all CQRS components
 * - Enforces single-tab operation via tab lock
 * - Provides proxy objects for main-thread consumers
 */
export class DedicatedWorkerAdapter implements IWorkerAdapter {
  readonly mode = 'dedicated-worker' as const

  private readonly config: DedicatedWorkerAdapterConfig
  private readonly tabId: string
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _commandQueue: CommandQueueProxy | undefined
  private _queryManager: QueryManagerProxy | undefined
  private _cacheManager: CacheManagerProxy | undefined
  private _syncManager: SyncManagerProxy | undefined
  private _events$: Observable<LibraryEvent> | undefined

  private worker: Worker | undefined
  private channel: WorkerMessageChannel | undefined
  private beforeUnloadHandler: (() => void) | undefined

  constructor(config: DedicatedWorkerAdapterConfig) {
    this.config = config
    this.tabId = generateId()
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
   *
   * @throws TabLockError if another tab already has the lock
   */
  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)

    this._status = 'initializing'

    try {
      // Create Dedicated Worker
      this.worker = new Worker(this.config.workerUrl, {
        type: 'module',
        name: 'cqrs-client',
      })

      // Create message channel
      this.channel = new WorkerMessageChannel(this.worker, {
        requestTimeout: this.config.requestTimeout,
      })

      // Connect to worker
      this.channel.connect(this.worker)

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

      // Request tab lock
      const lockResponse = await this.channel.requestTabLock(this.tabId)
      if (!lockResponse.acquired) {
        throw new TabLockError(
          'This app is already open in another tab. Only one tab may be open at a time.',
        )
      }

      // Trigger worker-side orchestrator initialization (includes OPFS probe)
      try {
        await this.channel.request('orchestrator.initialize')
      } catch (error) {
        if (error instanceof RpcError && error.errorCode === 'OPFS_UNAVAILABLE') {
          throw new OpfsUnavailableException()
        }
        throw error
      }

      // Create proxy objects
      this._commandQueue = new CommandQueueProxy(this.channel, broadcastEvents$)
      this._queryManager = new QueryManagerProxy(this.channel, broadcastEvents$)
      this._cacheManager = new CacheManagerProxy(this.channel)
      this._syncManager = new SyncManagerProxy(this.channel, broadcastEvents$)

      // Sync connectivity state from worker
      await this._syncManager.syncState()

      // Set up beforeunload to release lock
      this.setupBeforeUnload()

      this._status = 'ready'
    } catch (error) {
      this._status = 'error'

      // Clean up worker if we failed
      if (this.worker) {
        this.worker.terminate()
        this.worker = undefined
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

    // Remove beforeunload listener
    this.removeBeforeUnload()

    // Tell worker to close orchestrator
    if (this.channel) {
      try {
        await this.channel.request('orchestrator.close')
      } catch {
        // Worker may already be dead
      }
      this.channel.releaseTabLock(this.tabId)
      this.channel.destroy()
      this.channel = undefined
    }

    // Destroy proxies
    this._commandQueue?.destroy()
    this._syncManager?.destroy()

    // Signal destroy
    this.destroy$.next()
    this.destroy$.complete()

    // Terminate worker
    if (this.worker) {
      this.worker.terminate()
      this.worker = undefined
    }

    this._status = 'closed'
  }

  private setupBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      this.beforeUnloadHandler = () => {
        if (this.channel) {
          this.channel.releaseTabLock(this.tabId)
        }
      }
      window.addEventListener('beforeunload', this.beforeUnloadHandler)
    }
  }

  private removeBeforeUnload(): void {
    if (this.beforeUnloadHandler && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler)
      this.beforeUnloadHandler = undefined
    }
  }
}
