/**
 * JSONPath subset navigator over a JSON Schema's *shape*.
 *
 * Same expression scope as `JSONPathExpression` in `@cqrs-toolkit/client`
 * (root `$`, dot member, bracket member, `[*]` wildcard, `[n]` index;
 * no filter/function operations). Navigation semantics differ: paths walk
 * schema *types* — `.foo` steps into `properties.foo`, `[*]` / `[n]` steps
 * into `items` — so the same path that resolves a data value can be used
 * to locate the schema describing it.
 *
 * Used by the codegen pipeline to apply per-field `idReferences` annotations:
 * given a schema and a path, find the target subschema's slot in its parent
 * and swap it for a different schema.
 */

import type { JSONPathExpression } from '@cqrs-toolkit/client'
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema'

type PathSegment =
  | { type: 'member'; name: string }
  | { type: 'index'; index: number }
  | { type: 'wildcard' }

/**
 * The mutable slot a path resolves to. Discriminated by the slot's shape:
 * `'property'` targets the named entry of a `properties` map; `'items'`
 * targets the `items` field of the enclosing schema.
 */
export type SchemaPathTarget =
  | { kind: 'property'; parent: { [key: string]: JSONSchema7Definition }; key: string }
  | { kind: 'items'; parent: JSONSchema7 }

/**
 * Locate the parent/key slot a path resolves to inside `schema`.
 * Throws with a descriptive message if any step fails (missing property,
 * navigating into a non-object, tuple-style `items` arrays, etc.).
 */
export function findSchemaPathTarget(
  schema: JSONSchema7,
  path: JSONPathExpression,
): SchemaPathTarget {
  const segments = parsePath(path)
  if (segments.length === 0) {
    throw new Error(`Path '${path}' resolves to the root schema; cannot replace root`)
  }
  let current: JSONSchema7 = schema
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (seg === undefined) continue
    current = stepInto(current, seg, path)
  }
  const last = segments[segments.length - 1]
  if (last === undefined) {
    throw new Error(`Path '${path}' has no final segment`)
  }
  return stepToTarget(current, last, path)
}

/**
 * Convenience: replace the subschema at `path` with `replacement`. Mutates
 * `schema` in place.
 */
export function replaceSchemaAtPath(
  schema: JSONSchema7,
  path: JSONPathExpression,
  replacement: JSONSchema7,
): void {
  const target = findSchemaPathTarget(schema, path)
  if (target.kind === 'property') {
    target.parent[target.key] = replacement
  } else {
    target.parent.items = replacement
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function parsePath(path: JSONPathExpression): PathSegment[] {
  if (!path.startsWith('$')) {
    throw new Error(`Path must start with $: "${path}"`)
  }
  const segments: PathSegment[] = []
  let i = 1
  while (i < path.length) {
    const ch = path[i]
    if (ch === '.') {
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
    } else if (ch === '[') {
      i++
      const next = path[i]
      if (next === "'" || next === '"') {
        const quote = next
        i++
        let name = ''
        while (i < path.length && path[i] !== quote) {
          name += path[i]
          i++
        }
        if (path[i] !== quote) {
          throw new Error(`Unterminated bracket member in path: "${path}"`)
        }
        i++
        if (path[i] !== ']') {
          throw new Error(`Expected ] after bracket member in path: "${path}"`)
        }
        i++
        segments.push({ type: 'member', name })
      } else if (next === '*') {
        i++
        if (path[i] !== ']') {
          throw new Error(`Expected ] after wildcard in path: "${path}"`)
        }
        i++
        segments.push({ type: 'wildcard' })
      } else {
        let numStr = ''
        while (i < path.length && path[i] !== ']') {
          numStr += path[i]
          i++
        }
        if (path[i] !== ']') {
          throw new Error(`Unterminated index in path: "${path}"`)
        }
        i++
        const index = parseInt(numStr, 10)
        if (!Number.isFinite(index) || index < 0) {
          throw new Error(`Invalid index "${numStr}" in path: "${path}"`)
        }
        segments.push({ type: 'index', index })
      }
    } else {
      throw new Error(`Unexpected character "${ch}" at position ${i} in path: "${path}"`)
    }
  }
  return segments
}

function stepInto(
  node: JSONSchema7,
  segment: PathSegment,
  fullPath: JSONPathExpression,
): JSONSchema7 {
  if (segment.type === 'member') {
    const props = node.properties
    if (typeof props !== 'object' || props === null) {
      throw new Error(
        `Path '${fullPath}': cannot navigate to '.${segment.name}' — enclosing schema has no 'properties'`,
      )
    }
    const next = props[segment.name]
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      throw new Error(`Path '${fullPath}': property '${segment.name}' is not a schema object`)
    }
    return next
  }
  const items = node.items
  if (Array.isArray(items)) {
    throw new Error(`Path '${fullPath}': tuple-style 'items' arrays not supported`)
  }
  if (typeof items !== 'object' || items === null) {
    throw new Error(
      `Path '${fullPath}': cannot navigate into array — enclosing schema has no 'items'`,
    )
  }
  return items
}

function stepToTarget(
  node: JSONSchema7,
  segment: PathSegment,
  fullPath: JSONPathExpression,
): SchemaPathTarget {
  if (segment.type === 'member') {
    const props = node.properties
    if (typeof props !== 'object' || props === null) {
      throw new Error(
        `Path '${fullPath}': cannot find '.${segment.name}' — enclosing schema has no 'properties'`,
      )
    }
    if (!(segment.name in props)) {
      throw new Error(`Path '${fullPath}': property '${segment.name}' does not exist`)
    }
    return { kind: 'property', parent: props, key: segment.name }
  }
  if (Array.isArray(node.items)) {
    throw new Error(`Path '${fullPath}': tuple-style 'items' arrays not supported`)
  }
  if (typeof node.items !== 'object' || node.items === null) {
    throw new Error(`Path '${fullPath}': cannot replace items — enclosing schema has no 'items'`)
  }
  return { kind: 'items', parent: node }
}
