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
  close(): Promise<void>
}
