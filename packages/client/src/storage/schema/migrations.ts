import { assert } from '../../utils/assert.js'
import { migration001 } from './migrations/001_init.js'

export interface Migration {
  version: number
  description: string
  sql: string[]
}

export const MIGRATIONS: Migration[] = [migration001]

for (let i = 0; i < MIGRATIONS.length; i++) {
  assert(
    MIGRATIONS[i]?.version === i + 1,
    `Migration at index ${i} must have version ${i + 1}, got ${MIGRATIONS[i]?.version}`,
  )
}

export function getPendingMigrations(currentVersion: number): Migration[] {
  return MIGRATIONS.filter((m) => m.version > currentVersion)
}
