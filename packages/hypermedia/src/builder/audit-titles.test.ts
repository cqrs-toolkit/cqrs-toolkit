import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditSchemaTitles } from './audit-titles.js'

describe('auditSchemaTitles', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'audit-titles-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns zero counts when schemas dir does not exist', () => {
    const result = auditSchemaTitles(dir)
    expect(result).toEqual({ checked: 0, missing: [] })
  })

  it('returns zero missing when every schema has a non-empty title', () => {
    writeSchema(dir, 'urn/schema/a/1.0.0.json', { title: 'A', type: 'object' })
    writeSchema(dir, 'urn/schema/b/1.0.0.json', { title: 'B', type: 'object' })

    const result = auditSchemaTitles(dir)
    expect(result.checked).toBe(2)
    expect(result.missing).toEqual([])
  })

  it('reports schemas missing or with empty titles, paths relative to outputDir', () => {
    writeSchema(dir, 'urn/schema/has-title/1.0.0.json', { title: 'HasTitle', type: 'object' })
    writeSchema(dir, 'urn/schema/no-title/1.0.0.json', { type: 'object' })
    writeSchema(dir, 'urn/schema/empty-title/1.0.0.json', { title: '', type: 'object' })

    const result = auditSchemaTitles(dir)
    expect(result.checked).toBe(3)
    expect(result.missing.sort()).toEqual([
      join('schemas', 'urn/schema/empty-title/1.0.0.json'),
      join('schemas', 'urn/schema/no-title/1.0.0.json'),
    ])
  })

  it('ignores non-JSON files in the schemas tree', () => {
    writeSchema(dir, 'urn/schema/keep/1.0.0.json', { title: 'Keep', type: 'object' })
    mkdirSync(join(dir, 'schemas', 'urn', 'schema', 'skip'), { recursive: true })
    writeFileSync(join(dir, 'schemas', 'urn', 'schema', 'skip', 'README.md'), '# not a schema')

    const result = auditSchemaTitles(dir)
    expect(result.checked).toBe(1)
    expect(result.missing).toEqual([])
  })
})

function writeSchema(dir: string, relPath: string, body: object): void {
  const full = join(dir, 'schemas', relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, JSON.stringify(body))
}
