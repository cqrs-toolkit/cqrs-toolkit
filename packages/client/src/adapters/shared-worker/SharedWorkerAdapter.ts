/**
 * SharedWorker adapter (Mode C) - Window-side proxy.
 *
 * Each tab:
 * 1. Spawns a per-tab DedicatedWorker for SQLite I/O
 * 2. Probes OPFS via that worker
 * 3. Connects to the SharedWorker (which owns the CQRS execution stack)
 * 4. Transfers a MessagePort bridging SharedWorker ↔ SQLite worker
 * 5. Competes for active-tab status via Web Locks
 * 6. Waits for the orchestrator to be ready
 * 7. Creates proxy objects for main-thread consumers
 *
 * Tab changeover is transparent: the SharedWorker switches its RemoteSqliteDb
 * target when a new tab wins the Web Lock. WebSocket stays connected, command
 * queue keeps running, in-flight operations don't restart.
 */

import { type Link, logProvider } from '@meticoeus/ddd-es'
import { Observable, Subject, Subscription, interval, map, share, takeUntil } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import { serialize } from '../../protocol/serialization.js'
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
 * CacheManagerProxy subclass that tracks held keys window-side (spec §10.6.3).
 * The localHolds set is the window's authoritative list of current data requirements,
 * independent of the worker. Used to restore holds after worker restart (§10.6.4).
 */
class SharedWorkerCacheManagerProxy<TLink extends Link> extends CacheManagerProxy<TLink> {
  private readonly localHolds = new Set<string>()

  override async hold(key: string): Promise<void> {
    await super.hold(key)
    this.localHolds.add(key)
  }

  override async release(key: string): Promise<void> {
    await super.release(key)
    this.localHolds.delete(key)
  }

  getHeldKeys(): string[] {
    return Array.from(this.localHolds)
  }

  clearHeldKeys(): void {
    this.localHolds.clear()
  }
}

/**
 * Configuration for SharedWorkerAdapter.
 */
export interface SharedWorkerAdapterConfig {
  /** URL to the consumer's SharedWorker script */
  workerUrl: string
  /** Per-tab SQLite DedicatedWorker URL for Mode C */
  sqliteWorkerUrl: string
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeout?: number
  /** Heartbeat interval in milliseconds (default: 10000) */
  heartbeatInterval?: number
}

const DEFAULT_HEARTBEAT_INTERVAL = 10000

/**
 * Web Locks lock name for Mode C active-tab election.
 */
const ACTIVE_TAB_LOCK_NAME = 'cqrs-client-active-tab'

/**
 * SharedWorker adapter for multi-tab offline support.
 *
 * This adapter:
 * - Spawns a per-tab DedicatedWorker for SQLite I/O
 * - Connects to a SharedWorker that owns all CQRS components
 * - Bridges the SQLite worker to the SharedWorker via MessageChannel
 * - Competes for active-tab status via Web Locks
 * - Provides proxy objects for main-thread consumers
 * - Handles window registration and heartbeats
 * - Restores holds after worker restarts
 */
export class SharedWorkerAdapter<TLink extends Link> implements IWorkerAdapter<TLink> {
  readonly mode = 'shared-worker' as const

  private readonly config: SharedWorkerAdapterConfig
  private readonly windowId: string
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _isActive = false
  private _commandQueue: CommandQueueProxy<TLink> | undefined
  private _queryManager: QueryManagerProxy<TLink> | undefined
  private _cacheManager: SharedWorkerCacheManagerProxy<TLink> | undefined
  private _syncManager: SyncManagerProxy<TLink> | undefined
  private _events$: Observable<LibraryEvent<TLink>> | undefined

  private sharedWorker: SharedWorker | undefined
  private sqliteWorker: Worker | undefined
  private channel: WorkerMessageChannel | undefined
  private heartbeatSubscription: Subscription | undefined
  private currentWorkerInstanceId: string | undefined
  private beforeUnloadHandler: (() => void) | undefined

