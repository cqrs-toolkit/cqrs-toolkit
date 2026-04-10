/**
 * Dedicated Worker adapter (Mode B) - Window-side proxy.
 *
 * Connects to a consumer-provided Dedicated Worker that owns all CQRS
 * components. The main thread gets proxy objects for CommandQueue,
 * QueryManager, CacheManager, and SyncManager.
 *
 * Tab lock is enforced via the Web Locks API on the main thread (spec §0.1.5):
 * the lock is acquired BEFORE spawning the worker, preventing multi-tab races.
 * Web Locks auto-release on page unload — no beforeunload handler needed.
 */

import { assert } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import { Observable, Subject, map, share, takeUntil } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import { OpfsCommandFileStore } from '../../core/command-queue/file-store/OpfsCommandFileStore.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import { RpcError, WorkerMessageChannel } from '../../protocol/MessageChannel.js'
import type { EventMessage } from '../../protocol/messages.js'
import type { LibraryEvent } from '../../types/events.js'
import { EnqueueCommand } from '../../types/index.js'
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
 * Web Locks lock name for Mode B single-tab enforcement.
 */
const TAB_LOCK_NAME = 'cqrs-client-dedicated-tab'

/**
 * Dedicated Worker adapter for single-tab offline support.
 *
 * This adapter:
 * - Acquires a Web Lock to enforce single-tab operation
 * - Connects to a Dedicated Worker that owns all CQRS components
 * - Provides proxy objects for main-thread consumers
 */
export class DedicatedWorkerAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> implements IWorkerAdapter<TLink, TCommand> {
  readonly kind = 'worker' as const
  readonly role = 'leader' as const

  private readonly config: DedicatedWorkerAdapterConfig
  private readonly destroy$ = new Subject<void>()

  private _status: AdapterStatus = 'uninitialized'
  private _commandQueue: CommandQueueProxy<TLink, TCommand> | undefined
  private _queryManager: QueryManagerProxy<TLink> | undefined
  private _cacheManager: CacheManagerProxy<TLink> | undefined
  private _syncManager: SyncManagerProxy<TLink> | undefined
  private _events$: Observable<LibraryEvent<TLink>> | undefined

  private worker: Worker | undefined
  private channel: WorkerMessageChannel | undefined

  constructor(config: DedicatedWorkerAdapterConfig) {
    this.config = config
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent<TLink>> {
    assert(this._events$, 'Adapter not initialized')
    return this._events$
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
   * Acquires a Web Lock for single-tab enforcement before spawning the worker.
   *
   * @throws TabLockError if another tab already has the lock
   */
  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)

    this._status = 'initializing'

    try {
      // 1. Acquire tab lock via Web Locks on main thread (spec §0.1.5)
      const lockAcquired = await acquireTabLock()
      if (!lockAcquired) {
        throw new TabLockError(
          'This app is already open in another tab. Only one tab may be open at a time.',
        )
      }

      // 2. Spawn worker (after lock acquired)
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
          (event: EventMessage): LibraryEvent<TLink> => ({
            type: event.eventName as LibraryEvent<TLink>['type'],
            data: event.data as LibraryEvent<TLink>['data'],
            timestamp: Date.now(),
            debug: event.debug,
          }),
        ),
      )

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
      this._commandQueue = new CommandQueueProxy(
        this.channel,
        new OpfsCommandFileStore(),
        broadcastEvents$,
      )
      const windowId = crypto.randomUUID()
      this._queryManager = new QueryManagerProxy<TLink>(this.channel, broadcastEvents$, windowId)
      this._cacheManager = new CacheManagerProxy<TLink>(this.channel, windowId)
      this._syncManager = new SyncManagerProxy<TLink>(this.channel, broadcastEvents$)

      // Sync connectivity state from worker
      await this._syncManager.syncState()

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

    // Tell worker to close orchestrator
    if (this.channel) {
      try {
        await this.channel.request('orchestrator.close')
      } catch {
        // Worker may already be dead
      }
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

    // Web Lock auto-releases when the page unloads or tab closes
    this._status = 'closed'
  }
}

// ---------------------------------------------------------------------------
// Web Locks tab lock (spec §0.1.5)
// ---------------------------------------------------------------------------

/**
 * Attempt to acquire the Mode B tab lock using Web Locks API.
 *
 * Uses `ifAvailable: true` for a non-blocking probe: if another tab already
 * holds the lock, returns false immediately. If acquired, the lock is held
 * via an unresolved promise until the page unloads.
 *
 * The callback communicates success via a separate deferred promise so that
 * the caller receives `true` immediately while the lock-holding promise
 * (which never resolves) keeps the lock alive in the background.
 *
 * @returns `true` if the lock was acquired, `false` if another tab holds it
 */
async function acquireTabLock(): Promise<boolean> {
  let resolveAcquired: (value: boolean) => void
  const acquired = new Promise<boolean>((resolve) => {
    resolveAcquired = resolve
  })

  // Don't await — the callback's never-resolving promise keeps the lock held
  navigator.locks.request(TAB_LOCK_NAME, { ifAvailable: true }, (lock) => {
    if (!lock) {
      // Another tab holds the lock
      resolveAcquired(false)
      return
    }
    // Signal success to the caller
    resolveAcquired(true)
    // Hold the lock indefinitely — released when page unloads
    return new Promise<void>(() => {})
  })

  return acquired
}
