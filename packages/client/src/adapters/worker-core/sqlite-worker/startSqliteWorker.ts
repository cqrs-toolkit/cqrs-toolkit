/**
 * Entry point for the child DedicatedWorker that handles SQLite I/O.
 *
 * Spawned by the SharedWorker in Mode B.  This worker is pure
 * infrastructure — it loads SQLite WASM, probes OPFS, opens the
 * database, and handles exec() calls.  Nothing more.
 *
 * The consumer writes a small worker file:
 * ```ts
 * import { startSqliteWorker } from '@cqrs-toolkit/client'
 * startSqliteWorker()
 * ```
 */

/// <reference lib="webworker" />

import type { ISqliteDb } from '../../../storage/ISqliteDb.js'
import { loadAndOpenDb, type VfsType } from '../../../storage/LocalSqliteDb.js'
import type { SqliteRequest, SqliteResponse } from './protocol.js'

/**
 * Bootstrap the child sqlite worker.
 *
 * Listens for init/exec/close messages from the parent SharedWorker
 * and delegates to the local SQLite WASM database.
 */
export function startSqliteWorker(): void {
  let db: ISqliteDb | undefined

  const self = globalThis as unknown as DedicatedWorkerGlobalScope

  self.onmessage = (event: MessageEvent<SqliteRequest>) => {
    const request = event.data
    handleRequest(request).catch((error) => {
      const response: SqliteResponse = {
        type: 'sqlite:response',
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
      self.postMessage(response)
    })
  }

  async function handleRequest(request: SqliteRequest): Promise<void> {
    switch (request.type) {
      case 'sqlite:init': {
        const vfs = await resolveVfs(request.config.vfs)
        const localDb = await loadAndOpenDb({ dbName: request.config.dbName, vfs })
        db = localDb
        respond(request.requestId, true)
        return
      }

      case 'sqlite:exec': {
        if (!db) {
          respond(request.requestId, false, undefined, 'Database not initialized')
          return
        }

        if (request.returnRows) {
          const rows = await db.exec(request.sql, {
            bind: request.params,
            rowMode: 'object',
            returnValue: 'resultRows',
          })
          respond(request.requestId, true, rows)
        } else {
          await db.exec(request.sql, { bind: request.params })
          respond(request.requestId, true)
        }
        return
      }

      case 'sqlite:close': {
        if (db) {
          await db.close()
          db = undefined
        }
        respond(request.requestId, true)
        return
      }
    }
  }

  function respond(requestId: string, success: boolean, result?: unknown, error?: string): void {
    const response: SqliteResponse = { type: 'sqlite:response', requestId, success, result, error }
    self.postMessage(response)
  }
}

/**
 * Resolve the VFS type, falling back to in-memory if OPFS is unavailable.
 *
 * SharedWorker mode still provides cross-tab coordination value even
 * without persistence (e.g., Chrome incognito where OPFS is unavailable).
 */
async function resolveVfs(requested: VfsType): Promise<VfsType> {
  if (requested === 'memory') return 'memory'

  try {
    const root = await navigator.storage.getDirectory()
    const testFile = await root.getFileHandle('__cqrs_opfs_probe__', { create: true })
    const handle = await testFile.createSyncAccessHandle()
    handle.close()
    await root.removeEntry('__cqrs_opfs_probe__')
    return requested
  } catch {
    // OPFS unavailable — fall back to in-memory SQLite
    return 'memory'
  }
}
