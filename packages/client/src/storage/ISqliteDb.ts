/**
 * Fully async interface for SQLite database operations.
 *
 * Two implementations:
 * - `LocalSqliteDb` — thin async wrapper around the synchronous WASM db (Mode C).
 * - `RemoteSqliteDb` — proxies calls via postMessage to a child worker (Mode B).
 *
 * SQLiteStorage always receives an injected `ISqliteDb` and never loads WASM
 * or opens databases itself.
 */

/**
 * A single statement in a batch.
 *
 * When `returnRows` is true the result slot for this statement will be
 * the row-object array; otherwise it will be `undefined`.
 */
export interface SqliteBatchStatement<T = void> {
  sql: string
  bind?: unknown[]
  returnRows?: boolean
}

export type BatchResult<T extends readonly SqliteBatchStatement<any>[]> = {
  [K in keyof T]: T[K] extends SqliteBatchStatement<infer R>
    ? [R] extends [void]
      ? undefined
      : R[]
    : never
}

export function queryStmt<R>(sql: string, bind?: unknown[]): SqliteBatchStatement<R> {
  return { sql, bind, returnRows: true }
}

export function execStmt(sql: string, bind?: unknown[]): SqliteBatchStatement<void> {
  return { sql, bind, returnRows: false }
}

/**
 * Async SQLite database interface.
 *
 * The generic on the query overload declares the row shape we expect back.
 * Since we control the schema through migrations and SQLite enforces column
 * types, the row type parameter is a sound declaration of what we know we're
 * getting — not a speculative cast.
 */
export interface ISqliteDb {
  exec<T = Record<string, unknown>>(
    sql: string,
    options: { bind?: unknown[]; rowMode: 'object'; returnValue: 'resultRows' },
  ): Promise<T[]>
  exec(sql: string, options?: { bind?: unknown[] }): Promise<void>

  /**
   * Execute multiple statements inside a single transaction.
   *
   * The entire batch is wrapped in BEGIN / COMMIT.  On failure the
   * transaction is rolled back and the error is rethrown.
   *
   * Returns one result slot per input statement in the same order:
   * - `undefined` when `returnRows` was false/omitted
   * - the row-object array when `returnRows` was true
   */
  execBatch<const T extends readonly SqliteBatchStatement<any>[]>(
    statements: T,
  ): Promise<BatchResult<T>>

  close(): Promise<void>
}
