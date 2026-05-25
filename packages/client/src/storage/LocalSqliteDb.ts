/**
 * Local SQLite database — loads WASM and opens the database in-process.
 *
 * Used by Mode C (DedicatedWorker) and Mode B's child sqlite worker.
 * The synchronous WASM db methods are wrapped in async functions to
 * satisfy the `ISqliteDb` interface.
 */

import { assert } from '#utils'
import type { CollationConfig } from '../types/config.js'
import type { BatchResult, ISqliteDb, SqliteBatchStatement } from './ISqliteDb.js'

/**
 * VFS type for SQLite storage.
 */
export type VfsType = 'opfs' | 'opfs-sahpool' | 'memory'

/**
 * Configuration for loading and opening a local SQLite database.
 */
export interface LoadAndOpenDbConfig {
  /** Database file name */
  dbName: string
  /** VFS to use */
  vfs: VfsType
  /**
   * Custom collations to register against the opened connection. Built-in
   * SQLite collations (`BINARY`, `NOCASE`, `RTRIM`) are always available and
   * need not be listed.
   *
   * Registration is per-connection — collation names are not persisted in
   * the DB file. Every code path that opens this database must register the
   * same set or queries against `COLLATE <name>` columns fail with
   * `no such collation sequence`.
   */
  collations?: readonly CollationConfig[]
}

// ---------------------------------------------------------------------------
// Internal WASM types
// ---------------------------------------------------------------------------

/**
 * Raw synchronous SQLite database handle from @sqlite.org/sqlite-wasm.
 */
interface RawSqliteDb {
  exec<T = Record<string, unknown>>(
    sql: string,
    options: { bind?: unknown[]; rowMode: 'object'; returnValue: 'resultRows' },
  ): T[]
  exec(sql: string, options?: { bind?: unknown[] }): void
  close(): void
}

/**
 * Utility returned by `installOpfsSAHPoolVfs()`.
 */
interface SAHPoolUtil {
  OpfsSAHPoolDb: new (filename: string) => RawSqliteDb
}

/**
 * `xCompare` callback shape used by `sqlite3_create_collation_v2`. The
 * sqlite-wasm binding layer wraps a JS function with this signature into a
 * WASM function-table entry automatically — no `installFunction` call is
 * required from us.
 */
type WasmCompareFn = (pCtx: number, len1: number, p1: number, len2: number, p2: number) => number

/**
 * SQLite WASM module type. Narrowed to the bits this module actually touches.
 */
