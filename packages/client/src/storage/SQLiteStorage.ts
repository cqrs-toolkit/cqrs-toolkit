/**
 * SQLite storage implementation using @sqlite.org/sqlite-wasm.
 *
 * This implementation supports both Worker context (opfs VFS) and
 * main thread (opfs-sahpool VFS) execution modes.
 */

import { logProvider } from '@meticoeus/ddd-es'
import type { CommandFilter, CommandRecord, CommandStatus } from '../types/commands.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  QueryOptions,
  ReadModelRecord,
  SessionRecord,
} from './IStorage.js'
import { ALL_TABLES, getPendingMigrations } from './schema/index.js'

/**
 * SQLite database instance type (from @sqlite.org/sqlite-wasm).
 * Using 'any' here as the actual type is complex and comes from external lib.
 */
type SqliteDb = {
  exec(sql: string, options?: { bind?: unknown[]; rowMode?: string; returnValue?: string }): unknown
  close(): void
}

/**
 * SQLite WASM module type.
 */
type SqliteModule = {
  oo1: {
    DB: new (filename: string, mode?: string) => SqliteDb
    OpfsDb?: new (filename: string) => SqliteDb
  }
}

/**
 * VFS type for storage.
 */
export type VfsType = 'opfs' | 'opfs-sahpool' | 'memory'

/**
 * SQLite storage configuration.
 */
export interface SQLiteStorageConfig {
  /** Database file name */
  dbName?: string
  /** VFS to use */
  vfs?: VfsType
  /** Pre-initialized SQLite module (for worker contexts) */
  sqlite?: SqliteModule
}

/**
 * SQLite storage implementation.
 */
export class SQLiteStorage implements IStorage {
  private readonly dbName: string
  private readonly vfs: VfsType
  private sqliteModule: SqliteModule | null = null
  private db: SqliteDb | null = null
  private initialized = false

  constructor(config: SQLiteStorageConfig = {}) {
    this.dbName = config.dbName ?? 'cqrs-client.db'
    this.vfs = config.vfs ?? 'memory'
    this.sqliteModule = config.sqlite ?? null
  }

  // Lifecycle

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Load SQLite module if not provided
    if (!this.sqliteModule) {
      this.sqliteModule = await this.loadSqliteModule()
    }

    // Open database
    this.db = await this.openDatabase()

    // Create tables
    await this.createSchema()

    // Run migrations
    await this.runMigrations()

