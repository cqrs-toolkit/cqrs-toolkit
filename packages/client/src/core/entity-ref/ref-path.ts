/**
 * JSONPath subset for EntityRef path expressions.
 *
 * Implements a subset of JSONPath (RFC 9535) — only structural access
 * operators. No query, filter, or selection operators.
 *
 * Supported: root ($), dot member (.name), bracket member (['name']),
 * wildcard ([*]), index ([n]).
 */

import type { EntityRef } from '../../types/entities.js'
import { isEntityRef } from '../../types/entities.js'
import { JSONPathExpression } from '../../types/index.js'

// TODO: review which remaining `string`s here should be `JSONPathExpression` instead

/** A single segment in a parsed path. */
type PathSegment =
  | { type: 'member'; name: string }
  | { type: 'index'; index: number }
  | { type: 'wildcard' }

/**
 * Parse a JSONPath expression into segments.
 * Expects paths starting with `$`.
 */
function parsePath(path: JSONPathExpression): PathSegment[] {
  if (!path.startsWith('$')) {
    throw new Error(`EntityRef path must start with $: "${path}"`)
  }

  const segments: PathSegment[] = []
  let i = 1 // skip $

  while (i < path.length) {
    if (path[i] === '.') {
      // Dot member: .name
      i++
      let name = ''
      while (i < path.length && path[i] !== '.' && path[i] !== '[') {
        name += path[i]
        i++
      }
      if (name.length === 0) {
        throw new Error(`Empty member name in path: "${path}"`)
      }
      segments.push({ type: 'member', name })
    } else if (path[i] === '[') {
      i++
      if (path[i] === "'") {
        // Bracket member: ['name']
        i++
        let name = ''
        while (i < path.length && path[i] !== "'") {
          name += path[i]
          i++
        }
        if (path[i] !== "'") {
          throw new Error(`Unterminated bracket member in path: "${path}"`)
        }
        i++ // skip closing '
        if (path[i] !== ']') {
          throw new Error(`Expected ] after bracket member in path: "${path}"`)
        }
        i++ // skip ]
        segments.push({ type: 'member', name })
      } else if (path[i] === '*') {
        // Wildcard: [*]
        i++
        if (path[i] !== ']') {
          throw new Error(`Expected ] after wildcard in path: "${path}"`)
        }
        i++ // skip ]
        segments.push({ type: 'wildcard' })
      } else {
        // Index: [n]
        let numStr = ''
        while (i < path.length && path[i] !== ']') {
          numStr += path[i]
          i++
        }
        if (path[i] !== ']') {
          throw new Error(`Unterminated index in path: "${path}"`)
        }
        i++ // skip ]
        const index = parseInt(numStr, 10)
        if (!Number.isFinite(index) || index < 0) {
          throw new Error(`Invalid index "${numStr}" in path: "${path}"`)
        }
        segments.push({ type: 'index', index })
      }
    } else {
      throw new Error(`Unexpected character "${path[i]}" at position ${i} in path: "${path}"`)
    }
  }

  return segments
}

/**
 * Serialize segments back to a JSONPath string.
 */
function segmentsToPath(segments: PathSegment[]): string {
  let result = '$'
  for (const seg of segments) {
    switch (seg.type) {
      case 'member':
        // Use bracket notation if name is not a simple identifier
        if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(seg.name)) {
          result += `['${seg.name}']`
        } else {
          result += `.${seg.name}`
        }
        break
      case 'index':
        result += `[${seg.index}]`
        break
      case 'wildcard':
        result += '[*]'
        break
    }
  }
  return result
}

/**
 * Read a value at a concrete path (no wildcards).
 */
export function getAtPath(obj: unknown, path: JSONPathExpression): unknown {
  const segments = parsePath(path)
  let current: unknown = obj

  for (const seg of segments) {
    if (typeof current !== 'object' || current === null) return undefined

    switch (seg.type) {
      case 'member':
        current = (current as Record<string, unknown>)[seg.name]
        break
      case 'index':
        if (!Array.isArray(current)) return undefined
        current = current[seg.index]
        break
      case 'wildcard':
        throw new Error(`getAtPath does not support wildcard segments: "${path}"`)
    }
  }

  return current
}

/**
 * Set a value at a concrete path (no wildcards).
 * Returns a shallow-cloned object with the value set at the path.
 */
export function setAtPath<T>(obj: T, path: JSONPathExpression, value: unknown): T {
  const segments = parsePath(path)
  if (segments.length === 0) return value as T

  return setAtSegments(obj, segments, 0, value) as T
}

