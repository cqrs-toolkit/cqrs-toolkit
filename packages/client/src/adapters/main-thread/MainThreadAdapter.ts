/**
 * Main Thread adapter (Mode D).
 *
 * This adapter runs everything in the main thread without workers.
 * It uses SQLite WASM with opfs-sahpool VFS for async-safe main thread access.
 * Only one tab may be open at a time (enforced via Web Locks API or BroadcastChannel).
 */

import { Observable } from 'rxjs'
import { EventBus } from '../../core/events/EventBus.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import type { IStorage } from '../../storage/IStorage.js'
import { SQLiteStorage } from '../../storage/SQLiteStorage.js'
import type { ExecutionMode, ResolvedConfig } from '../../types/config.js'
import type { LibraryEvent } from '../../types/events.js'
import { assert } from '../../utils/assert.js'
import { generateId } from '../../utils/uuid.js'
import type { AdapterStatus, IAdapter } from '../base/IAdapter.js'

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
 * Main Thread adapter for single-tab offline support without workers.
 *
 * This adapter:
 * - Runs SQLite WASM directly in the main thread
 * - Uses opfs-sahpool VFS for async-safe access
 * - Enforces single-tab operation via Web Locks API or BroadcastChannel
 */
export class MainThreadAdapter implements IAdapter {
  readonly mode: ExecutionMode = 'main-thread'

  private readonly config: ResolvedConfig
  readonly eventBus: EventBus
  private readonly tabId: string

  private _status: AdapterStatus = 'uninitialized'
  private _storage: IStorage | undefined
  private _sessionManager: SessionManager | undefined

  private lockController: AbortController | undefined
  private broadcastChannel: BroadcastChannel | undefined
  private beforeUnloadHandler: (() => void) | undefined

  constructor(config: ResolvedConfig) {
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
    assert(this._sessionManager, 'Adapter not initialized')
    return this._sessionManager
  }

  get storage(): IStorage {
    assert(this._storage, 'Adapter not initialized')
    return this._storage
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
      // Acquire tab lock
      const lockAcquired = await this.acquireTabLock()
      if (!lockAcquired) {
        throw new TabLockError(
          'This app is already open in another tab. Only one tab may be open at a time.',
        )
      }

      // Create SQLite storage with opfs-sahpool VFS (async-safe for main thread)
      this._storage = new SQLiteStorage({
        vfs: this.config.storage.vfs ?? 'opfs-sahpool',
        dbName: this.config.storage.dbName ?? 'cqrs-client',
      })
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
      this.releaseTabLock()
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

    // Release tab lock
    this.releaseTabLock()

    // Close storage
    if (this._storage) {
      await this._storage.close()
      this._storage = undefined
    }

    // Complete event bus
    this.eventBus.complete()

    this._status = 'closed'
  }

  /**
   * Acquire tab lock using Web Locks API or BroadcastChannel fallback.
   */
  private async acquireTabLock(): Promise<boolean> {
    // Try Web Locks API first (preferred)
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      return this.acquireWebLock()
    }

    // Fall back to BroadcastChannel
    return this.acquireBroadcastChannelLock()
  }

  /**
   * Acquire lock using Web Locks API.
   */
  private async acquireWebLock(): Promise<boolean> {
    return new Promise((resolve) => {
      this.lockController = new AbortController()

      navigator.locks
        .request(
          'cqrs-client-tab-lock',
          { ifAvailable: true, signal: this.lockController.signal },
          async (lock) => {
            if (!lock) {
              // Lock is held by another tab
              resolve(false)
              return
            }

            // We have the lock
            resolve(true)

            // Keep the lock until we're closed
            // This promise never resolves, keeping the lock
            return new Promise(() => {})
          },
        )
        .catch(() => {
          // Aborted or failed
          resolve(false)
        })
    })
  }

  /**
   * Acquire lock using BroadcastChannel (fallback for browsers without Web Locks).
   */
  private acquireBroadcastChannelLock(): Promise<boolean> {
    return new Promise((resolve) => {
      this.broadcastChannel = new BroadcastChannel('cqrs-client-tab-lock')

      let lockAcquired = false
      let responseTimeout: ReturnType<typeof setTimeout>

      // Listen for other tabs
      this.broadcastChannel.onmessage = (event) => {
        const data = event.data as { type: string; tabId: string }

        if (data.type === 'lock-request' && data.tabId !== this.tabId) {
          if (lockAcquired) {
            // We have the lock, deny the request
            this.broadcastChannel?.postMessage({ type: 'lock-denied', tabId: this.tabId })
          } else if (data.tabId < this.tabId) {
            // Other tab has priority (lower ID) — yield
            clearTimeout(responseTimeout)
            resolve(false)
          }
        } else if (data.type === 'lock-denied') {
          // Another tab has the lock
          clearTimeout(responseTimeout)
          resolve(false)
        }
      }

      // Request the lock
      this.broadcastChannel.postMessage({ type: 'lock-request', tabId: this.tabId })

      // Wait for denial or assume success
      responseTimeout = setTimeout(() => {
        lockAcquired = true
        resolve(true)
      }, 100)
    })
  }

  /**
   * Release the tab lock.
   */
  private releaseTabLock(): void {
    if (this.lockController) {
      this.lockController.abort()
      this.lockController = undefined
    }

    if (this.broadcastChannel) {
      this.broadcastChannel.close()
      this.broadcastChannel = undefined
    }
  }

  private setupBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      this.beforeUnloadHandler = () => {
        this.releaseTabLock()
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
