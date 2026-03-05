/**
 * Adapter types shared across all execution modes.
 *
 * Uses a discriminated union on `mode` so createCqrsClient can narrow to
 * the correct set of fields at compile time — online-only adapters expose
 * raw components for main-thread wiring, worker adapters expose proxies.
 */

import type { Observable } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { EventBus } from '../../core/events/EventBus.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import type { IStorage } from '../../storage/IStorage.js'
import type { LibraryEvent } from '../../types/events.js'

/**
 * Re-export CqrsClientSyncManager for proxy implementations.
 */
export type { CqrsClientSyncManager } from '../../createCqrsClient.js'

/**
 * Adapter status.
 */
export type AdapterStatus = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'closed'

/**
 * Shared fields for all adapter types.
 */
interface IAdapterBase {
  /**
   * Current adapter status.
   */
  readonly status: AdapterStatus

  /**
   * Observable of library events.
   */
  readonly events$: Observable<LibraryEvent>

  /**
   * Initialize the adapter.
   */
  initialize(): Promise<void>

  /**
   * Close the adapter and release resources.
   */
  close(): Promise<void>
}

/**
 * Online-only adapter provides raw components for main-thread wiring.
 * createCqrsClient uses storage, eventBus, and sessionManager to wire
 * CommandQueue, CacheManager, QueryManager, SyncManager etc.
 */
export interface IOnlineOnlyAdapter extends IAdapterBase {
  readonly mode: 'online-only'
  readonly storage: IStorage
  readonly eventBus: EventBus
  readonly sessionManager: SessionManager
}

/**
 * Worker adapter provides proxy objects. All orchestration happens in the
 * worker; createCqrsClient just wraps the proxies.
 */
export interface IWorkerAdapter extends IAdapterBase {
  readonly mode: 'shared-worker' | 'dedicated-worker'
  readonly commandQueue: ICommandQueue
  readonly queryManager: IQueryManager
  readonly cacheManager: ICacheManager
  readonly syncManager: CqrsClientSyncManager
}

/**
 * Discriminated union of all adapter types.
 * Discriminant: `mode` field.
 */
export type IAdapter = IOnlineOnlyAdapter | IWorkerAdapter
