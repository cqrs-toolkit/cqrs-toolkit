/**
 * Per-collection read model schema: validation, DDL generation, and helpers.
 */

import { assert } from '#utils'
import type {
  CollationConfig,
  CustomColumn,
  CustomIndex,
  JunctionStep,
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
 * Built-in SQLite collation names. Always available without registration.
 * SQLite matches collation names case-insensitively, so this set holds the
 * upper-case forms and lookups normalize via `toUpperCase()`.
 */
const BUILTIN_COLLATIONS: ReadonlySet<string> = new Set(['BINARY', 'NOCASE', 'RTRIM'])

/**
 * Allowed shape for a custom collation name as it appears on a
 * {@link CollationConfig} or {@link CustomColumn.collation} reference.
 *
 * Permits both cases (SQLite is case-insensitive on collation names) and
 * keeps the same SQL-identifier discipline as column/table names — letters,
 * digits, underscores, starting with a letter. Defends the DDL emit path
 * against unintended SQL injection when the name is interpolated into the
 * `COLLATE` clause verbatim.
 */
const COLLATION_NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/

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
  collations: readonly CollationConfig[] = [],
): void {
  const seenCollections = new Set<string>()
  const seenLibraryStepIds = new Set<string>()
  let lastLibraryStepVersion = 0

  const registeredCollations = new Set<string>()
  for (const c of collations) {
    assert(
      COLLATION_NAME_RE.test(c.name),
      `Collation name must match ${COLLATION_NAME_RE} (got '${c.name}')`,
    )
    const upper = c.name.toUpperCase()
    assert(
      !BUILTIN_COLLATIONS.has(upper),
      `Collation '${c.name}' collides with a built-in SQLite collation (${Array.from(BUILTIN_COLLATIONS).join(', ')}); drop the registration and reference the built-in directly.`,
    )
    assert(
      !registeredCollations.has(upper),
      `Duplicate collation registration: '${c.name}' (collation names are case-insensitive)`,
    )
    registeredCollations.add(upper)
  }

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
          validateCustomColumn(step.name, column, declaredColumns, registeredCollations)
          declaredColumns.add(column.name)
        }
        for (const index of step.indexes ?? []) {
          validateCustomIndex(step.name, index, declaredColumns)
        }
      } else if (step.type === 'junction') {
        // Junction-step structural validation. The cross-cutting checks
        // (parent exists, name uniqueness across managed + junction names,
        // path syntax, [*] wildcard requirement) live in `resolveConfig`'s
        // `validateRegistrationPaths` — which has the cumulative view across
        // migration versions that junctions need.
        assertValidSqlIdentifier(step.name, 'Junction')
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
  registeredCollations: ReadonlySet<string>,
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
      COLLATION_NAME_RE.test(column.collation),
      `${where}: collation name must match ${COLLATION_NAME_RE} (got '${column.collation}')`,
    )
    const upper = column.collation.toUpperCase()
    assert(
      BUILTIN_COLLATIONS.has(upper) || registeredCollations.has(upper),
      `${where}: collation '${column.collation}' is not registered. Declare it on CqrsConfig.collations, or use a built-in (${Array.from(BUILTIN_COLLATIONS).join(', ')}).`,
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

  // A non-partial index on just `id` duplicates the primary key's implicit
  // unique index. Partial indexes on `id` (with a `where` clause) are
  // genuinely distinct and remain allowed.
  const hasWhere = typeof index.where === 'string' && index.where.length > 0
  if (index.columns.length === 1 && index.columns[0] === 'id' && !hasWhere) {
    assert.fail(
      `${where}: index on ['id'] is redundant with the primary key. Remove it, or add a 'where' clause to make it a partial index.`,
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
 * Options for {@link generateCollectionDDL} / {@link getSqlForStep}.
 */
export interface GenerateDdlOptions {
  /**
   * Strip `COLLATE <name>` clauses for custom (non-built-in) collations
   * during DDL emission. Use with the `unsupportedCollations: 'degrade'`
   * policy when the active SQLite backend can't register comparators
   * (better-sqlite3 in Electron). Built-in names — `BINARY`, `NOCASE`,
   * `RTRIM` — are emitted unchanged.
   */
  stripCustomCollations?: boolean
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
export function generateCollectionDDL(
  def: ManagedCollectionDef,
  options: GenerateDdlOptions = {},
): string[] {
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
    columnLines.push(generateCustomColumnLine(column, options))
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
function generateCustomColumnLine(column: CustomColumn, options: GenerateDdlOptions): string {
  const expression =
    typeof column.expression === 'string' && column.expression.length > 0
      ? column.expression
      : `json_extract(_effective_data, '${column.path}')`
  const collation = resolveCollationClause(column.collation, options)
  return `${column.name} ${column.type} GENERATED ALWAYS AS (${expression}) VIRTUAL${collation}`
}

function resolveCollationClause(
  collation: string | undefined,
  options: GenerateDdlOptions,
): string {
  if (collation === undefined) return ''
  if (options.stripCustomCollations === true && !BUILTIN_COLLATIONS.has(collation.toUpperCase())) {
    return ''
  }
  return ` COLLATE ${collation}`
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
 * Group all {@link JunctionStep} declarations across a migration sequence by
 * parent collection. Insertion order within a parent matches declaration
 * order across migration versions.
 *
 * Returns an empty map when no junctions are declared — callers can
 * early-exit on `map.size === 0`.
 */
export function getJunctionsByParent(
  migrations: [SchemaMigration, ...SchemaMigration[]],
): Map<string, JunctionStep[]> {
  const map = new Map<string, JunctionStep[]>()
  for (const migration of migrations) {
    for (const step of migration.steps) {
      if (step.type !== 'junction') continue
      let list = map.get(step.parent)
      if (!list) {
        list = []
        map.set(step.parent, list)
      }
      list.push(step)
    }
  }
  return map
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
export function getSqlForStep(step: MigrationStep, options: GenerateDdlOptions = {}): string[] {
  if (step.type === 'library') {
    return (step as LibraryStep).sql
  }
  if (step.type === 'junction') {
    return generateJunctionDDL(step)
  }
  return generateCollectionDDL(step, options)
}

/**
 * Generate DDL for a junction table.
 *
 * Shape — public contract; the consumer's view SQL joins through these
 * columns directly. See {@link JunctionStep} for column semantics.
 */
export function generateJunctionDDL(step: JunctionStep): string[] {
  const { name } = step
  return [
    `CREATE TABLE rm_${name} (
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  child_value TEXT,
  PRIMARY KEY (parent_id, child_id)
) STRICT, WITHOUT ROWID`,
    `CREATE INDEX idx_rm_${name}_child ON rm_${name} (child_id)`,
  ]
}

/**
 * Policy applied when the active SQLite backend cannot register custom
 * collations (better-sqlite3 in Electron; built-in collations stay
 * available either way). Built-in names (`BINARY`, `NOCASE`, `RTRIM`)
 * are never affected.
 *
 * - `'error'`: throw at construction if any managed column declares a
 *   non-built-in collation. Suitable as the conservative default when the
 *   backend has no fallback.
 * - `'degrade'`: emit DDL with the `COLLATE <name>` clause stripped for
 *   non-built-in collations. SQL ordering falls back to `BINARY` for
 *   those columns; locale-aware ordering is lost for the SQL path.
 *   Consumer-opt-in trade-off so a shared CQRS config can boot in a
 *   backend without collation support.
 */
export type UnsupportedCollationsPolicy = 'error' | 'degrade'

/**
 * Enforce the `'error'` half of {@link UnsupportedCollationsPolicy}: walk
 * the migrations and throw on the first managed column whose `collation`
 * resolves to a custom (non-built-in) name. Called by {@link SQLiteStorage}
 * when the active backend has declared it can't register comparators and
 * the consumer hasn't opted into `'degrade'`.
 */
export function assertNoCustomCollations(
  migrations: readonly SchemaMigration[],
  backendLabel: string,
): void {
  for (const migration of migrations) {
    for (const step of migration.steps) {
      if (step.type !== 'managed') continue
      for (const column of step.columns ?? []) {
        if (column.collation === undefined) continue
        if (BUILTIN_COLLATIONS.has(column.collation.toUpperCase())) continue
        throw new Error(
          `Migration v${migration.version} collection '${step.name}' column '${column.name}' references custom collation '${column.collation}', but the active SQLite backend (${backendLabel}) cannot register one. Use a built-in collation (${Array.from(BUILTIN_COLLATIONS).join(', ')}), drop the collation, or pass \`unsupportedCollations: 'degrade'\` to fall back to BINARY ordering on this column.`,
        )
      }
    }
  }
}
