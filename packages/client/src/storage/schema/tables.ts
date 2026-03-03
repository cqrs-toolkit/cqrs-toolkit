/**
 * SQLite table definitions for CQRS Client storage.
 *
 * BigInt values are stored as TEXT since SQLite integers are limited to 64-bit
 * and JavaScript BigInt can exceed that. Position and revision are examples.
 */

/**
 * Session table - single row table for current user session.
 */
export const SESSION_TABLE = `
CREATE TABLE IF NOT EXISTS session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
)`

/**
 * Cache keys table - tracks active cache keys and their metadata.
 */
export const CACHE_KEYS_TABLE = `
CREATE TABLE IF NOT EXISTS cache_keys (
  key TEXT PRIMARY KEY,
  last_accessed_at INTEGER NOT NULL,
  hold_count INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER,
  created_at INTEGER NOT NULL
)`

export const CACHE_KEYS_ACCESS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_cache_keys_access ON cache_keys (last_accessed_at)`

/**
 * Commands table - command queue with status tracking.
 */
export const COMMANDS_TABLE = `
CREATE TABLE IF NOT EXISTS commands (
  command_id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  depends_on TEXT NOT NULL DEFAULT '[]',
  blocked_by TEXT NOT NULL DEFAULT '[]',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  error TEXT,
  server_response TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`

export const COMMANDS_STATUS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_commands_status ON commands (status)`

export const COMMANDS_TYPE_INDEX = `
CREATE INDEX IF NOT EXISTS idx_commands_type ON commands (type)`

/**
 * Cached events table - stores server and anticipated events.
 */
export const CACHED_EVENTS_TABLE = `
CREATE TABLE IF NOT EXISTS cached_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  persistence TEXT NOT NULL,
  data TEXT NOT NULL,
  position TEXT,
  revision TEXT,
  command_id TEXT,
  cache_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`

export const CACHED_EVENTS_CACHE_KEY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_cached_events_cache_key ON cached_events (cache_key)`

export const CACHED_EVENTS_STREAM_INDEX = `
CREATE INDEX IF NOT EXISTS idx_cached_events_stream ON cached_events (stream_id, position)`

export const CACHED_EVENTS_COMMAND_INDEX = `
CREATE INDEX IF NOT EXISTS idx_cached_events_command ON cached_events (command_id)`

/**
 * Read models table - stores materialized read model data.
 */
export const READ_MODELS_TABLE = `
CREATE TABLE IF NOT EXISTS read_models (
  id TEXT NOT NULL,
  collection TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  server_data TEXT,
  effective_data TEXT NOT NULL,
  has_local_changes INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (collection, id)
)`

export const READ_MODELS_CACHE_KEY_INDEX = `
CREATE INDEX IF NOT EXISTS idx_read_models_cache_key ON read_models (cache_key)`

export const READ_MODELS_COLLECTION_INDEX = `
CREATE INDEX IF NOT EXISTS idx_read_models_collection ON read_models (collection)`

/**
 * Migrations table - tracks applied migrations.
 */
export const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`

/**
 * All table creation statements in order.
 */
export const ALL_TABLES = [
  SESSION_TABLE,
  CACHE_KEYS_TABLE,
  CACHE_KEYS_ACCESS_INDEX,
  COMMANDS_TABLE,
  COMMANDS_STATUS_INDEX,
  COMMANDS_TYPE_INDEX,
  CACHED_EVENTS_TABLE,
  CACHED_EVENTS_CACHE_KEY_INDEX,
  CACHED_EVENTS_STREAM_INDEX,
  CACHED_EVENTS_COMMAND_INDEX,
  READ_MODELS_TABLE,
  READ_MODELS_CACHE_KEY_INDEX,
  READ_MODELS_COLLECTION_INDEX,
  MIGRATIONS_TABLE,
]
