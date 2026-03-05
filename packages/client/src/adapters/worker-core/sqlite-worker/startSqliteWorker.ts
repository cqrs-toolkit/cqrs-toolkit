/**
 * Entry point for the per-tab DedicatedWorker that handles SQLite I/O.
 *
 * In Mode C, each tab spawns its own DedicatedWorker at this entry point.
 * The worker handles three message flows:
 *
 * 1. `probe` on self.onmessage — run OPFS probe, respond to main thread
 * 2. `set-routing-port` on self.onmessage — receive MessagePort from main
 *    thread connected to the SharedWorker; set up SQLite handling on this port
 * 3. SQLite messages on the routing port — from SharedWorker via the
 *    transferred MessageChannel
 *
 * In Mode B, the DedicatedWorker handles SQLite messages directly on
 * self.onmessage (no routing port).
 *
 * The consumer writes a small worker file:
 * ```ts
 * import { startSqliteWorker } from '@cqrs-toolkit/client'
 * startSqliteWorker()
 * ```
 */

/// <reference lib="webworker" />

import type { ISqliteDb } from '../../../storage/ISqliteDb.js'
import { loadAndOpenDb } from '../../../storage/LocalSqliteDb.js'
import type { SqliteRequest, SqliteResponse } from './protocol.js'

/**
 * Bootstrap the SQLite worker.
 *
 * Listens for probe/routing-port setup messages on self.onmessage,
 * and handles SQLite init/exec/close on the routing port (Mode C)
 * or directly on self.onmessage (Mode B fallback).
 */
export function startSqliteWorker(): void {
  let db: ISqliteDb | undefined

  const self = globalThis as unknown as DedicatedWorkerGlobalScope

  /**
   * Handle a SQLite request and post the response back on the given target.
   */
  async function handleSqliteRequest(
    request: SqliteRequest,
    respondTo: { postMessage(data: SqliteResponse): void },
  ): Promise<void> {
    try {
      switch (request.type) {
        case 'sqlite:init': {
          const localDb = await loadAndOpenDb({
            dbName: request.config.dbName,
            vfs: request.config.vfs,
          })
          db = localDb
          respond(respondTo, request.requestId, true)
          return
        }

        case 'sqlite:exec': {
          if (!db) {
            respond(respondTo, request.requestId, false, undefined, 'Database not initialized')
            return
          }

          if (request.returnRows) {
            const rows = await db.exec(request.sql, {
              bind: request.params,
              rowMode: 'object',
              returnValue: 'resultRows',
            })
            respond(respondTo, request.requestId, true, rows)
          } else {
            await db.exec(request.sql, { bind: request.params })
            respond(respondTo, request.requestId, true)
          }
          return
        }

        case 'sqlite:close': {
          if (db) {
            await db.close()
            db = undefined
          }
          respond(respondTo, request.requestId, true)
          return
        }
      }
    } catch (error) {
      respond(
        respondTo,
        request.requestId,
        false,
        undefined,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  self.onmessage = (event: MessageEvent) => {
    const data = event.data as { type?: string }

    // Probe: test OPFS availability and respond to main thread
    if (data.type === 'probe') {
      probeOPFS().then((ok) => self.postMessage({ type: 'probe-result', success: ok }))
      return
    }

    // Routing port: SharedWorker sends SQLite requests through this port
    if (data.type === 'set-routing-port') {
      const port = event.ports[0]
      if (port) {
        port.onmessage = (e: MessageEvent<SqliteRequest>) => {
          handleSqliteRequest(e.data, port)
        }
        port.start()
      }
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function respond(
  target: { postMessage(data: SqliteResponse): void },
  requestId: string,
  success: boolean,
  result?: unknown,
  error?: string,
): void {
  const response: SqliteResponse = { type: 'sqlite:response', requestId, success, result, error }
  target.postMessage(response)
}

/**
 * Probe OPFS sync file access.
 * Returns `true` if createSyncAccessHandle works, `false` otherwise.
 */
async function probeOPFS(): Promise<boolean> {
  try {
    const root = await navigator.storage.getDirectory()
    const testFile = await root.getFileHandle('__cqrs_opfs_probe__', { create: true })
    const handle = await testFile.createSyncAccessHandle()
    handle.close()
    await root.removeEntry('__cqrs_opfs_probe__')
    return true
  } catch {
    return false
  }
}
