/**
 * Remote SQLite database — proxies exec() calls to a child DedicatedWorker.
 *
 * Used by Mode B (SharedWorker) where SQLite WASM runs in a child
 * DedicatedWorker because SharedWorkerGlobalScope lacks OPFS sync access.
 */

import type { ISqliteDb } from '../../../storage/ISqliteDb.js'
import type { VfsType } from '../../../storage/LocalSqliteDb.js'
import type { SqliteRequest, SqliteResponse } from './protocol.js'

/**
 * Timeout for individual requests to the child worker (30 seconds).
 */
const REQUEST_TIMEOUT_MS = 30000

/**
 * ISqliteDb implementation that forwards all operations to a child
 * DedicatedWorker via postMessage.
 */
export class RemoteSqliteDb implements ISqliteDb {
  private readonly worker: Worker
  private readonly pending = new Map<string, PendingRequest>()

  constructor(worker: Worker) {
    this.worker = worker
    this.worker.onmessage = (event: MessageEvent<SqliteResponse>) => {
      this.handleResponse(event.data)
    }
    this.worker.onerror = (event: ErrorEvent) => {
      this.rejectAll(`Child sqlite worker error: ${event.message}`)
    }
  }

  /**
   * Initialize the child worker's SQLite database.
   * Must be called before any exec() calls.
   */
  async initialize(config: { dbName: string; vfs: VfsType }): Promise<void> {
    await this.send({ type: 'sqlite:init', requestId: this.nextId(), config })
  }

  async exec<T = Record<string, unknown>>(
    sql: string,
    options: { bind?: unknown[]; rowMode: 'object'; returnValue: 'resultRows' },
  ): Promise<T[]>
  async exec(sql: string, options?: { bind?: unknown[] }): Promise<void>
  async exec(
    sql: string,
    options?: { bind?: unknown[]; rowMode?: string; returnValue?: string },
  ): Promise<unknown> {
    const returnRows = options?.rowMode === 'object' && options?.returnValue === 'resultRows'
    const result = await this.send({
      type: 'sqlite:exec',
      requestId: this.nextId(),
      sql,
      params: options?.bind,
      returnRows,
    })
    return returnRows ? result : undefined
  }

  async close(): Promise<void> {
    try {
      await this.send({ type: 'sqlite:close', requestId: this.nextId() })
    } finally {
      this.worker.terminate()
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private send(request: SqliteRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId)
        reject(new Error(`sqlite-worker request timed out: ${request.type}`))
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(request.requestId, { resolve, reject, timer })
      this.worker.postMessage(request)
    })
  }

  private handleResponse(response: SqliteResponse): void {
    if (response.type !== 'sqlite:response') return

    const entry = this.pending.get(response.requestId)
    if (!entry) return

    this.pending.delete(response.requestId)
    clearTimeout(entry.timer)

    if (response.success) {
      entry.resolve(response.result)
    } else {
      entry.reject(new Error(response.error ?? 'Unknown sqlite-worker error'))
    }
  }

  private rejectAll(message: string): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.reject(new Error(message))
      this.pending.delete(id)
    }
  }

  private idCounter = 0

  private nextId(): string {
    return String(++this.idCounter)
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}