    this.initialized = true
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.initialized = false
  }

  async clear(): Promise<void> {
    this.assertInitialized()
    // Delete all data but keep schema
    this.exec('DELETE FROM session')
    this.exec('DELETE FROM cache_keys')
    this.exec('DELETE FROM commands')
    this.exec('DELETE FROM cached_events')
    this.exec('DELETE FROM read_models')
  }

  // Session operations

  async getSession(): Promise<SessionRecord | null> {
    this.assertInitialized()
    const rows = this.query<{
      id: number
      user_id: string
      created_at: number
      last_seen_at: number
    }>('SELECT * FROM session WHERE id = 1')

    if (rows.length === 0) return null

    const row = rows[0]!
    return {
      id: 1,
      userId: row.user_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    }
  }

  async saveSession(session: SessionRecord): Promise<void> {
    this.assertInitialized()
    this.exec(
      `INSERT OR REPLACE INTO session (id, user_id, created_at, last_seen_at)
       VALUES (1, ?, ?, ?)`,
      [session.userId, session.createdAt, session.lastSeenAt],
    )
  }

  async deleteSession(): Promise<void> {
    this.assertInitialized()
    // Delete session and all associated data
    this.exec('DELETE FROM session')
    this.exec('DELETE FROM cache_keys')
    this.exec('DELETE FROM commands')
    this.exec('DELETE FROM cached_events')
    this.exec('DELETE FROM read_models')
  }

  async touchSession(): Promise<void> {
    this.assertInitialized()
    this.exec('UPDATE session SET last_seen_at = ? WHERE id = 1', [Date.now()])
  }

  // Cache key operations

  async getCacheKey(key: string): Promise<CacheKeyRecord | null> {
    this.assertInitialized()
    const rows = this.query<{
      key: string
      last_accessed_at: number
      hold_count: number
      frozen: number
      expires_at: number | null
      created_at: number
    }>('SELECT * FROM cache_keys WHERE key = ?', [key])

    if (rows.length === 0) return null

    const row = rows[0]!
    return {
      key: row.key,
      lastAccessedAt: row.last_accessed_at,
      holdCount: row.hold_count,
      frozen: row.frozen === 1,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }
  }

  async getAllCacheKeys(): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = this.query<{
      key: string
      last_accessed_at: number
      hold_count: number
      frozen: number
      expires_at: number | null
      created_at: number
    }>('SELECT * FROM cache_keys')

    return rows.map((row) => ({
      key: row.key,
      lastAccessedAt: row.last_accessed_at,
      holdCount: row.hold_count,
      frozen: row.frozen === 1,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }))
  }

  async saveCacheKey(record: CacheKeyRecord): Promise<void> {
    this.assertInitialized()
    this.exec(
      `INSERT OR REPLACE INTO cache_keys (key, last_accessed_at, hold_count, frozen, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        record.key,
        record.lastAccessedAt,
        record.holdCount,
        record.frozen ? 1 : 0,
        record.expiresAt,
        record.createdAt,
      ],
    )
  }

  async deleteCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM cache_keys WHERE key = ?', [key])
    this.exec('DELETE FROM cached_events WHERE cache_key = ?', [key])
    this.exec('DELETE FROM read_models WHERE cache_key = ?', [key])
  }

  async holdCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    this.exec('UPDATE cache_keys SET hold_count = hold_count + 1 WHERE key = ?', [key])
  }

  async releaseCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    this.exec('UPDATE cache_keys SET hold_count = MAX(0, hold_count - 1) WHERE key = ?', [key])
  }

  async touchCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    this.exec('UPDATE cache_keys SET last_accessed_at = ? WHERE key = ?', [Date.now(), key])
  }

  async getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = this.query<{
      key: string
      last_accessed_at: number
      hold_count: number
      frozen: number
      expires_at: number | null
      created_at: number
    }>(
      `SELECT * FROM cache_keys
       WHERE hold_count = 0 AND frozen = 0
       ORDER BY last_accessed_at ASC
       LIMIT ?`,
      [limit],
    )

    return rows.map((row) => ({
      key: row.key,
      lastAccessedAt: row.last_accessed_at,
      holdCount: row.hold_count,
      frozen: row.frozen === 1,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }))
  }

  // Command operations

  async getCommand(commandId: string): Promise<CommandRecord | null> {
    this.assertInitialized()
    const rows = this.query<CommandRow>('SELECT * FROM commands WHERE command_id = ?', [commandId])

    if (rows.length === 0) return null

    return this.rowToCommand(rows[0]!)
  }

  async getCommands(filter?: CommandFilter): Promise<CommandRecord[]> {
    this.assertInitialized()
    let sql = 'SELECT * FROM commands WHERE 1=1'
    const params: unknown[] = []

    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      sql += ` AND status IN (${statuses.map(() => '?').join(',')})`
      params.push(...statuses)
    }

    if (filter?.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type]
      sql += ` AND type IN (${types.map(() => '?').join(',')})`
      params.push(...types)
    }

    if (filter?.service) {
      sql += ' AND service = ?'
      params.push(filter.service)
    }

    if (filter?.createdAfter !== undefined) {
      sql += ' AND created_at > ?'
      params.push(filter.createdAfter)
    }

    if (filter?.createdBefore !== undefined) {
      sql += ' AND created_at < ?'
      params.push(filter.createdBefore)
    }

    sql += ' ORDER BY created_at ASC'

    if (filter?.limit !== undefined) {
      sql += ' LIMIT ?'
      params.push(filter.limit)
    }

    if (filter?.offset !== undefined) {
      sql += ' OFFSET ?'
      params.push(filter.offset)
    }

    const rows = this.query<CommandRow>(sql, params)
    return rows.map((row) => this.rowToCommand(row))
  }

  async getCommandsByStatus(status: CommandStatus | CommandStatus[]): Promise<CommandRecord[]> {
    return this.getCommands({ status })
  }

  async getCommandsBlockedBy(commandId: string): Promise<CommandRecord[]> {
    this.assertInitialized()
    // JSON contains check - blocked_by is a JSON array
    const rows = this.query<CommandRow>(`SELECT * FROM commands WHERE blocked_by LIKE ?`, [
      `%"${commandId}"%`,
    ])
    return rows.map((row) => this.rowToCommand(row))
  }

  async saveCommand(command: CommandRecord): Promise<void> {
    this.assertInitialized()
    this.exec(
      `INSERT OR REPLACE INTO commands
       (command_id, service, type, payload, status, depends_on, blocked_by, attempts,
        last_attempt_at, anticipated_event_ids, error, server_response, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        command.commandId,
        command.service,
        command.type,
        JSON.stringify(command.payload),
        command.status,
        JSON.stringify(command.dependsOn),
        JSON.stringify(command.blockedBy),
        command.attempts,
        command.lastAttemptAt ?? null,
        JSON.stringify(command.anticipatedEventIds),
        command.error ? JSON.stringify(command.error) : null,
        command.serverResponse !== undefined ? JSON.stringify(command.serverResponse) : null,
        command.createdAt,
        command.updatedAt,
      ],
    )
  }

  async updateCommand(commandId: string, updates: Partial<CommandRecord>): Promise<void> {
    this.assertInitialized()
    const current = await this.getCommand(commandId)
    if (!current) return

    const updated = { ...current, ...updates, updatedAt: Date.now() }
    await this.saveCommand(updated)
  }

  async deleteCommand(commandId: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM commands WHERE command_id = ?', [commandId])
    this.exec('DELETE FROM cached_events WHERE command_id = ?', [commandId])
  }

  async deleteAllCommands(): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM commands')
    this.exec("DELETE FROM cached_events WHERE persistence = 'Anticipated'")
  }

  // Event cache operations

  async getCachedEvent(id: string): Promise<CachedEventRecord | null> {
    this.assertInitialized()
    const rows = this.query<EventRow>('SELECT * FROM cached_events WHERE id = ?', [id])

    if (rows.length === 0) return null

    return this.rowToEvent(rows[0]!)
  }

  async getCachedEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const rows = this.query<EventRow>('SELECT * FROM cached_events WHERE cache_key = ?', [cacheKey])
    return rows.map((row) => this.rowToEvent(row))
  }

  async getCachedEventsByStream(streamId: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const rows = this.query<EventRow>(
      `SELECT * FROM cached_events WHERE stream_id = ?
       ORDER BY CASE WHEN position IS NOT NULL THEN CAST(position AS INTEGER) END ASC,
                created_at ASC`,
      [streamId],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const rows = this.query<EventRow>(
      "SELECT * FROM cached_events WHERE persistence = 'Anticipated' AND command_id = ?",
      [commandId],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async saveCachedEvent(event: CachedEventRecord): Promise<void> {
    this.assertInitialized()
    this.exec(
      `INSERT OR REPLACE INTO cached_events
       (id, type, stream_id, persistence, data, position, revision, command_id, cache_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.type,
        event.streamId,
        event.persistence,
        event.data,
        event.position,
        event.revision,
        event.commandId,
        event.cacheKey,
        event.createdAt,
      ],
    )
  }

  async saveCachedEvents(events: CachedEventRecord[]): Promise<void> {
    this.assertInitialized()
    for (const event of events) {
      await this.saveCachedEvent(event)
    }
  }

  async deleteCachedEvent(id: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM cached_events WHERE id = ?', [id])
  }

  async deleteAnticipatedEventsByCommand(commandId: string): Promise<void> {
    this.assertInitialized()
    this.exec("DELETE FROM cached_events WHERE persistence = 'Anticipated' AND command_id = ?", [
      commandId,
    ])
  }

  async deleteCachedEventsByCacheKey(cacheKey: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM cached_events WHERE cache_key = ?', [cacheKey])
  }

  // Read model operations

  async getReadModel(collection: string, id: string): Promise<ReadModelRecord | null> {
    this.assertInitialized()
    const rows = this.query<ReadModelRow>(
      'SELECT * FROM read_models WHERE collection = ? AND id = ?',
      [collection, id],
    )

    if (rows.length === 0) return null

    return this.rowToReadModel(rows[0]!)
  }

  async getReadModelsByCollection(
    collection: string,
    options?: QueryOptions,
  ): Promise<ReadModelRecord[]> {
    this.assertInitialized()
    let sql = 'SELECT * FROM read_models WHERE collection = ?'
    const params: unknown[] = [collection]

    if (options?.orderBy) {
      const dir = options.orderDirection === 'desc' ? 'DESC' : 'ASC'
      // Note: ordering by JSON field would need json_extract in production
      sql += ` ORDER BY updated_at ${dir}`
    }

    if (options?.limit !== undefined) {
      sql += ' LIMIT ?'
      params.push(options.limit)
    }

    if (options?.offset !== undefined) {
      sql += ' OFFSET ?'
      params.push(options.offset)
    }

    const rows = this.query<ReadModelRow>(sql, params)
    return rows.map((row) => this.rowToReadModel(row))
  }

  async getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]> {
    this.assertInitialized()
    const rows = this.query<ReadModelRow>('SELECT * FROM read_models WHERE cache_key = ?', [
      cacheKey,
    ])
    return rows.map((row) => this.rowToReadModel(row))
  }

  async saveReadModel(record: ReadModelRecord): Promise<void> {
    this.assertInitialized()
    this.exec(
      `INSERT OR REPLACE INTO read_models
       (id, collection, cache_key, server_data, effective_data, has_local_changes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.collection,
        record.cacheKey,
        record.serverData,
        record.effectiveData,
        record.hasLocalChanges ? 1 : 0,
        record.updatedAt,
      ],
    )
  }

  async saveReadModels(records: ReadModelRecord[]): Promise<void> {
    this.assertInitialized()
    for (const record of records) {
      await this.saveReadModel(record)
    }
  }

  async deleteReadModel(collection: string, id: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM read_models WHERE collection = ? AND id = ?', [collection, id])
  }

  async deleteReadModelsByCacheKey(cacheKey: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM read_models WHERE cache_key = ?', [cacheKey])
  }

  async deleteReadModelsByCollection(collection: string): Promise<void> {
    this.assertInitialized()
    this.exec('DELETE FROM read_models WHERE collection = ?', [collection])
  }

  // Private helpers

  private async loadSqliteModule(): Promise<SqliteModule> {
    // Dynamic import of @sqlite.org/sqlite-wasm
    // This allows the module to be tree-shaken if SQLite is not used
    const sqlite3InitModule = await import('@sqlite.org/sqlite-wasm')
    const sqlite3 = await sqlite3InitModule.default()
    return sqlite3 as SqliteModule
  }

  private async openDatabase(): Promise<SqliteDb> {
    if (!this.sqliteModule) {
      throw new Error('SQLite module not loaded')
    }

    const { oo1 } = this.sqliteModule

    switch (this.vfs) {
      case 'opfs':
        if (!oo1.OpfsDb) {
          throw new Error('OPFS VFS not available - are you in a Worker?')
        }
        return new oo1.OpfsDb(this.dbName)

      case 'opfs-sahpool':
        // opfs-sahpool requires special initialization
        // For now, fall back to memory
        logProvider.log.warn('opfs-sahpool not yet implemented, using memory')
        return new oo1.DB(':memory:', 'c')

      case 'memory':
      default:
        return new oo1.DB(':memory:', 'c')
    }
  }

  private async createSchema(): Promise<void> {
    for (const statement of ALL_TABLES) {
      this.exec(statement)
    }
  }

  private async runMigrations(): Promise<void> {
    // Get current version
    const rows = this.query<{ version: number }>('SELECT MAX(version) as version FROM migrations')
    const currentVersion = rows[0]?.version ?? 0

    // Get pending migrations
    const pending = getPendingMigrations(currentVersion)

    for (const migration of pending) {
      for (const sql of migration.sql) {
        this.exec(sql)
      }
      this.exec('INSERT INTO migrations (version, applied_at) VALUES (?, ?)', [
        migration.version,
        Date.now(),
      ])
    }
  }

  private exec(sql: string, params?: unknown[]): void {
    if (!this.db) throw new Error('Database not initialized')
    this.db.exec(sql, { bind: params })
  }

  private query<T>(sql: string, params?: unknown[]): T[] {
    if (!this.db) throw new Error('Database not initialized')
    const result = this.db.exec(sql, {
      bind: params,
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    return (result as T[]) ?? []
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage not initialized. Call initialize() first.')
    }
  }

  // Row type converters

  private rowToCommand(row: CommandRow): CommandRecord {
    return {
      commandId: row.command_id,
      service: row.service,
      type: row.type,
      payload: JSON.parse(row.payload),
      status: row.status as CommandStatus,
      dependsOn: JSON.parse(row.depends_on),
      blockedBy: JSON.parse(row.blocked_by),
      attempts: row.attempts,
      lastAttemptAt: row.last_attempt_at ?? undefined,
      anticipatedEventIds: JSON.parse(row.anticipated_event_ids),
      error: row.error ? JSON.parse(row.error) : undefined,
      serverResponse: row.server_response ? JSON.parse(row.server_response) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private rowToEvent(row: EventRow): CachedEventRecord {
    return {
      id: row.id,
      type: row.type,
      streamId: row.stream_id,
      persistence: row.persistence as CachedEventRecord['persistence'],
      data: row.data,
      position: row.position,
      revision: row.revision,
      commandId: row.command_id,
      cacheKey: row.cache_key,
      createdAt: row.created_at,
    }
  }

  private rowToReadModel(row: ReadModelRow): ReadModelRecord {
    return {
      id: row.id,
      collection: row.collection,
      cacheKey: row.cache_key,
      serverData: row.server_data,
      effectiveData: row.effective_data,
      hasLocalChanges: row.has_local_changes === 1,
      updatedAt: row.updated_at,
    }
  }
}

// Row types for SQLite results

interface CommandRow {
  command_id: string
  service: string
  type: string
  payload: string
  status: string
  depends_on: string
  blocked_by: string
  attempts: number
  last_attempt_at: number | null
  anticipated_event_ids: string
  error: string | null
  server_response: string | null
  created_at: number
  updated_at: number
}

interface EventRow {
  id: string
  type: string
  stream_id: string
  persistence: string
  data: string
  position: string | null
  revision: string | null
  command_id: string | null
  cache_key: string
  created_at: number
}

interface ReadModelRow {
  id: string
  collection: string
  cache_key: string
  server_data: string | null
  effective_data: string
  has_local_changes: number
  updated_at: number
}
