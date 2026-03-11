import type { ErrorObject } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import type { Int64Envelope } from './SchemaRegistry.js'
import { FieldError } from './types.js'

/**
 * Walk a JSON Schema to find all leaf paths containing `{ type: 'string', format: 'int64' }`.
 * Paths use dot notation for properties, `[]` for array items, and `[N]` for tuple indices.
 *
 * Cache the result and pass to `applyBigInt()` after validation:
 * ```
 * const int64Paths = buildInt64Paths(schema) // once, and cache
 * applyBigInt(data, int64Paths)
 * ```
 */
export function buildInt64Paths(schema: JSONSchema7): string[] {
  const paths = new Set<string>()
  collectInt64Paths(schema, '', paths)
  return [...paths]
}

/**
 * After AJV validation, convert string values at int64 paths to BigInt.
 * Non-numeric strings (e.g., `'latest'` in a union) are left unchanged.
 */
export function applyBigInt(data: any, envelope: Int64Envelope): void {
  for (const path of envelope.paths) {
    applyBigIntAtPath(data, path.split('.').filter(Boolean), '', envelope)
  }
}

export function transformAjvErrors(errors: ErrorObject[]): FieldError[] {
  const result: FieldError[] = []

  for (const error of errors) {
    let path: string
    if (error.keyword === 'required') {
      const missingProperty = (error.params as { missingProperty: string }).missingProperty
      const base = instancePathToDot(error.instancePath)
      path = base ? `${base}.${missingProperty}` : missingProperty
    } else {
      path = instancePathToDot(error.instancePath)
    }

    result.push({
      path,
      code: error.keyword,
      message: error.message ?? 'Unknown validation error',
      params: error.params as Record<string, unknown>,
    })
  }

  return result
}

function applyBigIntAtPath(
  current: any,
  parts: string[],
  canonicalPrefix: string,
  envelope: Int64Envelope,
): void {
  if (current == null || !hasParts(parts)) return

  const [head, ...rest] = parts

  if (head === '*') {
    const starPath = `${canonicalPrefix}.*`
    const excludeKeys = envelope.starMap.get(starPath)
    const excludeSet = excludeKeys ? new Set(excludeKeys) : undefined
    for (const key of Object.keys(current)) {
      if (excludeSet?.has(key)) continue
      if (rest.length === 0) {
        if (typeof current[key] === 'string') {
          const converted = tryBigInt(current[key])
          if (converted !== undefined) current[key] = converted
        }
      } else {
        applyBigIntAtPath(current[key], rest, starPath, envelope)
      }
    }
    return
  }

  const arrayAllMatch = head.match(/^(.+)\[\]$/)
  const arrayIdxMatch = head.match(/^(.+)\[(\d+)\]$/)

  if (arrayAllMatch) {
    const key = arrayAllMatch[1]!
    const nextPrefix = `${canonicalPrefix}.${head}`
    if (!Array.isArray(current[key])) return
    if (rest.length === 0) {
      for (let i = 0; i < current[key].length; i++) {
        if (typeof current[key][i] === 'string') {
          const converted = tryBigInt(current[key][i])
          if (converted !== undefined) current[key][i] = converted
        }
      }
    } else {
      for (const item of current[key]) {
        applyBigIntAtPath(item, rest, nextPrefix, envelope)
      }
    }
  } else if (arrayIdxMatch) {
    const key = arrayIdxMatch[1]!
    const idx = Number(arrayIdxMatch[2])
    const nextPrefix = `${canonicalPrefix}.${head}`
    if (!Array.isArray(current[key])) return
    if (rest.length === 0) {
      if (typeof current[key][idx] === 'string') {
        const converted = tryBigInt(current[key][idx])
        if (converted !== undefined) current[key][idx] = converted
      }
    } else {
      applyBigIntAtPath(current[key][idx], rest, nextPrefix, envelope)
    }
  } else {
    const nextPrefix = `${canonicalPrefix}.${head}`
    if (rest.length === 0) {
      if (typeof current[head] === 'string') {
        const converted = tryBigInt(current[head])
        if (converted !== undefined) current[head] = converted
      }
    } else {
      applyBigIntAtPath(current[head], rest, nextPrefix, envelope)
    }
  }
}

function hasParts(parts: string[]): parts is [string, ...string[]] {
  return parts.length > 0
}

function tryBigInt(value: string): bigint | undefined {
  try {
    return BigInt(value)
  } catch {
    return undefined
  }
}

function collectInt64Paths(schema: JSONSchema7, path: string, paths: Set<string>): void {
  if (schema.format === 'int64' && schema.type === 'string') {
    paths.add(path)
  }
  if (schema.properties) {
    for (const [key, child] of Object.entries(schema.properties)) {
      if (typeof child === 'boolean') continue
      collectInt64Paths(child, `${path}.${key}`, paths)
    }
  }
  if (schema.items) {
    if (typeof schema.items === 'boolean') return
    if (Array.isArray(schema.items)) {
      for (const [i, item] of schema.items.entries()) {
        if (typeof item === 'boolean') continue
        collectInt64Paths(item, `${path}[${i}]`, paths)
      }
    } else {
      collectInt64Paths(schema.items, `${path}[]`, paths)
    }
  }
  for (const keyword of ['anyOf', 'oneOf', 'allOf'] as const) {
    const branches = schema[keyword]
    if (!Array.isArray(branches)) continue
    for (const branch of branches) {
      if (typeof branch === 'boolean') continue
      collectInt64Paths(branch, path, paths)
    }
  }
}

function instancePathToDot(instancePath: string): string {
  if (!instancePath) return ''
  // instancePath is like "/foo/bar/0/baz" — strip leading slash, replace remaining with dots
  return instancePath.slice(1).replaceAll('/', '.')
}
