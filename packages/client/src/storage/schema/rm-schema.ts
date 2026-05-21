/**
 * Per-collection read model schema: validation, DDL generation, and helpers.
 */

import { assert } from '#utils'
import type {
  CustomColumn,
  CustomIndex,
  LibraryStep,
  ManagedCollectionDef,
  MigrationStep,
  SchemaMigration,
} from '../../types/config.js'
import { REQUIRED_LIBRARY_STEPS } from './client-schema.js'
import { assertValidSqlIdentifier } from './sql-identifier.js'

/**
 * Library-owned columns in every `rm_<collection>` table. User-declared
 * columns must not collide with these.
 */
const LIBRARY_OWNED_COLUMNS: ReadonlySet<string> = new Set(['id', 'updated_at'])

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
        assertValidSqlIdentifier(step.name, 'Collection')

        // 3. No duplicates
        assert(
          !seenCollections.has(step.name),
          `Duplicate collection name '${step.name}' across migrations`,
        )
        seenCollections.add(step.name)

        // Custom column + index validation. Columns are validated first so
        // index references can check column names against the declared set.
        const declaredColumns = new Set<string>()
        for (const column of step.columns ?? []) {
          validateCustomColumn(step.name, column, declaredColumns)
          declaredColumns.add(column.name)
        }
        for (const index of step.indexes ?? []) {
          validateCustomIndex(step.name, index, declaredColumns)
        }
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
 * Validate a single {@link CustomColumn} declaration. Throws via `assert` on
 * any violation. Adds the column name to `declaredColumns` on success so the
 * caller can detect duplicates.
 */
function validateCustomColumn(
  collection: string,
  column: CustomColumn,
  declaredColumns: ReadonlySet<string>,
): void {
  const where = `collection '${collection}', column '${column.name}'`

  assertValidSqlIdentifier(column.name, 'Column')
  assert(
    !LIBRARY_OWNED_COLUMNS.has(column.name),
    `${where}: collides with a library-owned column (${Array.from(LIBRARY_OWNED_COLUMNS).join(', ')})`,
  )
  assert(!declaredColumns.has(column.name), `${where}: duplicate column declaration`)

  const path = column.path
  const expression = column.expression
  const hasPath = typeof path === 'string' && path.length > 0
  const hasExpression = typeof expression === 'string' && expression.length > 0
  assert(hasPath !== hasExpression, `${where}: exactly one of 'path' or 'expression' is required`)

  if (typeof path === 'string' && path.length > 0) {
    validateJsonExtractPath(where, path)
  }

  if (column.collation !== undefined) {
    assert(
      column.collation === 'BINARY' ||
        column.collation === 'NOCASE' ||
        column.collation === 'RTRIM',
      `${where}: collation must be BINARY, NOCASE, or RTRIM`,
    )
  }
}

/**
 * Validate the JSON path subset accepted by SQLite's `json_extract`.
 * Reuses the library's structural JSONPath subset minus wildcard, which
 * `json_extract` doesn't support (it returns a single scalar).
 */
function validateJsonExtractPath(where: string, path: string): void {
  assert(path.startsWith('$'), `${where}: path must start with '$'`)
  // Reject wildcards — `json_extract` doesn't traverse them.
  assert(
    !path.includes('[*]'),
    `${where}: wildcard segments ('[*]') aren't supported in column paths (json_extract returns a single scalar)`,
  )
  // Single-quote inside dot/bracket segments would terminate the SQL string
  // when the path is emitted. Bracket member names with `'` are accepted by
  // JSONPath in principle but unusable here; reject them.
  assert(!path.includes("'"), `${where}: path must not contain single quotes`)
}

/**
 * Validate a single {@link CustomIndex}. Index columns may reference declared
 * custom columns or library-owned columns (`id`, `updated_at`).
 */
function validateCustomIndex(
  collection: string,
  index: CustomIndex,
  declaredColumns: ReadonlySet<string>,
): void {
  const indexLabel = index.name ?? defaultIndexName(collection, index.columns)
  const where = `collection '${collection}', index '${indexLabel}'`

  assert(index.columns.length > 0, `${where}: must reference at least one column`)
  for (const col of index.columns) {
    assert(
      declaredColumns.has(col) || LIBRARY_OWNED_COLUMNS.has(col),
      `${where}: references unknown column '${col}'. Declare it under 'columns' or use a library-owned column (${Array.from(LIBRARY_OWNED_COLUMNS).join(', ')}).`,
    )
  }
}

