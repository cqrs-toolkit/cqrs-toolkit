/**
 * Per-collection read model schema: validation, DDL generation, and helpers.
 */

import type { LibraryStep, MigrationStep, SchemaMigration } from '../../types/config.js'
import { assert } from '../../utils/assert.js'
import { REQUIRED_LIBRARY_STEPS } from './client-schema.js'

const COLLECTION_NAME_RE = /^[a-z][a-z0-9_]*$/
const COLLECTION_NAME_MAX_LENGTH = 50

/**
 * Validate the consumer's migration sequence.
 *
 * Checks:
 * 1. Sequential versions starting from 1
 * 2. Collection names are valid identifiers
 * 3. No duplicate collection names across all migrations
 * 4. All required library steps are present
 * 5. Library steps appear in ascending `version` order
 */
export function validateSchemaMigrations(
  migrations: [SchemaMigration, ...SchemaMigration[]],
): void {
  const seenCollections = new Set<string>()
  const seenLibraryStepIds = new Set<string>()
  let lastLibraryStepVersion = 0

  for (let i = 0; i < migrations.length; i++) {
    const migration = migrations[i] as SchemaMigration

    // 1. Sequential versions
    assert(
      migration.version === i + 1,
      `Migration at index ${i} must have version ${i + 1}, got ${migration.version}`,
    )

    for (const step of migration.steps) {
      if (step.type === 'managed') {
        // 2. Valid collection name
        assert(
          step.name.length <= COLLECTION_NAME_MAX_LENGTH,
          `Collection name '${step.name}' exceeds ${COLLECTION_NAME_MAX_LENGTH} characters`,
        )
        assert(
          COLLECTION_NAME_RE.test(step.name),
          `Collection name '${step.name}' must match ${COLLECTION_NAME_RE} (lowercase letters, digits, underscores, starting with a letter)`,
        )

        // 3. No duplicates
        assert(
          !seenCollections.has(step.name),
          `Duplicate collection name '${step.name}' across migrations`,
        )
        seenCollections.add(step.name)
      } else {
        // 5. Library steps in ascending version order
        assert(
          step.version > lastLibraryStepVersion,
          `Library step '${step.id}' has version ${step.version} but previous library step had version ${lastLibraryStepVersion} — library steps must have strictly increasing versions`,
        )
        lastLibraryStepVersion = step.version
        seenLibraryStepIds.add(step.id)
      }
    }
  }

  // 4. All required library steps present
  for (const requiredId of REQUIRED_LIBRARY_STEPS) {
    assert(
      seenLibraryStepIds.has(requiredId),
      `Required library step '${requiredId}' is missing from migrations. Include clientSchema.${requiredId} in your migration steps.`,
    )
  }
}

/**
 * Generate DDL for a managed collection table.
 *
 * Column conventions:
 * - Non-prefixed (`id`, `cache_key`, `updated_at`): public columns
 * - `_` prefixed (`_server_data`, `_effective_data`, `_has_local_changes`): library-private
 */
export function generateCollectionDDL(name: string): string[] {
  return [
    `CREATE TABLE rm_${name} (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL,
  _server_data TEXT,
  _effective_data TEXT NOT NULL,
  _has_local_changes INTEGER NOT NULL DEFAULT 0,
  _revision TEXT,
  _position TEXT,
  updated_at INTEGER NOT NULL,
  __client_id TEXT,
  __reconciled_at INTEGER
)`,
    `CREATE INDEX idx_rm_${name}_cache_key ON rm_${name} (cache_key)`,
  ]
}

/**
 * Extract all managed collection names from the migration sequence, in order.
 */
export function getCollectionNames(migrations: [SchemaMigration, ...SchemaMigration[]]): string[] {
  const names: string[] = []
  for (const migration of migrations) {
    for (const step of migration.steps) {
      if (step.type === 'managed') {
        names.push(step.name)
      }
    }
  }
  return names
}

/**
 * Execute the SQL for a single migration step.
 *
 * For `type: 'library'` steps, executes `step.sql[]`.
 * For `type: 'managed'` steps, executes `generateCollectionDDL(step.name)`.
 *
 * Future: when `LibraryStep` gains `collectionHook`, this function will also
 * need the set of known managed tables to apply ALTER TABLE operations.
 * The hook approach also applies to future `type: 'custom'` collections.
 */
export function getSqlForStep(step: MigrationStep): string[] {
  if (step.type === 'library') {
    return (step as LibraryStep).sql
  }
  return generateCollectionDDL(step.name)
}
