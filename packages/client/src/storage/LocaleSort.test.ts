/**
 * Integration coverage for custom-collation locale-aware sort.
 *
 * Three layers exercised end-to-end:
 *
 * 1. **Schema validator** — {@link validateSchemaMigrations} accepts custom
 *    collation names that appear in the registered collations list, and
 *    rejects names that don't.
 * 2. **DDL emission** — {@link generateCollectionDDL} emits the column with
 *    `COLLATE <name>` so any opened SQLite connection that has registered
 *    the matching collation orders the index accordingly.
 * 3. **JS-side ordering** — {@link InMemoryStorage} threads the same
 *    `CollationConfig.compare` into its in-JS sort path so Mode A and the
 *    SQL backends agree on row order for the same query.
 *
 * The actual WASM-side registration is covered by Playwright e2e on the
 * demos (the demo configs ship a `locale_en` collation and sort by it).
 * The WASM bridge in {@link loadAndOpenDb} is too thin to merit a node-only
 * harness, and `better-sqlite3` (used by the rest of this package's
 * SQL-backed tests) doesn't expose `sqlite3_create_collation_v2`.
 */

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { BetterSqliteDb } from '../testing/BetterSqliteDb.js'
import type { CollationConfig, SchemaMigration } from '../types/config.js'
import { InMemoryStorage } from './InMemoryStorage.js'
import type { ReadModelRecord } from './IStorage.js'
import { clientSchema } from './schema/client-schema.js'
import { generateCollectionDDL, validateSchemaMigrations } from './schema/rm-schema.js'
import { SQLiteStorage } from './SQLiteStorage.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * `Intl.Collator('en', { numeric: true })` reorders the same list very
 * differently from BINARY (code-point) ordering:
 *
 * - mixed case folds: `apple` and `Banana` interleave alphabetically.
 * - diacritics: `Émilie` (U+00C9) sorts between `E` and `F`, not after `Z`.
 * - numeric: `Item 2` sorts before `Item 10`.
 */
const LOCALE_EN: CollationConfig = {
  name: 'locale_en',
  compare: new Intl.Collator('en', { numeric: true }).compare,
}

function migrationsFor(steps: SchemaMigration['steps']): [SchemaMigration] {
  return [{ version: 1, message: 'test', steps: [clientSchema.init, ...steps] }]
}

function row(id: string, name: string): ReadModelRecord {
  return {
    id,
    collection: 'items',
    cacheKeys: [],
    serverData: null,
    effectiveData: JSON.stringify({ id, name }),
    hasLocalChanges: false,
    updatedAt: 0,
    revision: null,
    position: null,
    _clientMetadata: null,
  }
}

// ---------------------------------------------------------------------------
// Schema validator
// ---------------------------------------------------------------------------

describe('validateSchemaMigrations — custom collations', () => {
  const migrations = migrationsFor([
    {
      type: 'managed',
      name: 'items',
      columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'locale_en' }],
      indexes: [{ columns: ['sort_name', 'id'] }],
    },
  ])

  it('accepts a registered custom collation name', () => {
    expect(() => validateSchemaMigrations(migrations, [LOCALE_EN])).not.toThrow()
  })

  it('rejects an unregistered custom collation name', () => {
    expect(() => validateSchemaMigrations(migrations, [])).toThrow(
      /collation 'locale_en' is not registered/,
    )
  })

  it('still accepts the SQLite built-ins without a registration entry', () => {
    const builtins = migrationsFor([
      {
        type: 'managed',
        name: 'items',
        columns: [{ name: 'status', type: 'TEXT', path: '$.status', collation: 'NOCASE' }],
      },
    ])
    expect(() => validateSchemaMigrations(builtins, [])).not.toThrow()
  })

  it('matches collation names case-insensitively', () => {
    const upper = migrationsFor([
      {
        type: 'managed',
        name: 'items',
        columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'LOCALE_EN' }],
      },
    ])
    expect(() => validateSchemaMigrations(upper, [LOCALE_EN])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// DDL emission
// ---------------------------------------------------------------------------

describe('generateCollectionDDL — custom collation clause', () => {
  it('emits the column with a `COLLATE <name>` clause for use against any registered comparator', () => {
    const ddl = generateCollectionDDL({
      type: 'managed',
      name: 'items',
      columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'locale_en' }],
    })
    expect(ddl[0]).toMatch(/sort_name TEXT GENERATED ALWAYS AS .* VIRTUAL COLLATE locale_en/)
  })

  it('is rejected by sqlite when no matching collation has been registered against the connection', () => {
    // Proves the COLLATE clause is taking effect — better-sqlite3 doesn't
    // expose custom collation registration, so trying to query against
    // `locale_en` surfaces the expected "no such collation sequence".
    const db = new Database(':memory:')
    try {
      for (const sql of clientSchema.init.sql) db.exec(sql)
      const ddl = generateCollectionDDL({
        type: 'managed',
        name: 'items',
        columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'locale_en' }],
        indexes: [{ columns: ['sort_name', 'id'] }],
      })
      // Creating the CREATE INDEX is the moment SQLite resolves the
      // collation name; it raises immediately.
      expect(() => {
        for (const sql of ddl) db.exec(sql)
      }).toThrow(/no such collation/)
    } finally {
      db.close()
    }
  })
})

