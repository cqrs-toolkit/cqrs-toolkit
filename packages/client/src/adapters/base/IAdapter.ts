/**
 * Adapter types shared across all execution modes.
 *
 * Two structural variants:
 * - **Online-only** (`mode: 'online-only'`): exposes raw components for
 *   main-thread wiring (storage, eventBus, sessionManager).
 * - **Worker** (no `mode`): exposes proxy objects — all orchestration
 *   happens in a background process (Web Worker, Electron utility, etc.).
 *
 * The `kind` field is the discriminant that `createCqrsClient` checks:
 * `'window'` creates components on the main thread, `'worker'` uses
 * the adapter's proxy objects from a background process.
 */

import type { Link } from '@meticoeus/ddd-es'
import type { Observable } from 'rxjs'
import type { ICacheManager } from '../../core/cache-manager/types.js'
import type { ICommandQueue } from '../../core/command-queue/types.js'
import type { EventBus } from '../../core/events/EventBus.js'
import type { IQueryManager } from '../../core/query-manager/types.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { CqrsClientSyncManager } from '../../createCqrsClient.js'
import type { WorkerMessageChannel } from '../../protocol/MessageChannel.js'
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
 * Window adapter — all CQRS components live on the main thread.
 * createCqrsClient uses storage, eventBus, and sessionManager to wire
 * CommandQueue, CacheManager, QueryManager, SyncManager etc.
 */
export interface IWindowAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> extends IAdapterBase<TLink> {
  readonly kind: 'window'
  readonly storage: IStorage<TLink, TCommand>
  readonly eventBus: EventBus<TLink>
  readonly sessionManager: SessionManager<TLink, TCommand>
}

/**
 * Worker adapter — all CQRS components live in a background process
 * (Web Worker, Electron utility process, etc.). The main thread gets
 * proxy objects that forward calls via the message protocol.
 */
export interface IWorkerAdapter<
  TLink extends Link,
  TCommand extends EnqueueCommand,
> extends IAdapterBase<TLink> {
  readonly kind: 'worker'
  readonly commandQueue: ICommandQueue<TLink, TCommand>
  readonly queryManager: IQueryManager<TLink>
  readonly cacheManager: ICacheManager<TLink>
  readonly syncManager: CqrsClientSyncManager<TLink>

  /**
   * Transport channel to the worker. Exposed so the bootstrap can treat it
   * as the main-thread {@link IEventSink} for local events (log emissions,
   * etc.) — events pushed through `channel.emit`/`emitDebug` surface on
   * {@link events$} alongside events forwarded from the worker without
   * crossing `postMessage`.
   */
  readonly channel: WorkerMessageChannel

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
 * Discriminant: `kind` — `'window'` (main-thread) vs `'worker'` (background process).
 */
export type IAdapter<TLink extends Link, TCommand extends EnqueueCommand> =
  | IWindowAdapter<TLink, TCommand>
  | IWorkerAdapter<TLink, TCommand>
