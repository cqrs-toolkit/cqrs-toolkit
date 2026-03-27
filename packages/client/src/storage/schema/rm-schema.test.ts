import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SchemaMigration } from '../../types/config.js'
import { clientSchema } from './client-schema.js'
import {
  generateCollectionDDL,
  getCollectionNames,
  getSqlForStep,
  validateSchemaMigrations,
} from './rm-schema.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_MIGRATION: [SchemaMigration] = [
  {
    version: 1,
    message: 'Initial setup',
    steps: [clientSchema.init, { type: 'managed', name: 'todos' }],
  },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateSchemaMigrations', () => {
  it('accepts a valid single migration', () => {
    expect(() => validateSchemaMigrations(VALID_MIGRATION)).not.toThrow()
  })

  it('accepts multiple sequential migrations', () => {
    const migrations: [SchemaMigration, ...SchemaMigration[]] = [
      {
        version: 1,
        message: 'Initial setup',
        steps: [clientSchema.init, { type: 'managed', name: 'todos' }],
      },
      {
        version: 2,
        message: 'Add notes',
        steps: [{ type: 'managed', name: 'notes' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).not.toThrow()
  })

  it('rejects non-sequential versions', () => {
    const migrations: [SchemaMigration, ...SchemaMigration[]] = [
      {
        version: 1,
        message: 'Initial setup',
        steps: [clientSchema.init, { type: 'managed', name: 'todos' }],
      },
      {
        version: 3,
        message: 'Skipped version 2',
        steps: [{ type: 'managed', name: 'notes' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow('must have version 2, got 3')
  })

  it('rejects invalid collection name — starts with digit', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Bad name',
        steps: [clientSchema.init, { type: 'managed', name: '1todos' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow('must match')
  })

  it('rejects invalid collection name — uppercase', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Bad name',
        steps: [clientSchema.init, { type: 'managed', name: 'Todos' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow('must match')
  })

  it('rejects invalid collection name — contains hyphen', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Bad name',
        steps: [clientSchema.init, { type: 'managed', name: 'my-todos' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow('must match')
  })

  it('rejects collection name exceeding max length', () => {
    const longName = 'a'.repeat(51)
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Too long',
        steps: [clientSchema.init, { type: 'managed', name: longName }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow('exceeds 50 characters')
  })

  it('rejects duplicate collection names across migrations', () => {
    const migrations: [SchemaMigration, ...SchemaMigration[]] = [
      {
        version: 1,
        message: 'Initial setup',
        steps: [clientSchema.init, { type: 'managed', name: 'todos' }],
      },
      {
        version: 2,
        message: 'Duplicate',
        steps: [{ type: 'managed', name: 'todos' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow("Duplicate collection name 'todos'")
  })

  it('rejects duplicate collection names within a migration', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Dupe in one migration',
        steps: [
          clientSchema.init,
          { type: 'managed', name: 'todos' },
          { type: 'managed', name: 'todos' },
        ],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow("Duplicate collection name 'todos'")
  })

  it('rejects when required library step is missing', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'No init step',
        steps: [{ type: 'managed', name: 'todos' }],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow(
      "Required library step 'init' is missing",
    )
  })

  it('rejects library steps with non-increasing versions', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Out of order',
        steps: [
          { type: 'library', id: 'future', version: 5, sql: ['SELECT 1'] },
          clientSchema.init,
          { type: 'managed', name: 'todos' },
        ],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).toThrow(
      'must have strictly increasing versions',
    )
  })

  it('accepts valid collection names with underscores and digits', () => {
    const migrations: [SchemaMigration] = [
      {
        version: 1,
        message: 'Valid names',
        steps: [
          clientSchema.init,
          { type: 'managed', name: 'todo_items' },
          { type: 'managed', name: 'notes2' },
          { type: 'managed', name: 'a' },
        ],
      },
    ]
    expect(() => validateSchemaMigrations(migrations)).not.toThrow()
  })
})

describe('generateCollectionDDL (SQLite execution)', () => {
  let db: Database.Database

  beforeEach(() => {
    db = new Database(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('creates read model table and junction table without errors', () => {
    const ddl = generateCollectionDDL('todos')
    for (const sql of ddl) {
      db.exec(sql)
    }

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    const tableNames = tables.map((t) => t.name)

    expect(tableNames).toContain('rm_todos')
    expect(tableNames).toContain('rm_todos_cache_keys')
  })

  it('creates correct columns on read model table', () => {
    for (const sql of generateCollectionDDL('todos')) {
      db.exec(sql)
    }

    const columns = db.prepare('PRAGMA table_info(rm_todos)').all() as { name: string }[]
    const columnNames = columns.map((c) => c.name)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('_server_data')
    expect(columnNames).toContain('_effective_data')
    expect(columnNames).toContain('_has_local_changes')
    expect(columnNames).toContain('_revision')
    expect(columnNames).toContain('_position')
    expect(columnNames).toContain('updated_at')
    // cache_key is NOT on the main table — it's in the junction table
    expect(columnNames).not.toContain('cache_key')
  })

  it('creates correct columns on junction table', () => {
    for (const sql of generateCollectionDDL('todos')) {
      db.exec(sql)
    }

    const columns = db.prepare('PRAGMA table_info(rm_todos_cache_keys)').all() as {
      name: string
    }[]
    const columnNames = columns.map((c) => c.name)

    expect(columnNames).toContain('entity_id')
    expect(columnNames).toContain('cache_key')
  })

  it('creates index on junction table', () => {
    for (const sql of generateCollectionDDL('todos')) {
      db.exec(sql)
    }

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='rm_todos_cache_keys'",
      )
      .all() as { name: string }[]
    const indexNames = indexes.map((i) => i.name)

    expect(indexNames).toContain('idx_rm_todos_cks_cache_key')
  })

  it('full migration with clientSchema.init + managed collection executes without errors', () => {
    // Run all library init DDL
    for (const sql of clientSchema.init.sql) {
      db.exec(sql)
    }
    // Run managed collection DDL
    for (const sql of generateCollectionDDL('todos')) {
      db.exec(sql)
    }
    for (const sql of generateCollectionDDL('notes')) {
      db.exec(sql)
    }

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[]
    const tableNames = tables.map((t) => t.name)

    // Library tables
    expect(tableNames).toContain('session')
    expect(tableNames).toContain('cache_keys')
    expect(tableNames).toContain('commands')
    expect(tableNames).toContain('cached_events')
    expect(tableNames).toContain('cached_event_cache_keys')
    // Managed collection tables
    expect(tableNames).toContain('rm_todos')
    expect(tableNames).toContain('rm_todos_cache_keys')
    expect(tableNames).toContain('rm_notes')
    expect(tableNames).toContain('rm_notes_cache_keys')
  })
})

describe('getCollectionNames', () => {
  it('extracts collection names from migrations', () => {
    const migrations: [SchemaMigration, ...SchemaMigration[]] = [
      {
        version: 1,
        message: 'Initial',
        steps: [clientSchema.init, { type: 'managed', name: 'todos' }],
      },
      {
        version: 2,
        message: 'Add notes',
        steps: [{ type: 'managed', name: 'notes' }],
      },
    ]
    expect(getCollectionNames(migrations)).toEqual(['todos', 'notes'])
  })

  it('returns empty for migrations with no managed collections', () => {
    const migrations: [SchemaMigration] = [
      { version: 1, message: 'Init only', steps: [clientSchema.init] },
    ]
    expect(getCollectionNames(migrations)).toEqual([])
  })
})

describe('getSqlForStep', () => {
  it('returns sql array for library steps', () => {
    const sql = getSqlForStep(clientSchema.init)
    expect(sql).toBe(clientSchema.init.sql)
  })

  it('returns generated DDL for managed steps that executes without errors', () => {
    const db = new Database(':memory:')
    try {
      const sql = getSqlForStep({ type: 'managed', name: 'todos' })
      for (const stmt of sql) {
        db.exec(stmt)
      }
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
        name: string
      }[]
      expect(tables.map((t) => t.name)).toContain('rm_todos')
    } finally {
      db.close()
    }
  })
})
