/**
 * Canonical SQL-identifier discipline for everywhere this package writes an
 * identifier into SQL text (collection names, custom-column names, sort
 * columns, …). Lowercase letter start, snake_case body, max 50 chars.
 *
 * Leading underscores are reserved for library-private bookkeeping columns
 * (`_server_data`, `_revision`, `__client_id`, …); the `[a-z]` first-char
 * requirement rejects user-supplied identifiers that would shadow them.
 */

import { assert } from '#utils'

export const SQL_IDENTIFIER_RE = /^[a-z][a-z0-9_]*$/
export const SQL_IDENTIFIER_MAX_LENGTH = 50

export function isValidSqlIdentifier(name: string): boolean {
  return name.length <= SQL_IDENTIFIER_MAX_LENGTH && SQL_IDENTIFIER_RE.test(name)
}

/**
 * Assert that `name` is a valid SQL identifier under {@link SQL_IDENTIFIER_RE}
 * and {@link SQL_IDENTIFIER_MAX_LENGTH}. `kind` describes the identifier role
 * for the error message (e.g. `"Collection"`, `"Column"`, `"Sort column"`).
 */
export function assertValidSqlIdentifier(name: string, kind: string): void {
  assert(
    name.length <= SQL_IDENTIFIER_MAX_LENGTH,
    `${kind} '${name}' exceeds ${SQL_IDENTIFIER_MAX_LENGTH} characters`,
  )
  assert(
    SQL_IDENTIFIER_RE.test(name),
    `${kind} name must match ${SQL_IDENTIFIER_RE} (got '${name}'; lowercase letters, digits, underscores, starting with a letter)`,
  )
}
