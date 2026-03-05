/**
 * Message protocol for SharedWorker ↔ child DedicatedWorker communication.
 *
 * Purpose-built request/response types for SQLite I/O delegation.
 * The child worker has one client (the SharedWorker) and three operations:
 * init, exec, close.
 */

import type { VfsType } from '../../../storage/LocalSqliteDb.js'

// ---------------------------------------------------------------------------
// SharedWorker → child worker requests
// ---------------------------------------------------------------------------

export interface SqliteInitRequest {
  type: 'sqlite:init'
  requestId: string
  config: { dbName: string; vfs: VfsType }
}

export interface SqliteExecRequest {
  type: 'sqlite:exec'
  requestId: string
  sql: string
  params?: unknown[]
  returnRows: boolean
}

export interface SqliteCloseRequest {
  type: 'sqlite:close'
  requestId: string
}

export type SqliteRequest = SqliteInitRequest | SqliteExecRequest | SqliteCloseRequest

// ---------------------------------------------------------------------------
// Child worker → SharedWorker responses
// ---------------------------------------------------------------------------

export interface SqliteResponse {
  type: 'sqlite:response'
  requestId: string
  success: boolean
  result?: unknown
  error?: string
}
