import { describe, expect, it } from 'vitest'
import { BetterSqliteDb } from './BetterSqliteDb.js'

describe('BetterSqliteDb', () => {
  it('executes multi-statement DDL without bind params', async () => {
    const db = new BetterSqliteDb(':memory:')

    await db.exec(`
      CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO test (id, name) VALUES (1, 'hello');
    `)

    const rows = await db.exec<{ id: number; name: string }>('SELECT * FROM test', {
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    expect(rows).toEqual([{ id: 1, name: 'hello' }])

    await db.close()
  })

  it('executes parameterized queries', async () => {
    const db = new BetterSqliteDb(':memory:')
    await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)')
    await db.exec('INSERT INTO test (id, value) VALUES (?, ?)', { bind: [1, 'first'] })
    await db.exec('INSERT INTO test (id, value) VALUES (?, ?)', { bind: [2, 'second'] })

    const rows = await db.exec<{ id: number; value: string }>('SELECT * FROM test WHERE id = ?', {
      bind: [2],
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    expect(rows).toEqual([{ id: 2, value: 'second' }])

    await db.close()
  })

  it('returns empty array for queries with no matching rows', async () => {
    const db = new BetterSqliteDb(':memory:')
    await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)')

    const rows = await db.exec<{ id: number }>('SELECT * FROM test', {
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    expect(rows).toEqual([])

    await db.close()
  })

  it('enables WAL mode on file-based databases', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')
    const dir = mkdtempSync(join(tmpdir(), 'cqrs-wal-'))
    const dbPath = join(dir, 'test.db')

    const db = new BetterSqliteDb(dbPath)

    const rows = await db.exec<{ journal_mode: string }>('PRAGMA journal_mode', {
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    expect(rows[0]?.journal_mode).toBe('wal')

    await db.close()
    rmSync(dir, { recursive: true })
  })

  it('enables foreign keys', async () => {
    const db = new BetterSqliteDb(':memory:')

    const rows = await db.exec<{ foreign_keys: number }>('PRAGMA foreign_keys', {
      rowMode: 'object',
      returnValue: 'resultRows',
    })
    expect(rows[0]?.foreign_keys).toBe(1)

    await db.close()
  })
})
