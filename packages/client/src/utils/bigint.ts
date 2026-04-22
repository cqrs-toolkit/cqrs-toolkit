/**
 * Serialize a bigint value to a string for storage in read models.
 *
 * Handles the common serialization cases:
 * - `bigint` → string representation
 * - `string` containing a valid integer → passed through
 * - `undefined` → `undefined` (absent values stay absent)
 *
 * Rejects invalid inputs (e.g., `String(undefined)` = `"undefined"`) that would
 * silently produce corrupt data.
 */
export function serializeBigint(value: bigint | string | undefined): string | undefined {
  if (typeof value === 'undefined') return undefined
  if (typeof value === 'bigint') return String(value)
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return value
  return undefined
}

export function safeParseSerializeBigint(value: unknown): bigint | undefined {
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value)
  }

  return undefined
}
