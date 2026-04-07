/**
 * Online-only adapter (Mode A).
 * All state is stored in memory and lost on page reload.
 * No worker orchestration or cross-tab coordination.
 */

import { assert } from '#utils'
import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { IAnticipatedEvent } from '../../core/command-lifecycle/AnticipatedEventShape.js'
import { EventBus } from '../../core/events/EventBus.js'
import { SessionManager } from '../../core/session/SessionManager.js'
import type { IStorage } from '../../storage/IStorage.js'
import { InMemoryStorage } from '../../storage/InMemoryStorage.js'
import type { ResolvedConfig } from '../../types/config.js'
import type { LibraryEvent } from '../../types/events.js'
import { EnqueueCommand } from '../../types/index.js'
import type { AdapterStatus, IWindowAdapter } from '../base/IAdapter.js'

/**
 * Online-only adapter for development, testing, and deployments
 * where offline persistence is not required.
 */
export class OnlineOnlyAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
  TSchema,
  TEvent extends IAnticipatedEvent,
> implements IWindowAdapter<TLink, TCommand> {
  readonly kind = 'window' as const
  readonly role = 'leader' as const
  readonly eventBus: EventBus<TLink>

  private _status: AdapterStatus = 'uninitialized'
  private _storage: IStorage<TLink, TCommand> | undefined
  private _sessionManager: SessionManager<TLink, TCommand> | undefined

  constructor(config: ResolvedConfig<TLink, TCommand, TSchema, TEvent>) {
    this.eventBus = new EventBus()
    this.eventBus.debug = config.debug
  }

  get status(): AdapterStatus {
    return this._status
  }

  get events$(): Observable<LibraryEvent<TLink>> {
    return this.eventBus.events$
  }

  get sessionManager(): SessionManager<TLink, TCommand> {
    assert(this._sessionManager, 'Adapter not initialized')
    return this._sessionManager
  }

  get storage(): IStorage<TLink, TCommand> {
    assert(this._storage, 'Adapter not initialized')
    return this._storage
  }

  async initialize(): Promise<void> {
    assert(this._status === 'uninitialized', `Cannot initialize adapter in status: ${this._status}`)

    this._status = 'initializing'

    try {
      this._storage = new InMemoryStorage()
      await this._storage.initialize()

      this._sessionManager = new SessionManager(this._storage, this.eventBus)
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
