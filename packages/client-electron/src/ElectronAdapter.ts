/**
 * Electron renderer-side adapter.
 *
 * Receives a standard Web MessagePort (transferred from the main process
 * via the preload bridge) and wraps it with the same proxy objects used
 * by the browser worker modes.
 */

import type {
  AdapterStatus,
  CqrsClientSyncManager,
  EnqueueCommand,
  ICacheManager,
  ICommandQueue,
  IQueryManager,
  IWorkerAdapter,
  LibraryEvent,
} from '@cqrs-toolkit/client'
import { protocol } from '@cqrs-toolkit/client'
import {
  CacheManagerProxy,
  CommandQueueProxy,
  QueryManagerProxy,
  SyncManagerProxy,
} from '@cqrs-toolkit/client/internals'
import { assert } from '@cqrs-toolkit/client/utils'
import type { Link } from '@meticoeus/ddd-es'
import { Observable, Subject, map, share, takeUntil } from 'rxjs'
import { ElectronCommandFileStore } from './ElectronCommandFileStore.js'

/**
 * Configuration for the Electron adapter.
 */
export interface ElectronAdapterConfig {
  /** Standard Web MessagePort connected to the utility process. */
  port: MessagePort
  /** Request timeout in milliseconds (default: 30000). */
  requestTimeout?: number
}

/**
 * Electron adapter — implements IWorkerAdapter for the renderer process.
 *
 * Simplified compared to DedicatedWorkerAdapter:
 * - No Web Locks (Electron manages windows)
 * - No worker spawning (main process bridge handles it)
 * - No OPFS file store (FsCommandFileStore runs in the utility process)
 */
export class ElectronAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements IWorkerAdapter<TLink, TCommand> {
  readonly kind = 'worker' as const
  readonly role = 'leader' as const

  private readonly config: ElectronAdapterConfig
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _commandQueue: CommandQueueProxy<TLink, TCommand> | undefined
  private _queryManager: QueryManagerProxy<TLink> | undefined
  private _cacheManager: CacheManagerProxy<TLink> | undefined
  private _syncManager: SyncManagerProxy<TLink> | undefined
  private _events$: Observable<LibraryEvent<TLink>> | undefined

  private _channel: protocol.WorkerMessageChannel | undefined

  constructor(config: ElectronAdapterConfig) {
    this.config = config
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent<TLink>> {
    assert(this._events$, 'Adapter not initialized')
    return this._events$
  }

  get channel(): protocol.WorkerMessageChannel {
    assert(this._channel, 'Adapter not initialized')
    return this._channel
  }

  get commandQueue(): ICommandQueue<TLink, TCommand> {
    assert(this._commandQueue, 'Adapter not initialized')
    return this._commandQueue
  }

  get queryManager(): IQueryManager<TLink> {
    assert(this._queryManager, 'Adapter not initialized')
    return this._queryManager
  }

  get cacheManager(): ICacheManager<TLink> {
    assert(this._cacheManager, 'Adapter not initialized')
    return this._cacheManager
  }

  get syncManager(): CqrsClientSyncManager<TLink> {
    assert(this._syncManager, 'Adapter not initialized')
    return this._syncManager
  }

  async enableDebug(): Promise<void> {
    assert(this._channel, 'Adapter not initialized')
    await this._channel.request('debug.enable')
  }

  async debugQuery<T>(method: string, args?: unknown[]): Promise<T> {
    assert(this._channel, 'Adapter not initialized')
    return this._channel.request(method, args) as Promise<T>
  }

  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)
    this._status = 'initializing'

    try {
      const port = this.config.port

      // Create message channel targeting the port
      this._channel = new protocol.WorkerMessageChannel(port, {
        requestTimeout: this.config.requestTimeout,
      })
      this._channel.connect(port)
      port.start()

      // Build shared broadcast observable for proxies
      const broadcastEvents$ = this._channel.libraryEvents$.pipe(share(), takeUntil(this.destroy$))

      // Build events$ observable for consumers
      this._events$ = broadcastEvents$.pipe(
        map(
          (event: protocol.EventMessage): LibraryEvent<TLink> => ({
            type: event.eventName as LibraryEvent<TLink>['type'],
            data: event.data as LibraryEvent<TLink>['data'],
            timestamp: Date.now(),
            debug: event.debug,
          }),
        ),
      )

      // Trigger utility-process-side orchestrator initialization
      await this._channel.request('orchestrator.initialize')

      // Create proxy objects
      const fileStore = new ElectronCommandFileStore(this._channel)
      this._commandQueue = new CommandQueueProxy(this._channel, fileStore, broadcastEvents$)
      const windowId = crypto.randomUUID()
      this._queryManager = new QueryManagerProxy<TLink>(this._channel, broadcastEvents$, windowId)
      this._cacheManager = new CacheManagerProxy<TLink>(this._channel, windowId)
      this._syncManager = new SyncManagerProxy<TLink>(this._channel, broadcastEvents$)

      // Sync connectivity state from the worker
      await this._syncManager.syncState()

      this._status = 'ready'
    } catch (error) {
      this._status = 'error'
      throw error
    }
  }

  async close(): Promise<void> {
    if (this._status === 'closed') return

    // Tell the utility process to close the orchestrator
    if (this._channel) {
      try {
        await this._channel.request('orchestrator.close')
      } catch {
        // Utility process may already be dead
      }
      this._channel.destroy()
      this._channel = undefined
    }

    // Destroy proxies
    this._commandQueue?.destroy()
    this._syncManager?.destroy()

    // Signal destroy
    this.destroy$.next()
    this.destroy$.complete()

    // Close the MessagePort if available
    if (typeof this.config.port.close === 'function') {
      this.config.port.close()
    }

    this._status = 'closed'
  }
}