interface SqliteModule {
  oo1: {
    DB: new (filename: string, mode?: string) => RawSqliteDb
    OpfsDb?: new (filename: string) => RawSqliteDb
  }
  installOpfsSAHPoolVfs?: (opts: {
    clearOnInit?: boolean
    initialCapacity?: number
    directory?: string
    name?: string
  }) => Promise<SAHPoolUtil>
  capi: {
    SQLITE_UTF8: number
    SQLITE_OK: number
    sqlite3_create_collation_v2: (
      db: RawSqliteDb | number,
      zName: string,
      eTextRep: number,
      pArg: number,
      xCompare: WasmCompareFn | number,
      xDestroy: ((pCtx: number) => void) | number,
    ) => number
  }
  wasm: {
    heap8u: () => Uint8Array
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load the SQLite WASM module and open a database.
 *
 * This is the single place that touches `@sqlite.org/sqlite-wasm`.
 * Both Mode C (locally in the DedicatedWorker) and Mode B (in the
 * child sqlite worker) call this function.
 */
export async function loadAndOpenDb(config: LoadAndOpenDbConfig): Promise<LocalSqliteDb> {
  const sqlite3InitModule = await import('@sqlite.org/sqlite-wasm')
  const sqlite3 = (await sqlite3InitModule.default()) as SqliteModule

  const rawDb = await openDatabase(sqlite3, config)

  if (config.collations !== undefined) {
    for (const collation of config.collations) {
      registerCollation(sqlite3, rawDb, collation)
    }
  }

  return new LocalSqliteDb(rawDb)
}

/**
 * Register a single {@link CollationConfig} against the opened WASM database.
 *
 * SQLite passes the two operands as non-NUL-terminated byte ranges in the
 * WASM heap; we decode them as UTF-8 and delegate to the consumer-supplied
 * `compare`. Heap views can be invalidated when the heap grows, so we fetch
 * `heap8u()` inside each comparison rather than capturing it in the closure.
 *
 * The TextDecoder is captured once because constructing it is non-trivial
 * relative to the steady-state cost of a comparison.
 */
function registerCollation(
  sqlite3: SqliteModule,
  rawDb: RawSqliteDb,
  collation: CollationConfig,
): void {
  const decoder = new TextDecoder('utf-8')
  const xCompare: WasmCompareFn = (_pCtx, len1, p1, len2, p2) => {
    const heap = sqlite3.wasm.heap8u()
    const a = decoder.decode(heap.subarray(p1, p1 + len1))
    const b = decoder.decode(heap.subarray(p2, p2 + len2))
    const result = collation.compare(a, b)
    if (result < 0) return -1
    if (result > 0) return 1
    return 0
  }
  const rc = sqlite3.capi.sqlite3_create_collation_v2(
    rawDb,
    collation.name,
    sqlite3.capi.SQLITE_UTF8,
    0,
    xCompare,
    0,
  )
  assert(
    rc === sqlite3.capi.SQLITE_OK,
    `Failed to register collation '${collation.name}' (sqlite rc=${rc})`,
  )
}

/**
 * Thin async wrapper around the synchronous WASM SQLite database.
 *
 * Implements `ISqliteDb` so SQLiteStorage can use it interchangeably
 * with `RemoteSqliteDb`.
 */
export class LocalSqliteDb implements ISqliteDb {
  private readonly rawDb: RawSqliteDb

  constructor(rawDb: RawSqliteDb) {
    this.rawDb = rawDb
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
    if (options?.rowMode === 'object' && options?.returnValue === 'resultRows') {
      return this.rawDb.exec(sql, {
        bind: options.bind,
        rowMode: 'object',
        returnValue: 'resultRows',
      })
    }
    this.rawDb.exec(sql, { bind: options?.bind })
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches ISqliteDb.execBatch signature exactly; T is a phantom type on SqliteBatchStatement used only for BatchResult inference
  async execBatch<const T extends readonly SqliteBatchStatement<any>[]>(
    statements: T,
  ): Promise<BatchResult<T>> {
    if (statements.length <= 1) {
      // The tuple is built positionally from statements; TypeScript cannot
      // express the correspondence between the SqliteBatchStatement<R> input
      // and the heterogeneous output tuple without a cast here.
      return statements.map((stmt) => this.execOne(stmt)) as BatchResult<T>
    }

    this.rawDb.exec('BEGIN')
    try {
      const results = statements.map((stmt) => this.execOne(stmt))
      this.rawDb.exec('COMMIT')
      return results as BatchResult<T>
    } catch (error) {
      this.rawDb.exec('ROLLBACK')
      throw error
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- element type of the execBatch input tuple
  private execOne(stmt: SqliteBatchStatement<any>): unknown {
    if (stmt.returnRows) {
      return this.rawDb.exec(stmt.sql, {
        bind: stmt.bind,
        rowMode: 'object',
        returnValue: 'resultRows',
      })
    }
    this.rawDb.exec(stmt.sql, { bind: stmt.bind })
    return undefined
  }

  async close(): Promise<void> {
    this.rawDb.close()
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function openDatabase(
  sqlite3: SqliteModule,
  config: LoadAndOpenDbConfig,
): Promise<RawSqliteDb> {
  const { oo1 } = sqlite3

  switch (config.vfs) {
    case 'opfs':
      if (!oo1.OpfsDb) {
        throw new Error('OPFS VFS not available - are you in a Worker?')
      }
      return new oo1.OpfsDb(config.dbName)

    case 'opfs-sahpool': {
      const install = sqlite3.installOpfsSAHPoolVfs
      assert(install, 'opfs-sahpool VFS not available in this SQLite build')
      const poolUtil = await install({ clearOnInit: false })
      return new poolUtil.OpfsSAHPoolDb(config.dbName)
    }

    case 'memory':
    default:
      return new oo1.DB(':memory:', 'c')
  }
}