// ---------------------------------------------------------------------------
// JS-side ordering through InMemoryStorage
// ---------------------------------------------------------------------------

describe('InMemoryStorage — locale-aware sort', () => {
  async function bootstrap(): Promise<InMemoryStorage<never, never>> {
    const storage = new InMemoryStorage<never, never>({
      migrations: migrationsFor([
        {
          type: 'managed',
          name: 'items',
          columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'locale_en' }],
        },
      ]),
      collations: [LOCALE_EN],
    })
    await storage.initialize()
    return storage
  }

  it('orders mixed-case ASCII names alphabetically instead of by code point', async () => {
    const storage = await bootstrap()
    await storage.saveReadModels([row('r1', 'Banana'), row('r2', 'apple'), row('r3', 'Cherry')])

    const sorted = await storage.getReadModelsByCollection('items', {
      sort: [{ column: 'sort_name', direction: 'asc' }],
    })
    expect(sorted.map((r) => r.id)).toEqual(['r2', 'r1', 'r3'])
  })

  it('orders diacritics next to their base letters, not after Z', async () => {
    const storage = await bootstrap()
    await storage.saveReadModels([row('r1', 'Zebra'), row('r2', 'Émilie'), row('r3', 'Eagle')])

    const sorted = await storage.getReadModelsByCollection('items', {
      sort: [{ column: 'sort_name', direction: 'asc' }],
    })
    // `É` (U+00C9) is well past 'Z' (U+005A) in code-point order; the
    // locale comparator pulls it next to E.
    expect(sorted.map((r) => r.id)).toEqual(['r3', 'r2', 'r1'])
  })

  it('orders numeric substrings numerically with { numeric: true }', async () => {
    const storage = await bootstrap()
    await storage.saveReadModels([row('r1', 'Item 10'), row('r2', 'Item 2'), row('r3', 'Item 1')])

    const sorted = await storage.getReadModelsByCollection('items', {
      sort: [{ column: 'sort_name', direction: 'asc' }],
    })
    expect(sorted.map((r) => r.id)).toEqual(['r3', 'r2', 'r1'])
  })

  it('orders Cyrillic by alphabet position, not Unicode block', async () => {
    // The locale comparator under `en` falls through to default Unicode
    // collation for non-Latin scripts, which still orders Cyrillic letters
    // by alphabet position (А, Б, В…) and places `Ё` next to `Е` rather
    // than at the end of the block.
    const storage = await bootstrap()
    await storage.saveReadModels([row('r1', 'Я-final'), row('r2', 'Ёлка'), row('r3', 'Алина')])

    const sorted = await storage.getReadModelsByCollection('items', {
      sort: [{ column: 'sort_name', direction: 'asc' }],
    })
    expect(sorted.map((r) => r.id)).toEqual(['r3', 'r2', 'r1'])
  })

  it('breaks ties on id when configured as a composite sort', async () => {
    const storage = await bootstrap()
    await storage.saveReadModels([row('r1', 'apple'), row('r2', 'apple'), row('r3', 'apple')])

    const sorted = await storage.getReadModelsByCollection('items', {
      sort: [
        { column: 'sort_name', direction: 'asc' },
        { column: 'id', direction: 'asc' },
      ],
    })
    expect(sorted.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })

  it('falls back to raw code-point order when the column is declared without a collation', async () => {
    // The migrations still declare a `sort_name` column with a path (so
    // the resolver walks `$.name` to read the value), but no collation
    // is attached to it — verifies that absence of a registered
    // comparator falls through to the raw `<` operator instead of
    // silently applying a locale-aware default.
    const storage = new InMemoryStorage<never, never>({
      migrations: migrationsFor([
        {
          type: 'managed',
          name: 'items',
          columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name' }],
        },
      ]),
    })
    await storage.initialize()
    await storage.saveReadModels([row('r1', 'Banana'), row('r2', 'apple'), row('r3', 'Cherry')])

    const sorted = await storage.getReadModelsByCollection('items', {
      sort: [{ column: 'sort_name', direction: 'asc' }],
    })
    // Capital letters precede lowercase by code point (B/C < a).
    expect(sorted.map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })
})

