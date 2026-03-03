/**
 * SQLite migrations for CQRS Client storage.
 *
 * Migrations are applied in order and tracked in the migrations table.
 * Each migration has a version number and SQL statements to execute.
 */

/**
 * Migration definition.
 */
export interface Migration {
  version: number
  description: string
  sql: string[]
}

/**
 * All migrations in order.
 * Version 0 is the initial schema creation (handled separately).
 */
export const MIGRATIONS: Migration[] = [
  // Future migrations will be added here
  // {
  //   version: 1,
  //   description: 'Add example column',
  //   sql: [
  //     'ALTER TABLE example ADD COLUMN new_column TEXT',
  //   ],
  // },
]

/**
 * Get the current schema version.
 */
export function getSchemaVersion(): number {
  return MIGRATIONS.length
}

/**
 * Get migrations that need to be applied.
 *
 * @param currentVersion - Currently applied version
 * @returns Migrations to apply
 */
export function getPendingMigrations(currentVersion: number): Migration[] {
  return MIGRATIONS.filter((m) => m.version > currentVersion)
}
