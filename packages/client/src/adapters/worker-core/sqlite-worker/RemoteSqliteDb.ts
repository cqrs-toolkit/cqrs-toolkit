/**
 * Remote SQLite database — proxies exec() calls to a tab's DedicatedWorker
 * via a MessagePort.
 *
 * Used by Mode C (SharedWorker) where SQLite WASM runs in each tab's
 * DedicatedWorker because SharedWorkerGlobalScope lacks OPFS sync access.
 * The SharedWorker routes SQLite operations to the active tab's worker.
 *
 * Supports hot-swapping the target port when the active tab changes via
 * `switchTarget()`. In-flight requests are rejected on switch — upper
 * layers (storage retries) handle re-issuing.
 */

import type { ISqliteDb } from '../../../storage/ISqliteDb.js'
import type { VfsType } from '../../../storage/LocalSqliteDb.js'
import type { SqliteRequest, SqliteResponse } from './protocol.js'

/**
 * Timeout for individual requests to the tab's worker (30 seconds).
 */
const REQUEST_TIMEOUT_MS = 30000

/**
 * ISqliteDb implementation that forwards all operations to a tab's
 * DedicatedWorker via a MessagePort.
 */
export class RemoteSqliteDb implements ISqliteDb {
  private port: MessagePort
  private readonly pending = new Map<string, PendingRequest>()

  constructor(port: MessagePort) {
    this.port = port
    this.attachPort(port)
  }

  /**
   * Initialize the remote worker's SQLite database.
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
    await this.send({ type: 'sqlite:close', requestId: this.nextId() })
  }

  /**
   * Switch to a new target port (active tab changed).
   *
   * Rejects all pending requests — they'll be retried by upper layers.
   * Detaches from the old port and attaches to the new one.
   * Caller is responsible for calling `initialize()` on the new target afterward.
   */
  switchTarget(newPort: MessagePort): void {
    this.rejectAll('Active tab changed — switching SQLite target')
    this.detachPort()
    this.port = newPort
    this.attachPort(newPort)
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private attachPort(port: MessagePort): void {
    port.onmessage = (event: MessageEvent<SqliteResponse>) => {
      this.handleResponse(event.data)
    }
    port.start()
  }

  private detachPort(): void {
    this.port.onmessage = null
  }

  private send(request: SqliteRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(request.requestId)
        reject(new Error(`sqlite-worker request timed out: ${request.type}`))
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(request.requestId, { resolve, reject, timer })
      this.port.postMessage(request)
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
