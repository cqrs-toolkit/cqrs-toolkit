import { describe, expect, it } from 'vitest'

import { MIGRATIONS, getPendingMigrations } from './migrations.js'

describe('MIGRATIONS', () => {
  it('has at least one migration', () => {
    expect(MIGRATIONS.length).toBeGreaterThan(0)
  })

  it('has sequential versions starting from 1', () => {
    for (let i = 0; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i]?.version).toBe(i + 1)
    }
  })

  it('every migration has non-empty sql', () => {
    for (const migration of MIGRATIONS) {
      expect(migration.sql.length).toBeGreaterThan(0)
    }
  })
})

describe('getPendingMigrations', () => {
  it('returns all migrations when current version is 0', () => {
    const pending = getPendingMigrations(0)
    expect(pending).toEqual(MIGRATIONS)
  })

  it('returns empty when current version matches latest', () => {
    const latest = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0
    const pending = getPendingMigrations(latest)
    expect(pending).toEqual([])
  })
})
