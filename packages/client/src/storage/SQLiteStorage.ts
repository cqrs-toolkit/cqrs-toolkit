/**
 * SQLite storage implementation.
 *
 * Always receives an injected `ISqliteDb` — never loads WASM or opens
 * databases itself.  Two creation paths exist upstream:
 *
 * - **Mode C** (DedicatedWorker): `loadAndOpenDb()` → `LocalSqliteDb`
 * - **Mode B** (SharedWorker): `RemoteSqliteDb` proxying to a child worker
 */

import type { CommandFilter, CommandRecord, CommandStatus } from '../types/commands.js'
import type { ISqliteDb } from './ISqliteDb.js'
import type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  QueryOptions,
  ReadModelRecord,
  SessionRecord,
} from './IStorage.js'
import { getPendingMigrations } from './schema/index.js'

const MIGRATIONS_TABLE = `CREATE TABLE migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`

/**
 * SQLite storage configuration.
 */
export interface SQLiteStorageConfig {
  /** Injected async SQLite database handle */
  db: ISqliteDb
}

/**
 * SQLite storage implementation.
 */
export class SQLiteStorage implements IStorage {
  private readonly db: ISqliteDb
  private initialized = false

  constructor(config: SQLiteStorageConfig) {
    this.db = config.db
  }

  // Lifecycle

  async initialize(): Promise<void> {
    if (this.initialized) return

    await this.runMigrations()

    this.initialized = true
  }

  async close(): Promise<void> {
    await this.db.close()
    this.initialized = false
  }

  async clear(): Promise<void> {
    this.assertInitialized()
    // Delete all data but keep schema
    await this.exec('DELETE FROM session')
    await this.exec('DELETE FROM cache_keys')
    await this.exec('DELETE FROM commands')
    await this.exec('DELETE FROM cached_events')
    await this.exec('DELETE FROM read_models')
  }

  // Session operations

  async getSession(): Promise<SessionRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<{
      id: number
      user_id: string
      created_at: number
      last_seen_at: number
    }>('SELECT * FROM session WHERE id = 1')

    if (!row) return undefined

