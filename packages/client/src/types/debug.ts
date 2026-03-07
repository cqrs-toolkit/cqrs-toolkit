/**
 * Debug API types for the CQRS Client.
 * Used by devtools extensions and debug tooling.
 */

import type { Observable } from 'rxjs'
import type { ICacheManager } from '../core/cache-manager/types.js'
import type { ICommandQueue } from '../core/command-queue/types.js'
import type { IQueryManager } from '../core/query-manager/types.js'
import type { CqrsClientSyncManager } from '../createCqrsClient.js'
import type { IStorage } from '../storage/IStorage.js'
import type { ResolvedConfig } from './config.js'
import type { LibraryEvent } from './events.js'

/**
 * Debug API for raw SQL access to the client's SQLite database.
 * Only available in worker modes (dedicated-worker, shared-worker).
 */
export interface DebugStorageAPI {
  exec(sql: string, bind?: unknown[]): Promise<Record<string, unknown>[]>
}

/**
 * Debug API exposed to devtools extensions.
 */
export interface CqrsDebugAPI {
  /** Observable of all library events (including debug events). */
  readonly events$: Observable<LibraryEvent>
  /** Command queue interface for inspection. */
  readonly commandQueue: ICommandQueue
  /** Query manager interface for inspection. */
  readonly queryManager: IQueryManager
  /** Cache manager interface for inspection. */
  readonly cacheManager: ICacheManager
  /** Sync manager interface for inspection. */
  readonly syncManager: CqrsClientSyncManager
  /** Storage interface (only available in online-only mode). */
  readonly storage?: IStorage
  /** Raw SQL debug access (only available in worker modes). */
  readonly debugStorage?: DebugStorageAPI
  /** Resolved client configuration. */
  readonly config: ResolvedConfig
  /** Role of this client instance. */
  readonly role: 'leader' | 'standby'
}

/**
 * Devtools hook interface.
 * A Chrome extension sets `window.__CQRS_TOOLKIT_DEVTOOLS__` to this shape.
 * The library calls `registerClient` when debug mode is enabled.
 */
export interface CqrsDevToolsHook {
  /** Called by the library to register a debug API instance. */
  registerClient(api: CqrsDebugAPI): void
}
