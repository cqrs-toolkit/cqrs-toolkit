/**
 * Storage exports.
 */

export type {
  CacheKeyRecord,
  CachedEventRecord,
  IStorage,
  QueryOptions,
  ReadModelRecord,
  SessionRecord,
} from './IStorage.js'

export type { ISqliteDb } from './ISqliteDb.js'

export { InMemoryStorage } from './InMemoryStorage.js'
export { LocalSqliteDb, loadAndOpenDb } from './LocalSqliteDb.js'
export type { LoadAndOpenDbConfig, VfsType } from './LocalSqliteDb.js'
export { MIGRATIONS, getPendingMigrations } from './schema/index.js'
export type { Migration } from './schema/index.js'
export { SQLiteStorage } from './SQLiteStorage.js'
export type { SQLiteStorageConfig } from './SQLiteStorage.js'