    return {
      id: 1,
      userId: row.user_id,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
    }
  }

  async saveSession(session: SessionRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT OR REPLACE INTO session (id, user_id, created_at, last_seen_at)
       VALUES (1, ?, ?, ?)`,
      [session.userId, session.createdAt, session.lastSeenAt],
    )
  }

  async deleteSession(): Promise<void> {
    this.assertInitialized()
    // Delete session and all associated data
    await this.exec('DELETE FROM session')
    await this.exec('DELETE FROM cache_keys')
    await this.exec('DELETE FROM commands')
    await this.exec('DELETE FROM cached_events')
    await this.exec('DELETE FROM read_models')
  }

  async touchSession(): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE session SET last_seen_at = ? WHERE id = 1', [Date.now()])
  }

  // Cache key operations

  async getCacheKey(key: string): Promise<CacheKeyRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CacheKeyRow>('SELECT * FROM cache_keys WHERE key = ?', [key])

    if (!row) return undefined

    return this.rowToCacheKey(row)
  }

  async getAllCacheKeys(): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = await this.query<CacheKeyRow>('SELECT * FROM cache_keys')
    return rows.map((row) => this.rowToCacheKey(row))
  }

  async saveCacheKey(record: CacheKeyRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT OR REPLACE INTO cache_keys (key, last_accessed_at, hold_count, frozen, expires_at, created_at, eviction_policy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        record.key,
        record.lastAccessedAt,
        record.holdCount,
        record.frozen ? 1 : 0,
        record.expiresAt,
        record.createdAt,
        record.evictionPolicy,
      ],
    )
  }

  async deleteCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM cache_keys WHERE key = ?', [key])
    await this.exec('DELETE FROM cached_events WHERE cache_key = ?', [key])
    await this.exec('DELETE FROM read_models WHERE cache_key = ?', [key])
  }

  async holdCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE cache_keys SET hold_count = hold_count + 1 WHERE key = ?', [key])
  }

  async releaseCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE cache_keys SET hold_count = MAX(0, hold_count - 1) WHERE key = ?', [
      key,
    ])
  }

  async touchCacheKey(key: string): Promise<void> {
    this.assertInitialized()
    await this.exec('UPDATE cache_keys SET last_accessed_at = ? WHERE key = ?', [Date.now(), key])
  }

  async getEvictableCacheKeys(limit: number): Promise<CacheKeyRecord[]> {
    this.assertInitialized()
    const rows = await this.query<CacheKeyRow>(
      `SELECT * FROM cache_keys
       WHERE hold_count = 0 AND frozen = 0
       ORDER BY CASE eviction_policy WHEN 'ephemeral' THEN 0 ELSE 1 END,
                last_accessed_at ASC
       LIMIT ?`,
      [limit],
    )

    return rows.map((row) => this.rowToCacheKey(row))
  }

  // Command operations

  async getCommand(commandId: string): Promise<CommandRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<CommandRow>('SELECT * FROM commands WHERE command_id = ?', [
      commandId,
    ])

    if (!row) return undefined

    return this.rowToCommand(row)
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

      if (filter?.offset !== undefined) {
        sql += ' OFFSET ?'
        params.push(filter.offset)
      }
    }

    const rows = await this.query<CommandRow>(sql, params)
    return rows.map((row) => this.rowToCommand(row))
  }

  async getCommandsByStatus(status: CommandStatus | CommandStatus[]): Promise<CommandRecord[]> {
    return this.getCommands({ status })
  }

  async getCommandsBlockedBy(commandId: string): Promise<CommandRecord[]> {
    this.assertInitialized()
    const rows = await this.query<CommandRow>(
      `SELECT * FROM commands WHERE EXISTS (SELECT 1 FROM json_each(blocked_by) WHERE value = ?)`,
      [commandId],
    )
    return rows.map((row) => this.rowToCommand(row))
  }

  async saveCommand(command: CommandRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
      `INSERT OR REPLACE INTO commands
       (command_id, service, type, payload, status, depends_on, blocked_by, attempts,
        last_attempt_at, error, server_response, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    await this.exec('DELETE FROM commands WHERE command_id = ?', [commandId])
    await this.exec('DELETE FROM cached_events WHERE command_id = ?', [commandId])
  }

  async deleteAllCommands(): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM commands')
    await this.exec("DELETE FROM cached_events WHERE persistence = 'Anticipated'")
  }

  // Event cache operations

  async getCachedEvent(id: string): Promise<CachedEventRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<EventRow>('SELECT * FROM cached_events WHERE id = ?', [id])

    if (!row) return undefined

    return this.rowToEvent(row)
  }

  async getCachedEventsByCacheKey(cacheKey: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const rows = await this.query<EventRow>('SELECT * FROM cached_events WHERE cache_key = ?', [
      cacheKey,
    ])
    return rows.map((row) => this.rowToEvent(row))
  }

  async getCachedEventsByStream(streamId: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const rows = await this.query<EventRow>(
      `SELECT * FROM cached_events WHERE stream_id = ?
       ORDER BY CASE WHEN position IS NOT NULL THEN CAST(position AS INTEGER) END ASC,
                created_at ASC`,
      [streamId],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async getAnticipatedEventsByCommand(commandId: string): Promise<CachedEventRecord[]> {
    this.assertInitialized()
    const rows = await this.query<EventRow>(
      "SELECT * FROM cached_events WHERE persistence = 'Anticipated' AND command_id = ?",
      [commandId],
    )
    return rows.map((row) => this.rowToEvent(row))
  }

  async saveCachedEvent(event: CachedEventRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
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
    if (events.length === 0) return

    const columns =
      '(id, type, stream_id, persistence, data, position, revision, command_id, cache_key, created_at)'
    const placeholder = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const placeholders = events.map(() => placeholder).join(', ')
    const params: unknown[] = []

    for (const event of events) {
      params.push(
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
      )
    }

    await this.exec(`INSERT OR IGNORE INTO cached_events ${columns} VALUES ${placeholders}`, params)
  }

  async deleteCachedEvent(id: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM cached_events WHERE id = ?', [id])
  }

  async deleteAnticipatedEventsByCommand(commandId: string): Promise<void> {
    this.assertInitialized()
    await this.exec(
      "DELETE FROM cached_events WHERE persistence = 'Anticipated' AND command_id = ?",
      [commandId],
    )
  }

  async deleteCachedEventsByCacheKey(cacheKey: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM cached_events WHERE cache_key = ?', [cacheKey])
  }

  // Read model operations

  async getReadModel(collection: string, id: string): Promise<ReadModelRecord | undefined> {
    this.assertInitialized()
    const row = await this.queryOne<ReadModelRow>(
      'SELECT * FROM read_models WHERE collection = ? AND id = ?',
      [collection, id],
    )

    if (!row) return undefined

    return this.rowToReadModel(row)
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

      if (options?.offset !== undefined) {
        sql += ' OFFSET ?'
        params.push(options.offset)
      }
    }

    const rows = await this.query<ReadModelRow>(sql, params)
    return rows.map((row) => this.rowToReadModel(row))
  }

  async getReadModelsByCacheKey(cacheKey: string): Promise<ReadModelRecord[]> {
    this.assertInitialized()
    const rows = await this.query<ReadModelRow>('SELECT * FROM read_models WHERE cache_key = ?', [
      cacheKey,
    ])
    return rows.map((row) => this.rowToReadModel(row))
  }

  async saveReadModel(record: ReadModelRecord): Promise<void> {
    this.assertInitialized()
    await this.exec(
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
    if (records.length === 0) return

    const columns =
      '(id, collection, cache_key, server_data, effective_data, has_local_changes, updated_at)'
    const placeholder = '(?, ?, ?, ?, ?, ?, ?)'
    const placeholders = records.map(() => placeholder).join(', ')
    const params: unknown[] = []

    for (const record of records) {
      params.push(
        record.id,
        record.collection,
        record.cacheKey,
        record.serverData,
        record.effectiveData,
        record.hasLocalChanges ? 1 : 0,
        record.updatedAt,
      )
    }

    await this.exec(`INSERT OR REPLACE INTO read_models ${columns} VALUES ${placeholders}`, params)
  }

  async deleteReadModel(collection: string, id: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM read_models WHERE collection = ? AND id = ?', [collection, id])
  }

  async deleteReadModelsByCacheKey(cacheKey: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM read_models WHERE cache_key = ?', [cacheKey])
  }

  async deleteReadModelsByCollection(collection: string): Promise<void> {
    this.assertInitialized()
    await this.exec('DELETE FROM read_models WHERE collection = ?', [collection])
  }

  async getReadModelCount(): Promise<number> {
    this.assertInitialized()
    const rows = await this.query<{ count: number }>('SELECT COUNT(*) as count FROM read_models')
    return rows[0]?.count ?? 0
  }

  // Private helpers

  private async runMigrations(): Promise<void> {
    const tables = await this.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migrations'",
    )

    let currentVersion: number
    if (tables.length === 0) {
      await this.exec(MIGRATIONS_TABLE)
      currentVersion = 0
    } else {
      const rows = await this.query<{ version: number | null }>(
        'SELECT MAX(version) as version FROM migrations',
      )
      currentVersion = rows[0]?.version ?? 0
    }

    const pending = getPendingMigrations(currentVersion)

    for (const migration of pending) {
      await this.exec('BEGIN')
      try {
        for (const sql of migration.sql) {
          await this.exec(sql)
        }
        await this.exec('INSERT INTO migrations (version, applied_at) VALUES (?, ?)', [
          migration.version,
          Date.now(),
        ])
        await this.exec('COMMIT')
      } catch (error) {
        await this.exec('ROLLBACK')
        throw error
      }
    }
  }

  private async exec(sql: string, params?: unknown[]): Promise<void> {
    await this.db.exec(sql, { bind: params })
  }

  private async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.exec<T>(sql, {
      bind: params,
      rowMode: 'object',
      returnValue: 'resultRows',
    })
  }

  private async queryOne<T>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T>(sql, params)
    return rows[0]
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

  private rowToCacheKey(row: CacheKeyRow): CacheKeyRecord {
    return {
      key: row.key,
      lastAccessedAt: row.last_accessed_at,
      holdCount: row.hold_count,
      frozen: row.frozen === 1,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      evictionPolicy: row.eviction_policy as CacheKeyRecord['evictionPolicy'],
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

interface CacheKeyRow {
  key: string
  last_accessed_at: number
  hold_count: number
  frozen: number
  expires_at: number | null
  created_at: number
  eviction_policy: string
}

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