// ---------------------------------------------------------------------------
// Backend without custom-collation support (better-sqlite3 / Electron)
// ---------------------------------------------------------------------------

describe('SQLiteStorage — unsupportedCollations policy', () => {
  const customCollationMigrations: [SchemaMigration] = migrationsFor([
    {
      type: 'managed',
      name: 'items',
      columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'locale_en' }],
      indexes: [{ columns: ['sort_name', 'id'] }],
    },
  ])

  const builtinCollationMigrations: [SchemaMigration] = migrationsFor([
    {
      type: 'managed',
      name: 'items',
      columns: [{ name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'NOCASE' }],
    },
  ])

  it("throws with a descriptive message under 'error' when a custom collation is referenced", () => {
    const db = new BetterSqliteDb()
    try {
      expect(
        () =>
          new SQLiteStorage({
            db,
            migrations: customCollationMigrations,
            collations: [LOCALE_EN],
            unsupportedCollations: 'error',
            backendLabel: 'better-sqlite3',
          }),
      ).toThrow(/locale_en.*better-sqlite3.*unsupportedCollations: 'degrade'/s)
    } finally {
      void db.close()
    }
  })

  it("under 'error', built-in collations stay accepted", () => {
    const db = new BetterSqliteDb()
    expect(
      () =>
        new SQLiteStorage({
          db,
          migrations: builtinCollationMigrations,
          unsupportedCollations: 'error',
          backendLabel: 'better-sqlite3',
        }),
    ).not.toThrow()
    void db.close()
  })

  it("under 'degrade', migrations apply successfully against better-sqlite3 (COLLATE stripped)", async () => {
    const db = new BetterSqliteDb()
    const storage = new SQLiteStorage({
      db,
      migrations: customCollationMigrations,
      collations: [LOCALE_EN],
      unsupportedCollations: 'degrade',
      backendLabel: 'better-sqlite3',
    })
    // No throw: schema validates, custom-collation columns roll out with
    // BINARY ordering instead of refusing to start.
    await expect(storage.initialize()).resolves.toBeUndefined()
    await storage.close()
  })

  it("under 'degrade', built-in collations are preserved verbatim in the DDL", () => {
    // Confirms that the strip only targets custom names, not the built-in
    // SQLite collations every backend supports.
    const ddl = generateCollectionDDL(
      {
        type: 'managed',
        name: 'items',
        columns: [
          { name: 'status', type: 'TEXT', path: '$.status', collation: 'NOCASE' },
          { name: 'sort_name', type: 'TEXT', path: '$.name', collation: 'locale_en' },
        ],
      },
      { stripCustomCollations: true },
    )
    expect(ddl[0]).toMatch(/status TEXT GENERATED ALWAYS AS .* VIRTUAL COLLATE NOCASE/)
    expect(ddl[0]).toMatch(/sort_name TEXT GENERATED ALWAYS AS .* VIRTUAL[^,]*$/m)
    expect(ddl[0]).not.toMatch(/COLLATE locale_en/)
  })
})
