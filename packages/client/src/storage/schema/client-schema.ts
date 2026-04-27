/**
 * Library-owned schema steps.
 *
 * Consumers place these steps in their `SchemaMigration` sequence to create
 * the infrastructure tables the library requires.
 */

import type { LibraryStep } from '../../types/config.js'

const SESSION_TABLE = `
CREATE TABLE session (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
)`

const CACHE_KEYS_TABLE = `
CREATE TABLE cache_keys (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  link_service TEXT,
  link_type TEXT,
  link_id TEXT,
  service TEXT,
  scope_type TEXT,
  scope_params TEXT,
  parent_key TEXT,
  eviction_policy TEXT NOT NULL DEFAULT 'persistent',
  frozen INTEGER NOT NULL DEFAULT 0,
  frozen_at INTEGER,
  inherited_frozen INTEGER NOT NULL DEFAULT 0,
  last_accessed_at INTEGER NOT NULL,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  hold_count INTEGER NOT NULL DEFAULT 0,
  estimated_size_bytes INTEGER,
  pending_id_mappings TEXT
)`

const CACHE_KEYS_ACCESS_INDEX = `
CREATE INDEX idx_cache_keys_access ON cache_keys (last_accessed_at)`

const COMMANDS_TABLE = `
CREATE TABLE commands (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT NOT NULL UNIQUE,
  cache_key TEXT NOT NULL,
  service TEXT NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT NOT NULL,
  depends_on TEXT NOT NULL DEFAULT '[]',
  blocked_by TEXT NOT NULL DEFAULT '[]',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  error TEXT,
  server_response TEXT,
  post_process TEXT,
  creates TEXT,
  revision TEXT,
  path TEXT,
  file_refs TEXT,
  command_id_paths TEXT,
  affected_aggregates TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)`

const COMMANDS_STATUS_INDEX = `
CREATE INDEX idx_commands_status ON commands (status)`

const COMMANDS_TYPE_INDEX = `
CREATE INDEX idx_commands_type ON commands (type)`

const CACHED_EVENTS_TABLE = `
CREATE TABLE cached_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  persistence TEXT NOT NULL,
  data TEXT NOT NULL,
  position TEXT,
  revision TEXT,
  command_id TEXT,
  created_at INTEGER NOT NULL,
  processed_at INTEGER
)`

const CACHED_EVENT_CACHE_KEYS_TABLE = `
CREATE TABLE cached_event_cache_keys (
  event_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  PRIMARY KEY (event_id, cache_key)
)`

const CACHED_EVENT_CACHE_KEYS_INDEX = `
CREATE INDEX idx_cecks_cache_key ON cached_event_cache_keys (cache_key)`

const CACHED_EVENTS_STREAM_INDEX = `
CREATE INDEX idx_cached_events_stream ON cached_events (stream_id, position)`

const CACHED_EVENTS_COMMAND_INDEX = `
CREATE INDEX idx_cached_events_command ON cached_events (command_id)`

const COMMAND_ID_MAPPINGS_TABLE = `
CREATE TABLE command_id_mappings (
  client_id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`

const COMMAND_ID_MAPPINGS_SERVER_INDEX = `
CREATE INDEX idx_command_id_mappings_server ON command_id_mappings (server_id)`

/**
 * Library schema steps.
 *
 * Consumers include these in their migration sequence:
 * ```ts
 * steps: [clientSchema.init, { type: 'managed', name: 'todos' }]
 * ```
 */
export const clientSchema = {
  init: {
    type: 'library',
    id: 'init',
    version: 1,
    sql: [
      SESSION_TABLE,
      CACHE_KEYS_TABLE,
      CACHE_KEYS_ACCESS_INDEX,
      COMMANDS_TABLE,
      COMMANDS_STATUS_INDEX,
      COMMANDS_TYPE_INDEX,
      CACHED_EVENTS_TABLE,
      CACHED_EVENT_CACHE_KEYS_TABLE,
      CACHED_EVENT_CACHE_KEYS_INDEX,
      CACHED_EVENTS_STREAM_INDEX,
      CACHED_EVENTS_COMMAND_INDEX,
      COMMAND_ID_MAPPINGS_TABLE,
      COMMAND_ID_MAPPINGS_SERVER_INDEX,
    ],
  },
} satisfies Record<string, LibraryStep>

/**
 * Library step IDs that must appear in the migration sequence.
 */
export const REQUIRED_LIBRARY_STEPS: readonly string[] = ['init']
