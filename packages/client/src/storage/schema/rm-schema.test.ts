import { describe, expect, it } from 'vitest'

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

describe('generateCollectionDDL', () => {
  it('generates CREATE TABLE and index for a collection', () => {
    const ddl = generateCollectionDDL('todos')
    expect(ddl).toHaveLength(2)
    expect(ddl[0]).toContain('CREATE TABLE rm_todos')
    expect(ddl[0]).toContain('id TEXT PRIMARY KEY')
    expect(ddl[0]).toContain('cache_key TEXT NOT NULL')
    expect(ddl[0]).toContain('_server_data TEXT')
    expect(ddl[0]).toContain('_effective_data TEXT NOT NULL')
    expect(ddl[0]).toContain('_has_local_changes INTEGER NOT NULL DEFAULT 0')
    expect(ddl[0]).toContain('updated_at INTEGER NOT NULL')
    expect(ddl[1]).toContain('CREATE INDEX idx_rm_todos_cache_key ON rm_todos (cache_key)')
  })

  it('uses the collection name in table and index names', () => {
    const ddl = generateCollectionDDL('user_profiles')
    expect(ddl[0]).toContain('CREATE TABLE rm_user_profiles')
    expect(ddl[1]).toContain('idx_rm_user_profiles_cache_key')
    expect(ddl[1]).toContain('ON rm_user_profiles')
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

  it('returns generated DDL for managed steps', () => {
    const sql = getSqlForStep({ type: 'managed', name: 'todos' })
    expect(sql).toHaveLength(2)
    expect(sql[0]).toContain('CREATE TABLE rm_todos')
  })
})