/**
 * Default composite-index name: `idx_rm_<collection>_<col1>_<col2>...`.
 */
function defaultIndexName(collection: string, columns: readonly string[]): string {
  return `idx_rm_${collection}_${columns.join('_')}`
}

/**
 * Generate DDL for a managed collection table and its junction table.
 *
 * Column conventions:
 * - Non-prefixed (`id`, `updated_at`): public columns owned by the library
 * - `_` prefixed (`_server_data`, `_effective_data`, `_has_local_changes`,
 *   `_revision`, `_position`): library-private bookkeeping
 * - `__` prefixed (`__client_id`, `__reconciled_at`): library-private
 *   reconciliation metadata
 * - Anything else: consumer-declared {@link CustomColumn} (VIRTUAL generated)
 */
export function generateCollectionDDL(def: ManagedCollectionDef): string[] {
  const { name } = def
  const columnLines = [
    'id TEXT PRIMARY KEY',
    '_server_data TEXT',
    '_effective_data TEXT NOT NULL',
    '_has_local_changes INTEGER NOT NULL DEFAULT 0',
    '_revision TEXT',
    '_position TEXT',
    'updated_at INTEGER NOT NULL',
    '__client_id TEXT',
    '__reconciled_at INTEGER',
  ]

  for (const column of def.columns ?? []) {
    columnLines.push(generateCustomColumnLine(column))
  }

  const ddl: string[] = [
    `CREATE TABLE rm_${name} (\n  ${columnLines.join(',\n  ')}\n)`,
    `CREATE TABLE rm_${name}_cache_keys (
  entity_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  PRIMARY KEY (entity_id, cache_key)
)`,
    `CREATE INDEX idx_rm_${name}_cks_cache_key ON rm_${name}_cache_keys (cache_key)`,
  ]

  for (const index of def.indexes ?? []) {
    ddl.push(generateCustomIndexDDL(name, index))
  }

  return ddl
}

/**
 * Build one column line for the table DDL — `<name> <type> GENERATED ALWAYS
 * AS (<expression>) VIRTUAL [COLLATE <collation>]`. Always VIRTUAL: see
 * {@link CustomColumn} for the storage rationale.
 */
function generateCustomColumnLine(column: CustomColumn): string {
  const expression =
    typeof column.expression === 'string' && column.expression.length > 0
      ? column.expression
      : `json_extract(_effective_data, '${column.path}')`
  const collation = column.collation !== undefined ? ` COLLATE ${column.collation}` : ''
  return `${column.name} ${column.type} GENERATED ALWAYS AS (${expression}) VIRTUAL${collation}`
}

/**
 * Build the `CREATE INDEX` DDL for a custom index. Composite-aware,
 * unique-aware, partial-index-aware.
 */
function generateCustomIndexDDL(collection: string, index: CustomIndex): string {
  const name = index.name ?? defaultIndexName(collection, index.columns)
  const unique = index.unique === true ? 'UNIQUE ' : ''
  const cols = index.columns.join(', ')
  const where =
    typeof index.where === 'string' && index.where.length > 0 ? ` WHERE ${index.where}` : ''
  return `CREATE ${unique}INDEX ${name} ON rm_${collection} (${cols})${where}`
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
 * For `type: 'managed'` steps, executes `generateCollectionDDL(step)` — which
 * emits the table, junction table, junction index, any consumer-declared
 * generated columns, and any consumer-declared indexes.
 *
 * Future: when `LibraryStep` gains `collectionHook`, this function will also
 * need the set of known managed tables to apply ALTER TABLE operations.
 * The hook approach also applies to future `type: 'custom'` collections.
 */
export function getSqlForStep(step: MigrationStep): string[] {
  if (step.type === 'library') {
    return (step as LibraryStep).sql
  }
  return generateCollectionDDL(step)
}
