/**
 * Stable JSON stringify that produces consistent output.
 * Keys are sorted alphabetically for determinism.
 */
export function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(sortObjectKeys(obj))
}

/**
 * Recursively sort object keys for stable serialization.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys)
  }

  const sorted: Record<string, unknown> = {}
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  for (const key of keys) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key])
  }
  return sorted
}
