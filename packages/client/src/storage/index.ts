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

export { InMemoryStorage } from './InMemoryStorage.js'
export { ALL_TABLES, MIGRATIONS, getPendingMigrations, getSchemaVersion } from './schema/index.js'
export type { Migration } from './schema/index.js'
export { SQLiteStorage } from './SQLiteStorage.js'
export type { SQLiteStorageConfig, VfsType } from './SQLiteStorage.js'
