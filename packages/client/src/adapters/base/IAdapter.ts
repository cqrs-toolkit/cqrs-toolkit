/**
 * Adapter types shared across all execution modes.
 *
 * Uses a discriminated union on `mode` so createCqrsClient can narrow to
 * the correct set of fields at compile time — online-only adapters expose
 * raw components for main-thread wiring, worker adapters expose proxies.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { EventBus } from '../../core/events/EventBus.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import type { IStorage } from '../../storage/IStorage.js'
import type { LibraryEvent } from '../../types/events.js'
import { EnqueueCommand } from '../../types/index.js'

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
interface IAdapterBase<TLink extends Link> {
  /**
   * Current adapter status.
   */
  readonly status: AdapterStatus

  /**
   * Observable of library events.
   */
  readonly events$: Observable<LibraryEvent<TLink>>

  /**
   * Role of this client instance.
   * 'leader' = active writer (online-only, dedicated-worker, or active shared-worker tab).
   * 'standby' = shared-worker tab waiting for active-tab lock.
   */
  readonly role?: 'leader' | 'standby'

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
export interface IOnlineOnlyAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> extends IAdapterBase<TLink> {
  readonly mode: 'online-only'
  readonly storage: IStorage<TLink, TCommand>
  readonly eventBus: EventBus<TLink>
  readonly sessionManager: SessionManager<TLink, TCommand>
}

/**
 * Worker adapter provides proxy objects. All orchestration happens in the
 * worker; createCqrsClient just wraps the proxies.
 */
export interface IWorkerAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> extends IAdapterBase<TLink> {
  readonly mode: 'shared-worker' | 'dedicated-worker'
  readonly commandQueue: ICommandQueue<TLink, TCommand>
  readonly queryManager: IQueryManager<TLink>
  readonly cacheManager: ICacheManager<TLink>
  readonly syncManager: CqrsClientSyncManager<TLink>

  /**
   * Enable debug mode in the worker.
   * Sends a `debug.enable` RPC so the worker starts emitting debug events.
   * One-way and idempotent — no disable path.
   */
  enableDebug(): Promise<void>

  /**
   * Send an arbitrary debug RPC to the worker and return the result.
   * Used by devtools for raw SQL queries and other debug commands.
   */
  debugQuery<T>(method: string, args?: unknown[]): Promise<T>
}

/**
 * Discriminated union of all adapter types.
 * Discriminant: `mode` field.
 */
export type IAdapter<TLink extends Link, TCommand extends EnqueueCommand> =
  | IOnlineOnlyAdapter<TLink, TCommand>
  | IWorkerAdapter<TLink, TCommand>
