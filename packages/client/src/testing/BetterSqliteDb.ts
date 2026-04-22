import Database from 'better-sqlite3'
import type { BatchResult, ISqliteDb, SqliteBatchStatement } from '../storage/ISqliteDb.js'

export class BetterSqliteDb implements ISqliteDb {
  private readonly db: Database.Database

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
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
      const stmt = this.db.prepare(sql)
      return options.bind ? stmt.all(...options.bind) : stmt.all()
    }
    if (options?.bind) {
      this.db.prepare(sql).run(...options.bind)
    } else {
      this.db.exec(sql)
    }
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches ISqliteDb.execBatch signature exactly; T is a phantom type on SqliteBatchStatement used only for BatchResult inference
  async execBatch<const T extends readonly SqliteBatchStatement<any>[]>(
    statements: T,
  ): Promise<BatchResult<T>> {
    const results: unknown[] = []

    const runBatch = this.db.transaction(() => {
      for (const stmt of statements) {
        if (stmt.returnRows) {
          const prepared = this.db.prepare(stmt.sql)
          results.push(stmt.bind ? prepared.all(...stmt.bind) : prepared.all())
        } else {
          const prepared = this.db.prepare(stmt.sql)
          if (stmt.bind) {
            prepared.run(...stmt.bind)
          } else {
            prepared.run()
          }
          results.push(undefined)
        }
      }
    })

    runBatch()
    // The tuple is built positionally from statements; TypeScript cannot
    // express the correspondence between the SqliteBatchStatement<R> input
    // and the heterogeneous output tuple without a cast here.
    return results as BatchResult<T>
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