  constructor(config: SharedWorkerAdapterConfig) {
    this.config = config
    this.windowId = generateId()
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent<TLink>> {
    assert(this._events$, 'Adapter not initialized')
    return this._events$
  }

  get commandQueue(): ICommandQueue<TLink> {
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

  get role(): 'leader' | 'standby' {
    return this._isActive ? 'leader' : 'standby'
  }

  async enableDebug(): Promise<void> {
    assert(this.channel, 'Adapter not initialized')
    await this.channel.request('debug.enable')
  }

  async debugQuery<T>(method: string, args?: unknown[]): Promise<T> {
    assert(this.channel, 'Adapter not initialized')
    return this.channel.request(method, args) as Promise<T>
  }

  /**
   * Initialize the adapter.
   *
   * @throws OpfsUnavailableException if OPFS probe fails in the SQLite worker
   */
  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)

    this._status = 'initializing'

    try {
      // 1. Spawn per-tab DedicatedWorker for SQLite
      this.sqliteWorker = new Worker(this.config.sqliteWorkerUrl, {
        type: 'module',
        name: 'cqrs-sqlite',
      })

      // 2. Probe OPFS via the SQLite worker
      const probeOk = await probeSqliteWorker(this.sqliteWorker)
      if (!probeOk) {
        throw new OpfsUnavailableException()
      }

      // 3. Connect to SharedWorker
      this.sharedWorker = new SharedWorker(this.config.workerUrl, {
        type: 'module',
        name: 'cqrs-client',
      })

      // 4. Create message channel on SharedWorker port
      this.channel = new WorkerMessageChannel(this.sharedWorker.port, {
        requestTimeout: this.config.requestTimeout,
      })
      this.channel.connect(this.sharedWorker.port)
      this.sharedWorker.port.start()

      // Build shared broadcast observable for proxies
      const broadcastEvents$ = this.channel.libraryEvents$.pipe(share(), takeUntil(this.destroy$))

      // Build events$ observable for consumers
      this._events$ = broadcastEvents$.pipe(
        map(
          (event: EventMessage): LibraryEvent<TLink> => ({
            type: event.eventName as LibraryEvent<TLink>['type'],
            data: event.data as LibraryEvent<TLink>['data'],
            timestamp: Date.now(),
            debug: event.debug,
          }),
        ),
      )

      // Listen for worker instance changes (restarts)
      this.channel.workerInstanceChanges$.pipe(takeUntil(this.destroy$)).subscribe((instanceId) => {
        this.handleWorkerInstanceChange(instanceId)
      })

      // 5. Register this window
      const registration = await this.channel.register(this.windowId)
      if (!registration.success) {
        throw new Error(`Failed to register window: ${registration.error}`)
      }
      this.currentWorkerInstanceId = registration.workerInstanceId

      // Start heartbeat
      this.startHeartbeat()

      // 6. Create MessageChannel bridging SharedWorker ↔ SQLite worker
      const bridge = new MessageChannel()

      // Transfer portA to SharedWorker with coordinator:worker-port message
      this.sharedWorker.port.postMessage(
        serialize({ type: 'coordinator:worker-port', windowId: this.windowId }),
        [bridge.port1],
      )

      // Transfer portB to SQLite worker with set-routing-port message
      this.sqliteWorker.postMessage({ type: 'set-routing-port' }, [bridge.port2])

      // 6b. Register pagehide handler for fast tab-death notification.
      // pagehide fires reliably for reload, close, and hard navigation on desktop.
      // Terminating the SQLite worker explicitly triggers faster OPFS handle release.
      this.beforeUnloadHandler = () => {
        this.sharedWorker?.port.postMessage(
          serialize({ type: 'coordinator:tab-closing', windowId: this.windowId }),
        )
        this.sqliteWorker?.terminate()
      }
      window.addEventListener('pagehide', this.beforeUnloadHandler)

      // 7. Acquire Web Lock for active tab election
      // Fire-and-forget: the lock callback holds indefinitely. When this tab
      // becomes active, it notifies the SharedWorker. The lock auto-releases
      // when the tab unloads.
      navigator.locks.request(ACTIVE_TAB_LOCK_NAME, () => {
        this._isActive = true
        this.sharedWorker?.port.postMessage(
          serialize({ type: 'coordinator:set-active', windowId: this.windowId }),
        )
        // Hold the lock until page unloads
        return new Promise(() => {})
      })

      // 8. Wait for orchestrator ready
      await this.channel.request('orchestrator.initialize')

      // 9. Create proxy objects
      this._commandQueue = new CommandQueueProxy(this.channel, broadcastEvents$)
      this._queryManager = new QueryManagerProxy<TLink>(this.channel, broadcastEvents$)
      this._cacheManager = new SharedWorkerCacheManagerProxy<TLink>(this.channel)
      this._syncManager = new SyncManagerProxy<TLink>(this.channel, broadcastEvents$)

      // 10. Sync connectivity state from worker
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

    // Remove pagehide handler (close() handles cleanup explicitly)
    if (this.beforeUnloadHandler) {
      window.removeEventListener('pagehide', this.beforeUnloadHandler)
      this.beforeUnloadHandler = undefined
    }

    // Stop heartbeat
    if (this.heartbeatSubscription) {
      this.heartbeatSubscription.unsubscribe()
      this.heartbeatSubscription = undefined
    }

    // Notify SharedWorker this tab is closing
    if (this.sharedWorker) {
      this.sharedWorker.port.postMessage(
        serialize({ type: 'coordinator:tab-closing', windowId: this.windowId }),
      )
    }

    // Unregister window and destroy channel
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

    // Close SharedWorker connection
    if (this.sharedWorker) {
      this.sharedWorker.port.close()
      this.sharedWorker = undefined
    }

    // Terminate per-tab SQLite worker
    if (this.sqliteWorker) {
      this.sqliteWorker.terminate()
      this.sqliteWorker = undefined
    }

    // Web Lock auto-releases when the page unloads
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
    if (!this.channel || !this._cacheManager) return

    const cacheKeys = this._cacheManager.getHeldKeys()
    if (cacheKeys.length === 0) return

    try {
      const response = await this.channel.restoreHolds(this.windowId, cacheKeys)

      // Remove keys that failed to restore (no longer exist in storage after restart)
      for (const failedKey of response.failedKeys) {
        this._cacheManager.release(failedKey).catch(() => {})
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

// ---------------------------------------------------------------------------
// OPFS probe via SQLite worker
// ---------------------------------------------------------------------------

/**
 * Send a probe message to the SQLite worker and wait for the result.
 *
 * @returns `true` if OPFS is available, `false` otherwise
 */
function probeSqliteWorker(worker: Worker): Promise<boolean> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent<{ type: string; success: boolean }>) => {
      if (event.data.type === 'probe-result') {
        worker.removeEventListener('message', handler)
        resolve(event.data.success)
      }
    }
    worker.addEventListener('message', handler)
    worker.postMessage({ type: 'probe' })
  })
}