function setAtSegments(
  obj: unknown,
  segments: PathSegment[],
  index: number,
  value: unknown,
): unknown {
  const seg = segments[index]
  if (!seg) return value

  if (index === segments.length - 1) {
    // Leaf: set the value
    switch (seg.type) {
      case 'member': {
        const record = (typeof obj === 'object' && obj !== null ? obj : {}) as Record<
          string,
          unknown
        >
        return { ...record, [seg.name]: value }
      }
      case 'index': {
        const arr = Array.isArray(obj) ? [...obj] : []
        arr[seg.index] = value
        return arr
      }
      case 'wildcard':
        throw new Error('setAtPath does not support wildcard segments')
    }
  }

  // Intermediate: recurse
  switch (seg.type) {
    case 'member': {
      const record = (typeof obj === 'object' && obj !== null ? obj : {}) as Record<string, unknown>
      return { ...record, [seg.name]: setAtSegments(record[seg.name], segments, index + 1, value) }
    }
    case 'index': {
      const arr = Array.isArray(obj) ? [...obj] : []
      arr[seg.index] = setAtSegments(arr[seg.index], segments, index + 1, value)
      return arr
    }
    case 'wildcard':
      throw new Error('setAtPath does not support wildcard segments')
  }
}

/**
 * A leaf match returned by {@link findMatchingPaths}.
 * `path` is a concrete (wildcard-expanded) JSONPath suitable for {@link setAtPath}.
 */
export interface PathMatch {
  path: JSONPathExpression
  value: unknown
}

/**
 * Walk a JSONPath pattern (which may contain `[*]` wildcards) against data,
 * returning concrete paths whose leaf values satisfy the predicate.
 *
 * The returned paths are concrete — they can be passed directly to
 * {@link setAtPath} to write replacement values.
 *
 * Used by read-model reconciliation to enumerate matching ID locations
 * across array structures.
 *
 * @param data - Root data structure to walk
 * @param pattern - JSONPath expression, may contain `[*]` wildcards
 * @param predicate - Returns true for leaf values that should be collected
 */
export function findMatchingPaths(
  data: unknown,
  pattern: JSONPathExpression,
  predicate: (value: unknown) => boolean,
): PathMatch[] {
  const segments = parsePath(pattern)
  const result: PathMatch[] = []
  walkSegments(data, segments, 0, [], predicate, result)
  return result
}

/**
 * Resolve declaration paths (which may contain [*] wildcards) against data.
 * Returns a map of concrete paths to EntityRef values found at those paths.
 */
export function resolveRefPaths(data: unknown, patterns: string[]): Record<string, EntityRef> {
  const result: Record<string, EntityRef> = {}

  for (const pattern of patterns) {
    for (const match of findMatchingPaths(data, pattern, isEntityRef)) {
      // Predicate guarantees value is an EntityRef
      result[match.path] = match.value as EntityRef
    }
  }

  return result
}

function walkSegments(
  current: unknown,
  segments: PathSegment[],
  index: number,
  concretePath: PathSegment[],
  predicate: (value: unknown) => boolean,
  result: PathMatch[],
): void {
  if (index === segments.length) {
    // Skip leaves that don't exist in the data — the predicate is only called
    // for values actually present at the path.
    if (current === undefined) return
    if (predicate(current)) {
      result.push({ path: segmentsToPath(concretePath), value: current })
    }
    return
  }

  if (typeof current !== 'object' || current === null) return

  const seg = segments[index]
  if (!seg) return

  switch (seg.type) {
    case 'member': {
      const value = (current as Record<string, unknown>)[seg.name]
      walkSegments(value, segments, index + 1, [...concretePath, seg], predicate, result)
      break
    }
    case 'index': {
      if (!Array.isArray(current)) return
      const value = current[seg.index]
      walkSegments(value, segments, index + 1, [...concretePath, seg], predicate, result)
      break
    }
    case 'wildcard': {
      if (!Array.isArray(current)) return
      for (let i = 0; i < current.length; i++) {
        walkSegments(
          current[i],
          segments,
          index + 1,
          [...concretePath, { type: 'index', index: i }],
          predicate,
          result,
        )
      }
      break
    }
  }
}

/**
 * Extract all EntityRef values from top-level fields of a data object.
 * Returns a map of `$.fieldName` paths to EntityRef values.
 */
export function extractTopLevelEntityRefs(data: unknown): Record<string, EntityRef> {
  const result: Record<string, EntityRef> = {}
  if (typeof data !== 'object' || data === null) return result

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (isEntityRef(value)) {
      result[`$.${key}`] = value
    }
  }

  return result
}

/**
 * Replace EntityRef values at the given paths with their plain entityId strings.
 * Returns a shallow clone of the data with replacements applied.
 */
export function stripEntityRefs(data: unknown, entityRefData: Record<string, EntityRef>): unknown {
  let result = data
  for (const [path, ref] of Object.entries(entityRefData)) {
    result = setAtPath(result, path, ref.entityId)
  }
  return result
}

/**
 * Restore EntityRef values at the given paths (inverse of stripEntityRefs).
 * Returns a clone of the data with EntityRef values re-injected at their original paths.
 */
export function restoreEntityRefs(
  data: unknown,
  entityRefData: Record<string, EntityRef>,
): unknown {
  let result = data
  for (const [path, ref] of Object.entries(entityRefData)) {
    result = setAtPath(result, path, ref)
  }
  return result
}
