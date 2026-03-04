/**
 * Online-only adapter (Mode A).
 * All state is stored in memory and lost on page reload.
 * No worker orchestration or cross-tab coordination.
 */

import type { Observable } from 'rxjs'
import { EventBus } from '../../core/events/EventBus.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import type { IStorage } from '../../storage/IStorage.js'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { ExecutionMode, ResolvedConfig } from '../../types/config.js'
import type { LibraryEvent } from '../../types/events.js'
import { assert } from '../../utils/assert.js'
import type { AdapterStatus, IAdapter } from '../base/IAdapter.js'

/**
 * Online-only adapter for development, testing, and deployments
 * where offline persistence is not required.
 */
export class OnlineOnlyAdapter implements IAdapter {
  readonly mode: ExecutionMode = 'online-only'
  readonly eventBus: EventBus

  private _status: AdapterStatus = 'uninitialized'
  private _storage: IStorage | undefined
  private _sessionManager: SessionManager | undefined

  constructor(_config: ResolvedConfig) {
    this.eventBus = new EventBus()
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

  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)

    this._status = 'initializing'

    try {
      this._storage = new InMemoryStorage()
      await this._storage.initialize()

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
}
